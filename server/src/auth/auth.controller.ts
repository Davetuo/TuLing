import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendCaptchaDto } from './dto/send-captcha.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('captcha')
  @HttpCode(HttpStatus.OK)
  async sendCaptcha(@Body() dto: SendCaptchaDto) {
    return this.authService.sendCaptcha(dto.email);
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.authService.register(dto);
    this.setTokenCookies(reply, result.accessToken, result.refreshToken);
    return { code: 0, message: '注册成功', data: result.user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const ip = req.ip || 'unknown';
    const result = await this.authService.login(dto, ip);
    this.setTokenCookies(reply, result.accessToken, result.refreshToken);
    return { code: 0, message: '登录成功', data: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const refreshToken = (req.cookies as Record<string, string>)?.['refresh_token'];
    await this.authService.logout(user.sub, refreshToken);
    this.clearTokenCookies(reply);
    return { code: 0, message: '已退出登录' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const refreshToken = (req.cookies as Record<string, string>)?.['refresh_token'];
    if (!refreshToken) {
      reply.status(401).send({ code: 401, message: '请重新登录' });
      return;
    }
    const result = await this.authService.refreshTokens(refreshToken);
    this.setTokenCookies(reply, result.accessToken, result.refreshToken);
    return { code: 0, message: 'Token 已刷新' };
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@CurrentUser() user: JwtPayload) {
    const userInfo = await this.authService.getUserInfo(user.sub);
    return { code: 0, data: userInfo };
  }

  // ── Cookie 工具 ──

  private setTokenCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
    // HTTP 环境下 secure=true 会导致浏览器拒绝保存 Cookie，
    // 因此只有存在 HTTPS 代理（X-Forwarded-Proto）时才启用 secure
    const isSecure = (process.env.NODE_ENV === 'production') && process.env.HTTPS === 'true';

    reply.setCookie('access_token', accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes
    });
    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
  }

  private clearTokenCookies(reply: FastifyReply) {
    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/api/auth/refresh' });
  }
}
