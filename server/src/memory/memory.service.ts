import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

interface SaveMemoryInput {
  buffer: Buffer;
  mimetype: string;
  originalName?: string;
  title?: string;
  location?: string;
  takenAt?: string;
}

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private readonly uploadsRoot = join(__dirname, '..', '..', 'uploads', 'memories');

  constructor(private prisma: PrismaService) {}

  async createMemory(userId: string, input: SaveMemoryInput) {
    if (!input.buffer || input.buffer.length === 0) {
      throw new BadRequestException('请选择要上传的图片');
    }
    if (input.buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException('图片大小不能超过 10MB');
    }
    if (!ALLOWED_MIME.has(input.mimetype)) {
      throw new BadRequestException('仅支持 JPG / PNG / WEBP / GIF 格式');
    }

    const ext = this.pickExtension(input.mimetype, input.originalName);
    const filename = `${randomUUID()}${ext}`;
    const userDir = join(this.uploadsRoot, userId);
    const absolutePath = join(userDir, filename);

    await fs.mkdir(userDir, { recursive: true });
    await fs.writeFile(absolutePath, input.buffer);

    const imageUrl = `/uploads/memories/${userId}/${filename}`;

    const takenAt = this.parseDate(input.takenAt);

    try {
      const memory = await this.prisma.memory.create({
        data: {
          userId,
          imageUrl,
          title: (input.title || '').slice(0, 100),
          location: (input.location || '').slice(0, 100),
          takenAt,
          size: input.buffer.length,
        },
      });
      return this.serialize(memory);
    } catch (err) {
      // 数据库写入失败时清理已写盘的图片
      await fs.unlink(absolutePath).catch(() => undefined);
      throw err;
    }
  }

  async listMemories(userId: string, page = 1, pageSize = 30) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(60, Math.max(1, pageSize));

    const [total, items] = await Promise.all([
      this.prisma.memory.count({ where: { userId } }),
      this.prisma.memory.findMany({
        where: { userId },
        orderBy: [{ takenAt: 'desc' }, { createdAt: 'desc' }],
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
    ]);

    return {
      items: items.map((m) => this.serialize(m)),
      total,
      totalPages: Math.ceil(total / safePageSize),
      currentPage: safePage,
    };
  }

  async deleteMemory(userId: string, memoryId: string) {
    const memory = await this.prisma.memory.findUnique({
      where: { id: memoryId },
    });
    if (!memory) {
      throw new NotFoundException('图片不存在或已被删除');
    }
    if (memory.userId !== userId) {
      throw new ForbiddenException('无权删除他人的图片');
    }

    await this.prisma.memory.delete({ where: { id: memoryId } });

    // 物理删除文件（失败不影响业务，仅记录日志）
    const relative = memory.imageUrl.replace(/^\/uploads\//, '');
    const absolute = join(__dirname, '..', '..', 'uploads', relative);
    await fs.unlink(absolute).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') {
        this.logger.warn(`删除图片文件失败: ${absolute} ${err.message}`);
      }
    });

    return { success: true };
  }

  private serialize(memory: {
    id: string;
    imageUrl: string;
    title: string;
    location: string;
    takenAt: Date | null;
    width: number | null;
    height: number | null;
    size: number | null;
    createdAt: Date;
  }) {
    return {
      id: memory.id,
      imageUrl: memory.imageUrl,
      title: memory.title,
      location: memory.location,
      takenAt: memory.takenAt?.toISOString() || null,
      width: memory.width,
      height: memory.height,
      size: memory.size,
      createdAt: memory.createdAt.toISOString(),
    };
  }

  private pickExtension(mimetype: string, originalName?: string): string {
    const mapping: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    if (mapping[mimetype]) return mapping[mimetype];
    if (originalName) {
      const ext = extname(originalName).toLowerCase();
      if (/^\.(jpg|jpeg|png|webp|gif)$/.test(ext)) return ext;
    }
    return '.jpg';
  }

  private parseDate(value?: string): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
}
