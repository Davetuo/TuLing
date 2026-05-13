import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { HotelService } from "./hotel.service";
import {
  SearchHotelsDto,
  CreateHotelReviewDto,
  HotelReviewListDto,
} from "./dto";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";

@Controller("api/hotels")
export class HotelController {
  constructor(private readonly hotelService: HotelService) {}

  /**
   * 搜索酒店 - 公开接口
   */
  @Public()
  @Get()
  async searchHotels(
    @Query() dto: SearchHotelsDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.hotelService.searchHotels(dto, user?.sub);
  }

  /**
   * 我的酒店收藏 - 需登录
   */
  @Get("favorites")
  async getFavorites(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.hotelService.getFavorites(
      user.sub,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  /**
   * 我写过的酒店评价
   */
  @Get("my-reviews")
  async getMyReviews(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.hotelService.getMyReviews(
      user.sub,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  /**
   * 删除我的评价
   */
  @Delete("my-reviews/:reviewId")
  async deleteMyReview(
    @CurrentUser() user: JwtPayload,
    @Param("reviewId", ParseUUIDPipe) reviewId: string,
  ) {
    return this.hotelService.deleteMyReview(user.sub, reviewId);
  }

  /**
   * 酒店详情
   */
  @Public()
  @Get(":id")
  async getHotelDetail(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.hotelService.getHotelDetail(id, user?.sub);
  }

  /**
   * 收藏酒店
   */
  @Post(":id/favorite")
  @HttpCode(HttpStatus.OK)
  async favoriteHotel(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.hotelService.favoriteHotel(user.sub, id);
  }

  /**
   * 取消收藏
   */
  @Delete(":id/favorite")
  async unfavoriteHotel(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.hotelService.unfavoriteHotel(user.sub, id);
  }

  /**
   * 酒店评价列表
   */
  @Public()
  @Get(":id/reviews")
  async getReviews(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() dto: HotelReviewListDto,
  ) {
    return this.hotelService.getReviews(id, dto.page, dto.pageSize);
  }

  /**
   * 提交评价
   */
  @Post(":id/reviews")
  @HttpCode(HttpStatus.CREATED)
  async createReview(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateHotelReviewDto,
  ) {
    return this.hotelService.createReview(
      id,
      user.sub,
      dto.score,
      dto.content,
    );
  }
}
