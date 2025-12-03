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
    this.logger.log(`🟢 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔴 Client disconnected: ${client.id}`);
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

  @SubscribeMessage('admin_join')
  handleAdminJoin(@ConnectedSocket() client: Socket) {
    client.join('admin_room');
    this.logger.log(`🛡️ ADMIN ${client.id} start monitoring system.`);
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('hacker_inject_message')
  async handleHackerInjection(@MessageBody() payload: CreateMessageDto) {
    this.logger.warn(
      `⚠️ MITM ATTACK DETECTED: Injection from Hacker to Room ${payload.room_id}`,
    );

    const fakePayload = {
      id: crypto.randomUUID(),
      room_id: payload.room_id,
      encrypted_content: payload.encrypted_content,
      iv: payload.iv,
      wrapped_key: payload.wrapped_key,
      sender_id: payload.sender_id,
      sender_name: 'Unknown (Spoofed)',
      created_at: new Date().toISOString(),
    };

    this.server.to(payload.room_id).emit('receive_message', fakePayload);

    this.server.to('hacker_room').emit('attack_log', {
      status: 'INJECTED',
      target_room: payload.room_id,
      timestamp: new Date().toISOString(),
      details: 'Malicious payload delivered to targets.',
    });

    this.server.to('admin_room').emit('security_alert', {
      type: 'MITM_INJECTION',
      severity: 'HIGH',
      details: `Detected malicious packet injection in Room ${payload.room_id}`,
      timestamp: new Date().toISOString(),
    });
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

      this.server.to('admin_room').emit('traffic_log', {
        type: 'MESSAGE_EXCHANGE',
        room_id: payload.room_id,
        size: payload.encrypted_content.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`❌ Database Error: ${error.message}`, error.stack);
      throw new WsException('Failed to process message');
    }
  }
}
