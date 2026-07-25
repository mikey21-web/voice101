import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailAdapter } from '../shared/adapters/email.adapter';
import { ModulePermissionsService } from '../module-permissions/module-permissions.service';
import { getTenantId } from '../shared/tenant-helper';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

const INVITE_TTL_DAYS = 7;

/**
 * Real team invites: the invitee sets their own password via a tokenized
 * link, with role + per-module permissions captured at invite time and
 * applied the moment they accept. Replaces the old flow where an admin had
 * to type a password in for someone else (and which POST /users silently
 * required but the "Invite" UI never sent, so every invite 400'd).
 */
@Injectable()
export class TeamInvitesService {
  constructor(
    private prisma: PrismaService,
    private email: EmailAdapter,
    private permissions: ModulePermissionsService,
  ) {}

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  async create(data: { name: string; email: string; role?: string; department?: string; moduleGrants?: Record<string, string> }, req?: any) {
    const role = data.role || 'SALES_AGENT';
    // Same escalation guard as direct user creation — an ADMIN shouldn't be
    // able to invite themselves or anyone else in as OWNER/ADMIN.
    if ((role === 'OWNER' || role === 'ADMIN') && req?.user?.role !== 'OWNER') {
      throw new ForbiddenException('Only an OWNER can invite OWNER or ADMIN accounts');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) throw new ConflictException('A user with this email already exists');

    const existingInvite = await this.prisma.teamInvite.findFirst({ where: { email: data.email, status: 'PENDING' } });
    if (existingInvite) throw new ConflictException('An invite is already pending for this email');

    const tenantId = getTenantId(req);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const invite = await this.prisma.teamInvite.create({
      data: {
        tenantId,
        name: data.name,
        email: data.email,
        role,
        department: data.department,
        moduleGrants: data.moduleGrants || {},
        token: this.hashToken(rawToken),
        status: 'PENDING',
        invitedById: req?.user?.sub,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    await this.sendInviteEmail(invite, rawToken);
    return this.toSafeShape(invite);
  }

  private async sendInviteEmail(invite: { name: string; email: string }, rawToken: string) {
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
    const acceptUrl = `${dashboardUrl}/#/accept-invite/${rawToken}`;
    const html = `
      <p>Hi ${invite.name},</p>
      <p>You've been invited to join the workspace. Click below to set up your account:</p>
      <p><a href="${acceptUrl}">${acceptUrl}</a></p>
      <p>This link expires in ${INVITE_TTL_DAYS} days.</p>
    `;
    const result = await this.email.send(invite.email, "You're invited to join the workspace", html);
    if (!result.success) {
      // Invite record still exists even if the email fails to send — an
      // OWNER can use "Resend" from the Members & access table.
      throw new BadRequestException(`Invite created but email failed to send: ${result.error}`);
    }
  }

  async list(req?: any) {
    const tenantId = getTenantId(req);
    const invites = await this.prisma.teamInvite.findMany({
      where: { tenantId, status: { in: ['PENDING', 'EXPIRED'] } },
      orderBy: { createdAt: 'desc' },
    });
    return invites.map((i) => this.toSafeShape(i));
  }

  async revoke(id: string) {
    const invite = await this.prisma.teamInvite.findUnique({ where: { id } });
    if (!invite) throw new NotFoundException('Invite not found');
    const updated = await this.prisma.teamInvite.update({ where: { id }, data: { status: 'REVOKED' } });
    return this.toSafeShape(updated);
  }

  async resend(id: string) {
    const invite = await this.prisma.teamInvite.findUnique({ where: { id } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status === 'ACCEPTED') throw new BadRequestException('This invite was already accepted');

    const rawToken = crypto.randomBytes(32).toString('hex');
    const updated = await this.prisma.teamInvite.update({
      where: { id },
      data: {
        token: this.hashToken(rawToken),
        status: 'PENDING',
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    await this.sendInviteEmail(updated, rawToken);
    return this.toSafeShape(updated);
  }

  /** Public — looks up an invite by its raw token to prefill the accept-invite page. */
  async getByToken(rawToken: string) {
    const invite = await this.prisma.teamInvite.findUnique({ where: { token: this.hashToken(rawToken) } });
    if (!invite) throw new NotFoundException('Invite not found or already used');
    if (invite.status !== 'PENDING') throw new BadRequestException('This invite is no longer valid');
    if (invite.expiresAt < new Date()) throw new BadRequestException('This invite has expired — ask for a new one');
    return { name: invite.name, email: invite.email, role: invite.role };
  }

  /** Public — the invitee sets their own password; account + module permissions are created here. */
  async accept(rawToken: string, password: string) {
    const invite = await this.prisma.teamInvite.findUnique({ where: { token: this.hashToken(rawToken) } });
    if (!invite) throw new NotFoundException('Invite not found or already used');
    if (invite.status !== 'PENDING') throw new BadRequestException('This invite is no longer valid');
    if (invite.expiresAt < new Date()) throw new BadRequestException('This invite has expired — ask for a new one');

    const existingUser = await this.prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) throw new ConflictException('A user with this email already exists');

    const hashed = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: {
        tenantId: invite.tenantId,
        name: invite.name,
        email: invite.email,
        password: hashed,
        role: invite.role as any,
        department: invite.department,
        active: true,
        emailVerifiedAt: new Date(), // clicking the invite link IS the verification
      },
      select: { id: true, name: true, email: true, role: true },
    });

    const grants = (invite.moduleGrants as Record<string, string>) || {};
    await Promise.all(
      Object.entries(grants).map(([module, level]) => this.permissions.setPermission(user.id, module, level)),
    );

    await this.prisma.teamInvite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
    return user;
  }

  private toSafeShape(invite: { id: string; name: string; email: string; role: string; department: string | null; status: string; expiresAt: Date; createdAt: Date }) {
    return { id: invite.id, name: invite.name, email: invite.email, role: invite.role, department: invite.department, status: invite.status, expiresAt: invite.expiresAt, createdAt: invite.createdAt };
  }
}
