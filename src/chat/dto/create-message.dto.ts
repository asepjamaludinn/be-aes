import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  encryptedContent: string;

  @IsString()
  @IsNotEmpty()
  iv: string;

  @IsString()
  @IsNotEmpty()
  wrappedKey: string;

  @IsUUID()
  @IsNotEmpty()
  senderId: string;

  @IsOptional()
  @IsUUID()
  recipientId?: string;
}
