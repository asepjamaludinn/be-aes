import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  room_id: string;

  @IsString()
  @IsNotEmpty()
  encrypted_content: string;

  @IsString()
  @IsNotEmpty()
  iv: string;

  @IsString()
  @IsNotEmpty()
  wrapped_key: string;

  @IsUUID()
  @IsNotEmpty()
  sender_id: string;

  @IsOptional()
  @IsString()
  recipient_id?: string;
}
