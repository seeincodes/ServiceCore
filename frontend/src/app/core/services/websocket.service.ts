import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';

export interface WsEvent {
  type: string;
  data: any;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private events$ = new Subject<WsEvent>();

  constructor(private authService: AuthService) {}

  ngOnDestroy(): void {
    this.disconnect();
  }

  connect(): void {
    if (this.socket?.connected) return;

    const token = this.authService.getToken();
    if (!token) return;

    this.socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('clock_in', (data) => {
      this.events$.next({ type: 'clock_in', data });
    });

    this.socket.on('clock_out', (data) => {
      this.events$.next({ type: 'clock_out', data });
    });

    this.socket.on('ot_alert', (data) => {
      this.events$.next({ type: 'ot_alert', data });
    });

    this.socket.on('sync_error', (data) => {
      this.events$.next({ type: 'sync_error', data });
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  getEvents(): Observable<WsEvent> {
    return this.events$.asObservable();
  }

  getEventsByType(type: string): Observable<WsEvent> {
    return new Observable((subscriber) => {
      const sub = this.events$.subscribe((event) => {
        if (event.type === type) {
          subscriber.next(event);
        }
      });
      return () => sub.unsubscribe();
    });
  }
}
