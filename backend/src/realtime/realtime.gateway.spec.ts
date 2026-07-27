import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeGateway } from './realtime.gateway';
import { ConfigService } from '@nestjs/config';
import { DeepgramService } from '../shared/deepgram.service';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let configService: jest.Mocked<ConfigService>;

  const mockConfigService = {
    get: jest.fn(),
  };
  const mockDeepgramService = {
    isConfigured: jest.fn().mockReturnValue(false),
    connect: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDeepgramService.isConfigured.mockReturnValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DeepgramService, useValue: mockDeepgramService },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('emit', () => {
    it('should emit an event without error', () => {
      mockConfigService.get.mockReturnValue('false');

      expect(() => gateway.emit('lead:new', { id: 'lead-1' })).not.toThrow();
    });

    it('should not throw when REALTIME_ENABLED is true', () => {
      mockConfigService.get.mockReturnValue('true');

      expect(() => gateway.emit('lead:scored', { id: 'lead-1', score: 85 })).not.toThrow();
    });

    it('should accept various event names', () => {
      const events = ['lead:new', 'lead:scored', 'lead:updated', 'conversation:new', 'failure:new'];
      for (const event of events) {
        expect(() => gateway.emit(event, { test: true })).not.toThrow();
      }
    });

    it('should accept null data gracefully', () => {
      mockConfigService.get.mockReturnValue('false');
      expect(() => gateway.emit('lead:new', null)).not.toThrow();
    });

    it('should accept undefined data gracefully', () => {
      expect(() => gateway.emit('lead:new', undefined)).not.toThrow();
    });

    it('should emit multiple events in sequence without error', () => {
      expect(() => {
        gateway.emit('lead:new', { id: '1' });
        gateway.emit('lead:updated', { id: '1', name: 'Updated' });
        gateway.emit('conversation:new', { conversationId: 'conv-1' });
      }).not.toThrow();
    });

    it('should handle numeric data payloads', () => {
      expect(() => gateway.emit('lead:scored', 42)).not.toThrow();
    });

    it('should handle array data payloads', () => {
      expect(() => gateway.emit('leads:batch', [{ id: '1' }, { id: '2' }])).not.toThrow();
    });

    it('should handle complex nested objects', () => {
      const complexData = {
        lead: { id: 'lead-1', contact: { name: 'John', email: 'john@test.com' } },
        metadata: { source: 'form', timestamp: new Date().toISOString() },
        tags: ['premium', 'new'],
      };
      expect(() => gateway.emit('lead:new', complexData)).not.toThrow();
    });
  });

  describe('emitToRoom', () => {
    it('should emit an event to a specific room without error', () => {
      expect(() => gateway.emitToRoom('tenant-1', 'lead:new', { id: 'lead-1' })).not.toThrow();
    });

    it('should handle different room names', () => {
      const rooms = ['tenant-1', 'user-42', 'campaign-7', 'global'];
      for (const room of rooms) {
        expect(() => gateway.emitToRoom(room, 'lead:updated', { id: '1' })).not.toThrow();
      }
    });

    it('should accept a room name with special characters', () => {
      expect(() => gateway.emitToRoom('tenant:abc-123_def', 'lead:new', {})).not.toThrow();
    });

    it('should handle empty room name gracefully', () => {
      expect(() => gateway.emitToRoom('', 'lead:new', {})).not.toThrow();
    });

    it('should handle empty event name gracefully', () => {
      expect(() => gateway.emitToRoom('tenant-1', '', {})).not.toThrow();
    });

    it('should be callable multiple times in succession', () => {
      for (let i = 0; i < 5; i++) {
        gateway.emitToRoom(`tenant-${i}`, 'lead:new', { id: `lead-${i}` });
      }
      // No throw is the assertion
      expect(true).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should have a logger instance', () => {
      expect(gateway['logger']).toBeDefined();
    });

    it('should accept ConfigService in constructor', () => {
      expect(gateway['config']).toBeDefined();
      expect(gateway['config']).toBe(configService);
    });
  });

  describe('voice sessions (Phase 3: continuous listening)', () => {
    function fakeClient(id = 'socket-1') {
      return { id, emit: jest.fn() } as any;
    }

    it('refuses to start a session and tells the client when Deepgram is not configured', () => {
      mockDeepgramService.isConfigured.mockReturnValue(false);
      const client = fakeClient();

      gateway.handleVoiceStart(client);

      expect(client.emit).toHaveBeenCalledWith('voice:error', expect.objectContaining({ message: expect.any(String) }));
      expect(mockDeepgramService.connect).not.toHaveBeenCalled();
    });

    it('opens a Deepgram session and confirms it to the client when configured', () => {
      mockDeepgramService.isConfigured.mockReturnValue(true);
      const fakeSession = { sendAudio: jest.fn(), close: jest.fn() };
      mockDeepgramService.connect.mockReturnValue(fakeSession);
      const client = fakeClient();

      gateway.handleVoiceStart(client);

      expect(client.emit).toHaveBeenCalledWith('voice:started', {});
      expect(gateway['voiceSessions'].get(client.id)).toBe(fakeSession);
    });

    it('forwards audio chunks only to a session that actually exists for that socket', () => {
      const client = fakeClient();
      // No session started — must not throw just because audio arrived anyway
      // (e.g. a stray frame after voice:stop already fired).
      expect(() => gateway.handleVoiceAudio(client, Buffer.from([1, 2, 3]))).not.toThrow();

      mockDeepgramService.isConfigured.mockReturnValue(true);
      const fakeSession = { sendAudio: jest.fn(), close: jest.fn() };
      mockDeepgramService.connect.mockReturnValue(fakeSession);
      gateway.handleVoiceStart(client);

      gateway.handleVoiceAudio(client, Buffer.from([4, 5, 6]));
      expect(fakeSession.sendAudio).toHaveBeenCalledWith(Buffer.from([4, 5, 6]));
    });

    it('closes and forgets the session on voice:stop', () => {
      mockDeepgramService.isConfigured.mockReturnValue(true);
      const fakeSession = { sendAudio: jest.fn(), close: jest.fn() };
      mockDeepgramService.connect.mockReturnValue(fakeSession);
      const client = fakeClient();
      gateway.handleVoiceStart(client);

      gateway.handleVoiceStop(client);

      expect(fakeSession.close).toHaveBeenCalled();
      expect(gateway['voiceSessions'].has(client.id)).toBe(false);
    });

    it('closes a dangling session on disconnect — a dropped socket must not leave Deepgram billing for a dead mic', () => {
      mockDeepgramService.isConfigured.mockReturnValue(true);
      const fakeSession = { sendAudio: jest.fn(), close: jest.fn() };
      mockDeepgramService.connect.mockReturnValue(fakeSession);
      const client = fakeClient();
      gateway.handleVoiceStart(client);

      gateway.handleDisconnect(client);

      expect(fakeSession.close).toHaveBeenCalled();
      expect(gateway['voiceSessions'].has(client.id)).toBe(false);
    });

    it('starting a new session for the same socket closes whatever was already open', () => {
      mockDeepgramService.isConfigured.mockReturnValue(true);
      const firstSession = { sendAudio: jest.fn(), close: jest.fn() };
      const secondSession = { sendAudio: jest.fn(), close: jest.fn() };
      mockDeepgramService.connect.mockReturnValueOnce(firstSession).mockReturnValueOnce(secondSession);
      const client = fakeClient();

      gateway.handleVoiceStart(client);
      gateway.handleVoiceStart(client);

      expect(firstSession.close).toHaveBeenCalled();
      expect(gateway['voiceSessions'].get(client.id)).toBe(secondSession);
    });
  });
});
