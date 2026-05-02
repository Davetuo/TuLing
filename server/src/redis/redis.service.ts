import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
    });

    try {
      await this.client.connect();
      this.logger.log('Connected to Redis');
    } catch (error) {
      this.logger.warn('Redis not available — running without cache/rate-limit');
      this.client = null!;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  private ensureClient(): Redis {
    if (!this.client) {
      throw new Error('Redis is not available');
    }
    return this.client;
  }

  // ── 验证码存取 ──

  async setCaptcha(key: string, code: string, ttlSeconds = 300): Promise<void> {
    const redis = this.ensureClient();
    await redis.set(`captcha:${key}`, code, 'EX', ttlSeconds);
  }

  async verifyCaptcha(key: string, code: string): Promise<boolean> {
    const redis = this.ensureClient();
    const stored = await redis.get(`captcha:${key}`);
    if (!stored) return false;
    if (stored !== code) return false;
    await redis.del(`captcha:${key}`);
    return true;
  }

  async hasCaptcha(key: string): Promise<boolean> {
    const redis = this.ensureClient();
    return (await redis.exists(`captcha:${key}`)) === 1;
  }

  // ── 发送间隔检查 ──

  async setSendCooldown(key: string, ttlSeconds = 60): Promise<void> {
    const redis = this.ensureClient();
    await redis.set(`cooldown:${key}`, '1', 'EX', ttlSeconds);
  }

  async getSendCooldown(key: string): Promise<number> {
    const redis = this.ensureClient();
    return redis.ttl(`cooldown:${key}`);
  }

  // ── 登录限流 ──

  async recordLoginFailure(identifier: string, ttlSeconds = 900): Promise<void> {
    const redis = this.ensureClient();
    const key = `login_fail:${identifier}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, ttlSeconds);
    }
  }

  async isLoginBlocked(identifier: string, maxAttempts = 5): Promise<boolean> {
    const redis = this.ensureClient();
    const count = await redis.get(`login_fail:${identifier}`);
    return Number(count || 0) >= maxAttempts;
  }
}
