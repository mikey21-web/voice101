import { Injectable, UnauthorizedException, ForbiddenException, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { EmailAdapter } from '../shared/adapters/email.adapter';
import { MfaService } from './mfa.service';
import { PosthogService } from '../posthog/posthog.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { tenantConnect } from '../shared/tenant-helper';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditLogs: AuditLogsService,
    private emailAdapter: EmailAdapter,
    private mfa: MfaService,
    private posthog: PosthogService,
  ) {}

  async register(dto: RegisterDto, req?: any) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new UnauthorizedException('Email already registered');

    // Registration is admin/invite-only in single-tenant mode
    const adminUser = await this.prisma.user.findFirst({ where: { role: 'OWNER' } });
    if (!adminUser) throw new ForbiddenException('No admin exists. Registration unavailable');

    const hashed = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        phone: dto.phone,
        password: hashed,
        role: 'SALES_AGENT',
        ...tenantConnect(req),
      },
    });

    // Send verification email
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        email: user.email,
        tokenHash: verifyHash,
        expiresAt: new Date(Date.now() + 48 * 3600000), // 48 hours
      },
    });
    const verifyUrl = `${process.env.DASHBOARD_URL || 'http://localhost:3000'}/verify-email?token=${verifyToken}`;
    const result = await this.emailAdapter.send(
      user.email,
      'Verify your email address',
      `<p>Welcome! Please verify your email by clicking <a href="${verifyUrl}">here</a>.</p><p>This link expires in 48 hours.</p>`,
    );
    if (!result.success) {
      this.logger.error(`Failed to send verification email to ${user.email}: ${result.error}`);
    }

    await this.auditLogs.log('user_registered', 'User', user.id, user.id);
    this.posthog.identify(user.id, { email: user.email, name: user.name, role: user.role });
    this.posthog.capture('user_signed_up', user.id, { role: user.role });
    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.active) throw new UnauthorizedException('Invalid credentials');

    // Check account lockout
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const remaining = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(`Account locked. Try again in ${remaining} minute(s).`);
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      // Increment failed attempts
      const attempts = user.failedLoginAttempts + 1;
      const lockoutUntil = attempts >= 5
        ? new Date(Date.now() + 15 * 60000) // 15 min lockout after 5 failures
        : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: attempts, lockoutUntil },
      });
      this.logger.warn(`Failed login for ${dto.email} (attempt ${attempts})`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset lockout on success
    if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockoutUntil: null },
      });
    }

    await this.auditLogs.log('user_login', 'User', user.id, user.id);

    this.posthog.identify(user.id, { email: user.email, name: user.name, role: user.role, tenantId: user.tenantId });
    this.posthog.capture('user_logged_in', user.id, { role: user.role });

    // If MFA is enabled, issue a short-lived challenge token instead
    if (user.mfaEnabled) {
      const mfaToken = this.mfa.generateMfaChallengeToken(user.id);
      return { requireMfa: true, mfaToken, user: { id: user.id, email: user.email, role: user.role, name: user.name } };
    }

    return this.generateTokens(user);
  }

  async mfaChallenge(mfaToken: string, code: string) {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwtService.verify(mfaToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }
    if (payload.purpose !== 'mfa_challenge') throw new UnauthorizedException('Invalid MFA token purpose');

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active || !user.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('MFA not configured');
    }

    const isValid = await this.mfa.verifyToken(user.mfaSecret, code);
    if (!isValid) throw new UnauthorizedException('Invalid MFA code');

    return this.generateTokens(user);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user || !user.active) return { message: 'If the email exists, a reset link has been sent.' };

    // Invalidate old tokens for this email
    await this.prisma.passwordResetToken.updateMany({
      where: { email, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await this.prisma.passwordResetToken.create({
      data: { email, tokenHash, expiresAt: new Date(Date.now() + 3600000) }, // 1 hour
    });

    const resetUrl = `${process.env.DASHBOARD_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    const result = await this.emailAdapter.send(
      email,
      'Reset your password',
      `<p>You requested a password reset.</p><p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p><p>If you didn't request this, please ignore this email.</p>`,
    );

    if (!result.success) {
      this.logger.error(`Failed to send reset email to ${email}: ${result.error}`);
    }

    return { message: 'If the email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });

    if (!resetToken) throw new UnauthorizedException('Invalid or expired reset token');

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { email: resetToken.email },
      data: { password: hashed },
    });

    await this.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    await this.auditLogs.log('password_reset', 'User', undefined, undefined, undefined, { email: resetToken.email });

    return { message: 'Password reset successfully.' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const verifyToken = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });

    if (!verifyToken) throw new BadRequestException('Invalid or expired verification token');

    await this.prisma.user.update({
      where: { email: verifyToken.email },
      data: { emailVerifiedAt: new Date() },
    });

    await this.prisma.passwordResetToken.update({
      where: { id: verifyToken.id },
      data: { usedAt: new Date() },
    });

    return { message: 'Email verified successfully.' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new UnauthorizedException('User not found');
    const { password, ...rest } = user;
    return rest;
  }

  async refresh(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });

    if (!stored) throw new UnauthorizedException('Invalid or expired refresh token');

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.active) throw new UnauthorizedException('User account is inactive');

    // Revoke old refresh token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.generateTokens(user);
  }

  async logout(userId: string): Promise<{ message: string }> {
    // Revoke all active refresh tokens for this user
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.auditLogs.log('user_logout', 'User', userId, userId);
    return { message: 'Logged out successfully.' };
  }

  private async generateTokens(user: { id: string; email: string; role: string; tenantId?: string; name?: string | null }) {
    const jti = crypto.randomUUID();

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role, jti, tenantId: user.tenantId },
      { expiresIn: '24h' },
    );

    const refreshTokenRaw = crypto.randomBytes(48).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshTokenRaw).digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
    };
  }
}
