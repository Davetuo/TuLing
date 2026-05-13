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
import { RestaurantService } from "./restaurant.service";
import {
  SearchRestaurantsDto,
  CreateRestaurantReviewDto,
  RestaurantReviewListDto,
} from "./dto";
import {
  CurrentUser,
  JwtPayload,
} from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";

@Controller("api/restaurants")
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) {}

  /**
   * 搜索餐厅 - 公开接口（登录用户可获取收藏状态）
   */
  @Public()
  @Get()
  async searchRestaurants(
    @Query() dto: SearchRestaurantsDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.restaurantService.searchRestaurants(dto, user?.sub);
  }

  /**
   * 我的餐厅收藏 - 需登录
   * 注意：此路由需在 :id 之前定义，避免 "favorites" 被解析为 UUID
   */
  @Get("favorites")
  async getFavorites(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.restaurantService.getFavorites(
      user.sub,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  /**
   * 我写过的餐厅评价 - 需登录
   */
  @Get("my-reviews")
  async getMyReviews(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.restaurantService.getMyReviews(
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
    return this.restaurantService.deleteMyReview(user.sub, reviewId);
  }

  /**
   * 餐厅详情 - 公开
   */
  @Public()
  @Get(":id")
  async getRestaurantDetail(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.restaurantService.getRestaurantDetail(id, user?.sub);
  }

  /**
   * 收藏餐厅
   */
  @Post(":id/favorite")
  @HttpCode(HttpStatus.OK)
  async favoriteRestaurant(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.restaurantService.favoriteRestaurant(user.sub, id);
  }

  /**
   * 取消收藏
   */
  @Delete(":id/favorite")
  async unfavoriteRestaurant(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.restaurantService.unfavoriteRestaurant(user.sub, id);
  }

  /**
   * 餐厅评价列表 - 公开
   */
  @Public()
  @Get(":id/reviews")
  async getReviews(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() dto: RestaurantReviewListDto,
  ) {
    return this.restaurantService.getReviews(id, dto.page, dto.pageSize);
  }

  /**
   * 提交评价
   */
  @Post(":id/reviews")
  @HttpCode(HttpStatus.CREATED)
  async createReview(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRestaurantReviewDto,
  ) {
    return this.restaurantService.createReview(
      id,
      user.sub,
      dto.score,
      dto.content,
    );
  }
}
