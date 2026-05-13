import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { HotelController } from "./hotel.controller";
import { HotelService } from "./hotel.service";

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [HotelController],
  providers: [HotelService],
  exports: [HotelService],
})
export class HotelModule {}
