// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../database/database.service';
import { CreateMessageDto } from './dto/create-message.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @MessageBody() data: { room_id: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.room_id);
    this.logger.log(`Client ${client.id} joined room ${data.room_id}`);
  }

  @SubscribeMessage('hacker_join')
  handleHackerJoin(@ConnectedSocket() client: Socket) {
    client.join('hacker_room');
    this.logger.warn(`⚠️ HACKER ${client.id} monitoring traffic...`);
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('send_message')
  async handleSendMessage(@MessageBody() payload: CreateMessageDto) {
    this.logger.debug(`📨 Incoming Encrypted Packet from ${payload.sender_id}`);

    try {
      const savedMessage = await this.prisma.message.create({
        data: {
          roomId: payload.room_id,
          encryptedContent: payload.encrypted_content,
          iv: payload.iv,
          wrappedKey: payload.wrapped_key,
          senderId: payload.sender_id,
          recipientId: payload.recipient_id || null,
        },
        include: {
          sender: { select: { username: true } },
        },
      });

      this.logger.log(` Message Persisted ID: ${savedMessage.id}`);

      const responsePayload = {
        id: savedMessage.id,
        room_id: savedMessage.roomId,
        encrypted_content: savedMessage.encryptedContent,
        iv: savedMessage.iv,
        wrapped_key: savedMessage.wrappedKey,
        sender_id: savedMessage.senderId,
        sender_name: savedMessage.sender.username,
        created_at: savedMessage.createdAt.toISOString(),
      };

      this.server.to(payload.room_id).emit('receive_message', responsePayload);

      this.server.to('hacker_room').emit('intercept_feed', {
        ...responsePayload,
        status: 'captured',
      });
    } catch (error) {
      this.logger.error(`❌ Database Error: ${error.message}`, error.stack);

      throw new WsException('Failed to process message');
    }
  }
}
