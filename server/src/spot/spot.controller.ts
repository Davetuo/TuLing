import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SpotService } from './spot.service';
import { SearchSpotsDto, SpotReviewListDto } from './dto';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/spots')
export class SpotController {
  constructor(private readonly spotService: SpotService) {}

  /**
   * 搜索景点 - 公开接口（但登录用户可获取收藏状态）
   */
  @Public()
  @Get()
  async searchSpots(
    @Query() dto: SearchSpotsDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.spotService.searchSpots(dto, user?.sub);
  }

  /**
   * 获取用户收藏列表 - 需登录
   * 注意：此路由需在 :id 路由之前定义，避免 "favorites" 被解析为 UUID
   */
  @Get('favorites')
  async getFavorites(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.spotService.getFavorites(
      user.sub,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  /**
   * 获取景点详情 - 公开接口
   */
  @Public()
  @Get(':id')
  async getSpotDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.spotService.getSpotDetail(id, user?.sub);
  }

  /**
   * 收藏景点 - 需登录
   */
  @Post(':id/favorite')
  @HttpCode(HttpStatus.OK)
  async favoriteSpot(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.spotService.favoriteSpot(user.sub, id);
  }

  /**
   * 取消收藏 - 需登录
   */
  @Delete(':id/favorite')
  async unfavoriteSpot(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.spotService.unfavoriteSpot(user.sub, id);
  }

  /**
   * 获取景点评价列表 - 公开接口
   */
  @Public()
  @Get(':id/reviews')
  async getReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: SpotReviewListDto,
  ) {
    return this.spotService.getReviews(id, dto.page, dto.pageSize);
  }
}
