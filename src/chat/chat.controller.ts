import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../database/database.service';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':roomId')
  async getChatHistory(@Param('roomId') roomId: string) {
    const messages = await this.prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, username: true } },
      },
    });

    return messages.map((msg) => ({
      id: msg.id,
      room_id: msg.roomId,
      encrypted_content: msg.encryptedContent,
      iv: msg.iv,
      wrapped_key: msg.wrappedKey,
      sender_id: msg.senderId,
      sender_name: msg.sender.username,
      created_at: msg.createdAt,
    }));
  }
}
