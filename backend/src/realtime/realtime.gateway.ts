import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { DeepgramService, DeepgramSession } from '../shared/deepgram.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/realtime',
})
@Injectable()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private userRooms = new Map<string, Set<string>>();
  // Continuous-listening voice sessions (Phase 3), keyed by socket id. Lives only in
  // memory — a session is inherently tied to one live connection's open mic, nothing
  // here needs to survive a reconnect or be queried by anything else.
  private voiceSessions = new Map<string, DeepgramSession>();

  @WebSocketServer()
  server!: Server;

  constructor(private config: ConfigService, private deepgram: DeepgramService) {}

  afterInit(server: Server) {
    this.logger.log('Socket.IO gateway initialized');
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    if (!token) {
      this.logger.warn(`Client ${client.id} connected without token, disconnecting`);
      client.disconnect();
      return;
    }

    try {
      const payload = this.verifyToken(token as string);
      const userId = payload.sub || payload.id;
      const tenantId = payload.tenantId || 'default';

      client.data.userId = userId;
      client.data.tenantId = tenantId;

      client.join(`user:${userId}`);
      client.join(`tenant:${tenantId}`);

      if (!this.userRooms.has(userId)) {
        this.userRooms.set(userId, new Set());
      }
      this.userRooms.get(userId)!.add(client.id);

      this.logger.log(`Client ${client.id} connected (user: ${userId}, tenant: ${tenantId})`);
      client.emit('connected', { userId, tenantId });
    } catch (err: any) {
      this.logger.warn(`Client ${client.id} auth failed: ${err.message}`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId && this.userRooms.has(userId)) {
      this.userRooms.get(userId)!.delete(client.id);
      if (this.userRooms.get(userId)!.size === 0) {
        this.userRooms.delete(userId);
      }
    }
    // A dropped connection means a dropped mic — never leave a Deepgram session
    // (and its billing) running past the socket that was feeding it audio.
    this.voiceSessions.get(client.id)?.close();
    this.voiceSessions.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected`);
  }

  /** Opens a continuous-listening voice session for this connection. One active
   * session per socket — starting a new one closes whatever was already open. */
  @SubscribeMessage('voice:start')
  handleVoiceStart(@ConnectedSocket() client: Socket) {
    if (!this.deepgram.isConfigured()) {
      client.emit('voice:error', { message: 'Continuous listening is not configured on this server.' });
      return;
    }
    this.voiceSessions.get(client.id)?.close();
    try {
      const session = this.deepgram.connect(
        (text) => client.emit('voice:transcript', { text }),
        (err) => client.emit('voice:error', { message: err.message }),
        (text) => client.emit('voice:interim', { text }),
      );
      this.voiceSessions.set(client.id, session);
      client.emit('voice:started', {});
    } catch (err: any) {
      client.emit('voice:error', { message: err.message || 'Failed to start voice session' });
    }
  }

  /** Raw PCM16 mic audio chunks, forwarded straight to the open Deepgram session. */
  @SubscribeMessage('voice:audio')
  handleVoiceAudio(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const session = this.voiceSessions.get(client.id);
    if (!session) return;
    session.sendAudio(Buffer.isBuffer(data) ? data : Buffer.from(data));
  }

  @SubscribeMessage('voice:stop')
  handleVoiceStop(@ConnectedSocket() client: Socket) {
    this.voiceSessions.get(client.id)?.close();
    this.voiceSessions.delete(client.id);
  }

  emit(event: string, data: any) {
    this.server?.emit(event, data);
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }

  emitToTenant(tenantId: string, event: string, data: any) {
    this.server?.to(`tenant:${tenantId}`).emit(event, data);
  }

  emitToRoom(room: string, event: string, data: any) {
    this.server?.to(room).emit(event, data);
  }

  private verifyToken(token: string): any {
    const jwt = require('jsonwebtoken');
    const secret = this.config.get<string>('JWT_SECRET') || 'secret';
    return jwt.verify(token, secret);
  }
}
