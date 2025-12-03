import { IsString, IsOptional, IsBooleanString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsBooleanString()
  removeAvatar?: string;
}
