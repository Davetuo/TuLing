import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { SpotController } from './spot.controller';
import { SpotService } from './spot.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [SpotController],
  providers: [SpotService],
  exports: [SpotService],
})
export class SpotModule {}
