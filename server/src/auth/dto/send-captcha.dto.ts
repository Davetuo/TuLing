import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendCaptchaDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @IsNotEmpty({ message: '请输入邮箱地址' })
  email: string;
}
