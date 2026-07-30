import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { resolveSocketConfig } from '../lib/voiceSession';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const EVENT_BUFFER_MAX = 50;

// ── Types ────────────────────────────────────────────────────────────────────

export interface SocketEvent {
  type: string;
  payload: unknown;
  timestamp: number;
}

export interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  lastEvent: SocketEvent | null;
  eventBuffer: SocketEvent[];
}

// ── Context ──────────────────────────────────────────────────────────────────

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  lastEvent: null,
  eventBuffer: [],
});

// ── Provider ─────────────────────────────────────────────────────────────────

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SocketEvent | null>(null);
  const [eventBuffer, setEventBuffer] = useState<SocketEvent[]>([]);

  // Store the current token in state so we can react to changes.
  // Polling catches same-tab changes (setToken in api.ts writes to localStorage);
  // the 'storage' event catches cross-tab updates.
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  useEffect(() => {
    // Cross-tab: other tabs dispatch a StorageEvent when localStorage changes
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'token') setToken(e.newValue);
    };
    window.addEventListener('storage', onStorage);

    // Same-tab: poll for changes made via api.ts setToken()
    const pollId = setInterval(() => {
      const current = localStorage.getItem('token');
      setToken((prev) => (prev !== current ? current : prev));
    }, 3000);

    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(pollId);
    };
  }, []);

  useEffect(() => {
    // Tear down previous socket
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setConnected(false);
    }

    if (!token) return;

    // API_URL is sometimes a same-origin path prefix behind a reverse proxy (e.g.
    // '/api' in production) rather than an absolute origin — see voiceSession.ts's
    // resolveSocketConfig for why that breaks a plain io(`${API_URL}/realtime`) call
    // (wrong namespace, and the transport falls through to the SPA's static file
    // server instead of the backend). This hook had the identical bug.
    const socketConfig = resolveSocketConfig(API_URL);
    const s = io(socketConfig.url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      path: socketConfig.path,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    setSocket(s);

    // ── built-in events ──────────────────────────────────────────────

    const onConnect = () => {
      setConnected(true);
      console.warn('[Socket] Connected');

      // Join the authenticated user's personal room
      try {
        const raw = localStorage.getItem('user');
        if (raw) {
          const user = JSON.parse(raw);
          if (user?.id) {
            s.emit('join', { room: `user:${user.id}` });
            console.warn(`[Socket] Joined room: user:${user.id}`);
          }
        }
      } catch {
        console.warn('[Socket] Could not parse user for room join');
      }
    };

    const onDisconnect = (reason: string) => {
      setConnected(false);
      console.warn('[Socket] Disconnected:', reason);
    };

    const onConnectError = (err: Error) => {
      console.warn('[Socket] Connection error:', err.message);
    };

    // ── generic event capture ─────────────────────────────────────────

    const onAnyEvent = (event: string, ...args: unknown[]) => {
      const payload = args[0];
      const entry: SocketEvent = {
        type: event,
        payload,
        timestamp: Date.now(),
      };

      console.warn(`[Socket] Event: ${event}`, payload);

      setLastEvent(entry);
      setEventBuffer((prev) => [...prev.slice(-(EVENT_BUFFER_MAX - 1)), entry]);
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    s.onAny(onAnyEvent);

    // ── cleanup on unmount or token change ────────────────────────────

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.offAny(onAnyEvent);
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <SocketContext.Provider
      value={{ socket, connected, lastEvent, eventBuffer }}
    >
      {children}
    </SocketContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error('useSocket() must be used within a <SocketProvider>');
  }
  return ctx;
}
