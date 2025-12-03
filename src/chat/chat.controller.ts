import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/database.service';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('conversations/:userId')
  async getUserConversations(@Param('userId') userId: string) {
    const conversations = await this.prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['roomId'],
      include: {
        sender: {
          select: { id: true, username: true, avatarUrl: true, phone: true },
        },
        recipient: {
          select: { id: true, username: true, avatarUrl: true, phone: true },
        },
      },
    });

    return conversations
      .map((msg) => {
        const isMeSender = msg.senderId === userId;
        const otherUser = isMeSender ? msg.recipient : msg.sender;
        const myUser = isMeSender ? msg.sender : msg.recipient;

        if (!otherUser || !myUser) return null;

        return {
          id: msg.roomId,
          user_1: myUser,
          user_2: otherUser,
          messages: [
            {
              id: msg.id,
              content: msg.encryptedContent,
              sender_id: msg.senderId,
              created_at: msg.createdAt,
            },
          ],
        };
      })
      .filter(Boolean);
  }

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
