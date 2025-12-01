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
import { PrismaService } from '../database/database.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @MessageBody() data: { room_id: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.room_id);
    console.log(`Client ${client.id} joined room ${data.room_id}`);
  }

  @SubscribeMessage('hacker_join')
  handleHackerJoin(@ConnectedSocket() client: Socket) {
    client.join('hacker_room');
    console.log(`⚠️ HACKER ${client.id} monitoring traffic...`);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(@MessageBody() payload: any) {
    console.log('📨 Encrypted Packet Relayed');

    this.server.to(payload.room_id).emit('receive_message', {
      id: crypto.randomUUID(),
      ...payload,
    });

    this.server.to('hacker_room').emit('intercept_feed', {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...payload,
    });
  }
}
