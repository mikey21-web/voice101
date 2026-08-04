import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MfaService } from './mfa.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EmailAdapter } from '../shared/adapters/email.adapter';
import { PosthogService } from '../posthog/posthog.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  const auditLogs = { log: jest.fn().mockResolvedValue({}) };
  const emailAdapter = { send: jest.fn().mockResolvedValue({ success: true }) };
  const posthog = { identify: jest.fn(), capture: jest.fn() };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: '$2b$12$hashedpassword',
    name: 'Test User',
    role: 'SALES_AGENT',
    active: true,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'OWNER' }),
        create: jest.fn(),
        update: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('test-jwt-token'),
      verify: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        MfaService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: AuditLogsService, useValue: auditLogs },
        { provide: EmailAdapter, useValue: emailAdapter },
        { provide: PosthogService, useValue: posthog },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test') } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a new user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const result: any = await service.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.accessToken).toBe('test-jwt-token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe('SALES_AGENT');
    });

    it('should reject duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({ email: 'test@example.com', password: 'password123', name: 'Test' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      // Cost 1, not 12. bcryptjs is pure JS, so a cost-12 hash under parallel
      // jest workers can exceed the default 5s timeout on a loaded machine.
      // bcrypt.compare does not care what cost produced the hash, and the
      // production cost lives in auth.service.ts where it belongs.
      const hashed = await bcrypt.hash('password123', 1);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, password: hashed, mfaEnabled: false });

      const result: any = await service.login({ email: 'test@example.com', password: 'password123' });
      expect(result.accessToken).toBe('test-jwt-token');
    });

    it('should reject wrong password', async () => {
      const hashed = await bcrypt.hash('password123', 1);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, password: hashed, mfaEnabled: false });

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    }, 10000);

    it('should reject non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@example.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
