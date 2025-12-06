import { Controller, Get, Param } from '@nestjs/common';
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
          user1: myUser,
          user2: otherUser,
          messages: [
            {
              id: msg.id,
              content: msg.encryptedContent,
              senderId: msg.senderId,
              createdAt: msg.createdAt,
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
      roomId: msg.roomId,
      encryptedContent: msg.encryptedContent,
      iv: msg.iv,
      wrappedKey: msg.wrappedKey,
      senderId: msg.senderId,
      senderName: msg.sender.username,
      createdAt: msg.createdAt,
    }));
  }
}
