import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { MemoryService } from './memory.service';
import {
  CurrentUser,
  JwtPayload,
} from '../common/decorators/current-user.decorator';

@Controller('api/memories')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async upload(
    @CurrentUser() user: JwtPayload,
    @Req() req: FastifyRequest,
  ) {
    if (!req.isMultipart()) {
      throw new BadRequestException('请通过 multipart/form-data 上传');
    }

    // 用 parts() 完整迭代,避免 req.file() 只保留 file 之前出现的 fields
    // 前端 FormData 字段顺序不可控,任何顺序都要兼容
    let fileBuffer: Buffer | null = null;
    let mimetype = '';
    let originalName: string | undefined;
    const fields: Record<string, string> = {};

    try {
      for await (const part of req.parts()) {
        if (part.type === 'file') {
          if (fileBuffer) {
            // 已经接收过 file,跳过多余文件(limits.files=1 也会拦,但这里再防一层)
            await part.toBuffer();
            continue;
          }
          fileBuffer = await part.toBuffer();
          mimetype = part.mimetype;
          originalName = part.filename;
        } else {
          // field 部分:value 可能是 string | Buffer,只接受 string
          if (typeof part.value === 'string') fields[part.fieldname] = part.value;
        }
      }
    } catch (err: unknown) {
      // @fastify/multipart 文件超限抛 RequestFileTooLargeError
      const name = (err as Error)?.name;
      if (name === 'RequestFileTooLargeError') {
        throw new PayloadTooLargeException('图片大小不能超过 10MB');
      }
      throw new BadRequestException(
        `上传解析失败: ${(err as Error)?.message || '未知错误'}`,
      );
    }

    if (!fileBuffer || !mimetype) {
      throw new BadRequestException('请选择要上传的图片');
    }

    const data = await this.memoryService.createMemory(user.sub, {
      buffer: fileBuffer,
      mimetype,
      originalName,
      title: fields.title,
      location: fields.location,
      takenAt: fields.takenAt,
    });

    return { code: 0, data };
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const data = await this.memoryService.listMemories(
      user.sub,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 30,
    );
    return { code: 0, data };
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.memoryService.deleteMemory(user.sub, id);
    return { code: 0, data: null };
  }
}
