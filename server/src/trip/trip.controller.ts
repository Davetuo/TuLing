import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { TripService } from './trip.service';
import { CreateTripDto, ListTripsDto, GenerateNarrativeDto } from './dto';
import {
  CurrentUser,
  JwtPayload,
} from '../common/decorators/current-user.decorator';

@Controller('api/trips')
export class TripController {
  constructor(private readonly tripService: TripService) {}

  // 用 LLM 生成行程文案（summary / theme / per-node note）
  // 放在 :id 路由之前，避免 'narrative' 被解析为 UUID
  // 失败时返回 code=1 + data=null，让前端静默回退，不阻塞行程创建
  @Post('narrative')
  @HttpCode(HttpStatus.OK)
  async generateNarrative(@Body() dto: GenerateNarrativeDto) {
    try {
      const data = await this.tripService.generateNarrative(dto);
      return { code: 0, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI 文案生成失败';
      return { code: 1, data: null, message };
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTripDto,
  ) {
    const data = await this.tripService.createTrip(user.sub, dto);
    return { code: 0, data };
  }

  @Get()
  async list(@CurrentUser() user: JwtPayload, @Query() dto: ListTripsDto) {
    const data = await this.tripService.listTrips(user.sub, dto.page, dto.pageSize);
    return { code: 0, data };
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.tripService.getTrip(user.sub, id);
    return { code: 0, data };
  }

  @Put(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTripDto,
  ) {
    const data = await this.tripService.updateTrip(user.sub, id, dto);
    return { code: 0, data };
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.tripService.deleteTrip(user.sub, id);
    return { code: 0, data: null };
  }
}
