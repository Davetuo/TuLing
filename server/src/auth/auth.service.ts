import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // 校验邮箱唯一性（优先检查，避免浪费用户验证码）
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('该邮箱已注册，请直接登录');
    }

    // 校验验证码
    const valid = await this.redis.verifyCaptcha(dto.email, dto.captcha);
    if (!valid) {
      throw new BadRequestException('验证码错误或已过期，请重新获取');
    }

    // 创建用户
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        nickname: dto.username,
      },
    });

    // 颁发 Token
    const tokens = await this.generateTokens(user.id, dto.email);

    this.logger.log(`User registered: ${user.id}`);
    return {
      user: { id: user.id, email: user.email, nickname: user.nickname },
      ...tokens,
    };
  }

  async login(dto: LoginDto, ip: string) {
    // 限流检查
    const blocked = await this.redis.isLoginBlocked(ip);
    if (blocked) {
      throw new BadRequestException('登录尝试过于频繁，请 15 分钟后再试');
    }

    // 查找用户（邮箱或手机号）
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.account }, { phone: dto.account }],
      },
    });

    if (!user) {
      await this.redis.recordLoginFailure(ip);
      throw new UnauthorizedException('账号或密码错误');
    }

    // 校验密码
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.redis.recordLoginFailure(ip);
      throw new UnauthorizedException('账号或密码错误');
    }

    // 检查账号状态
    if (user.status !== 'active') {
      throw new UnauthorizedException('账号已被禁用，请联系客服');
    }

    const tokens = await this.generateTokens(user.id, user.email!);
    this.logger.log(`User logged in: ${user.id}`);
    return {
      user: { id: user.id, email: user.email, nickname: user.nickname },
      ...tokens,
    };
  }

  async logout(userId: string, refreshToken: string | undefined) {
    if (refreshToken) {
      const hash = this.hashToken(refreshToken);
      await this.prisma.authToken.updateMany({
        where: { refreshTokenHash: hash, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    this.logger.log(`User logged out: ${userId}`);
  }

  async refreshTokens(oldRefreshToken: string) {
    const hash = this.hashToken(oldRefreshToken);
    const record = await this.prisma.authToken.findFirst({
      where: { refreshTokenHash: hash, revokedAt: null },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }

    // 吊销旧 token
    await this.prisma.authToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: record.userId } });
    if (!user) throw new UnauthorizedException('用户不存在');

      return this.generateTokens(user.id, user.email!);
  }

  async getUserInfo(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    return { id: user.id, email: user.email, nickname: user.nickname };
  }

  async sendCaptcha(email: string) {
    // 检查是否已注册
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('该邮箱已注册，请直接登录');
    }

    // 发送间隔检查
    const cooldown = await this.redis.getSendCooldown(email);
    if (cooldown > 0) {
      throw new BadRequestException(`请 ${cooldown} 秒后再获取验证码`);
    }

    // 生成 6 位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 存储到 Redis（5 分钟）
    await this.redis.setCaptcha(email, code, 300);
    await this.redis.setSendCooldown(email, 60);

    // 发送邮件（开发环境打印到控制台）
    this.logger.log(`[DEV] Captcha for ${email}: ${code}`);
    // TODO: 生产环境接入 Nodemailer 发送

    return { message: '验证码已发送' };
  }

  // ── 内部方法 ──

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // 存储 Refresh Token 哈希
    await this.prisma.authToken.create({
      data: {
        userId,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
