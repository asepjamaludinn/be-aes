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
import {
  Logger,
  UsePipes,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/database.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtService } from '@nestjs/jwt';

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
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`🟡 Client attempting connection: ${client.id}`);
    try {
      const token = client.handshake.auth.token;
      if (!token) throw new UnauthorizedException('No token provided');
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
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
    @MessageBody() data: { room_id: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.room_id);
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
      sender: payload.sender_id,
      recipient: payload.recipient_id,
      timestamp: new Date().toISOString(),
      size: payload.encrypted_content.length,
      room_id: payload.room_id,
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
          roomId: payload.room_id,
          encryptedContent: payload.encrypted_content,
          iv: payload.iv,
          wrappedKey: payload.wrapped_key,
          senderId: payload.sender_id,
          recipientId: payload.recipient_id || null,
        },
        include: {
          sender: { select: { username: true, avatarUrl: true } },
        },
      });

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

      if (payload.recipient_id) {
        this.server.to(payload.recipient_id).emit('update_conversation_list', {
          ...responsePayload,
          sender_avatar: savedMessage.sender.avatarUrl,
        });
      }
    } catch (error) {
      this.logger.error(`❌ Database Error: ${error.message}`);
    }
  }
}
