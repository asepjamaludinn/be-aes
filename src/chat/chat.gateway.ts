import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  Logger,
  UsePipes,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/database.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
let IS_MITM_ACTIVE = false;

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`🟡 Client attempting connection: ${client.id}`);
    try {
      const token = client.handshake.auth.token;
      if (!token) throw new UnauthorizedException('No token provided');

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const userId = payload.sub || payload.id;
      client.join(userId);
      this.logger.log(`🟢 User Authenticated: ${userId}`);
    } catch (error) {
      this.logger.error(`🔴 Connection Rejected: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔴 Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.roomId);
  }

  @SubscribeMessage('hacker_join')
  handleHackerJoin(@ConnectedSocket() client: Socket) {
    client.join('hacker_room');

    client.emit('mitm_status', { active: IS_MITM_ACTIVE });
    this.logger.warn(`⚠️ HACKER ${client.id} joined.`);
  }

  @SubscribeMessage('admin_join')
  handleAdminJoin(@ConnectedSocket() client: Socket) {
    client.join('admin_room');
  }

  @SubscribeMessage('toggle_mitm')
  handleToggleMitm(@MessageBody() data: { active: boolean }) {
    IS_MITM_ACTIVE = data.active;
    this.server
      .to('hacker_room')
      .emit('mitm_status', { active: IS_MITM_ACTIVE });
    this.logger.warn(
      `⚠️ MITM INTERCEPTION MODE: ${IS_MITM_ACTIVE ? 'ON' : 'OFF'}`,
    );
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('send_message')
  async handleSendMessage(@MessageBody() payload: CreateMessageDto) {
    this.logger.debug(`📨 Incoming Packet. MITM Active: ${IS_MITM_ACTIVE}`);

    this.server.to('hacker_room').emit('metadata_log', {
      sender: payload.senderId,
      recipient: payload.recipientId,
      timestamp: new Date().toISOString(),
      size: payload.encryptedContent.length,
      roomId: payload.roomId,
    });

    if (IS_MITM_ACTIVE) {
      this.logger.warn(`🛑 Message Intercepted! Holding for Hacker review.`);

      this.server.to('hacker_room').emit('intercepted_packet', {
        ...payload,
        original_id: crypto.randomUUID(),
      });

      return;
    }

    await this.processAndDeliverMessage(payload);
  }

  @SubscribeMessage('hacker_forward_message')
  async handleHackerForward(@MessageBody() payload: CreateMessageDto) {
    this.logger.warn(`💀 Hacker forwarding (potentially tampered) message...`);
    await this.processAndDeliverMessage(payload);
  }

  private async processAndDeliverMessage(payload: CreateMessageDto) {
    try {
      const savedMessage = await this.prisma.message.create({
        data: {
          roomId: payload.roomId,
          encryptedContent: payload.encryptedContent,
          iv: payload.iv,
          wrappedKey: payload.wrappedKey,
          senderId: payload.senderId,
          recipientId: payload.recipientId || null,
        },
        include: {
          sender: { select: { username: true, avatarUrl: true } },
        },
      });

      const responsePayload = {
        id: savedMessage.id,
        roomId: savedMessage.roomId,
        encryptedContent: savedMessage.encryptedContent,
        iv: savedMessage.iv,
        wrappedKey: savedMessage.wrappedKey,
        senderId: savedMessage.senderId,
        sender_name: savedMessage.sender.username,
        created_at: savedMessage.createdAt.toISOString(),
      };

      this.server.to(payload.roomId).emit('receive_message', responsePayload);

      if (payload.recipientId) {
        this.server.to(payload.recipientId).emit('update_conversation_list', {
          ...responsePayload,
          sender_avatar: savedMessage.sender.avatarUrl,
        });
      }
    } catch (error) {
      this.logger.error(`❌ Database Error: ${error.message}`);
    }
  }
}
