import { IsString, IsOptional, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsString()
  @MinLength(1, { message: '消息内容不能为空' })
  content: string;
}
