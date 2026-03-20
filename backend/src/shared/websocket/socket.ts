import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { AuthenticatedUser } from '../types';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

let io: Server | null = null;

export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as AuthenticatedUser;
    const orgChannel = `org_${user.orgId}`;

    socket.join(orgChannel);
    logger.info('WebSocket connected', { userId: user.id, orgId: user.orgId, channel: orgChannel });

    socket.on('disconnect', () => {
      logger.info('WebSocket disconnected', { userId: user.id });
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('WebSocket not initialized');
  }
  return io;
}

export function emitToOrg(orgId: string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`org_${orgId}`).emit(event, data);
}
