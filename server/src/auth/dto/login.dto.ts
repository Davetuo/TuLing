import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: '请输入账号' })
  account: string;

  @IsString()
  @IsNotEmpty({ message: '请输入密码' })
  password: string;
}
