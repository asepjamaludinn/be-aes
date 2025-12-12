import {
  Controller,
  Get,
  Param,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/database.service';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats/dashboard')
  async getDashboardStats() {
    const totalMessages = await this.prisma.message.count();
    const totalAttacks = await this.prisma.systemLog.count({
      where: { type: 'error' },
    });

    return {
      messages: totalMessages,
      attacks: totalAttacks,
    };
  }

  @Get('logs/system')
  async getSystemLogs() {
    const logs = await this.prisma.systemLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      details: log.details,
      timestamp: log.createdAt,
      type: log.type,
    }));
  }

  @Delete('logs/system')
  async clearSystemLogs() {
    await this.prisma.systemLog.deleteMany();
    return { message: 'All system logs cleared successfully' };
  }

  @Delete('room/:roomId')
  async deleteChatHistory(@Param('roomId') roomId: string) {
    const count = await this.prisma.message.count({
      where: { roomId },
    });

    if (count === 0) {
      throw new NotFoundException('Chat history not found or already empty');
    }

    await this.prisma.message.deleteMany({
      where: { roomId },
    });

    return { message: 'Chat history deleted successfully' };
  }

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
