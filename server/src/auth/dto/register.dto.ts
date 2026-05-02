import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional, IsBoolean } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @IsString()
  @MinLength(2, { message: '用户名至少 2 个字符' })
  @MaxLength(50, { message: '用户名最多 50 个字符' })
  username: string;

  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(128, { message: '密码最多 128 位' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: '密码需包含字母和数字',
  })
  password: string;

  @IsString()
  @MinLength(6, { message: '验证码为 6 位' })
  @MaxLength(6, { message: '验证码为 6 位' })
  captcha: string;

  @IsBoolean({ message: '请同意用户协议' })
  agreeToTerms: boolean;
}
