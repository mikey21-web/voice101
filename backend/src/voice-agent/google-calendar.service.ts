import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Google Calendar OAuth + event creation using plain fetch (no heavy googleapis
 * dependency — the full googleapis package takes ~20s to import on this stack).
 * Stores access/refresh tokens in the tenant's settings JSON under
 * `googleCalendar`, same pattern as the voice wallet.
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  private get clientId(): string {
    return this.config.get<string>('GOOGLE_CLIENT_ID', '');
  }
  private get clientSecret(): string {
    return this.config.get<string>('GOOGLE_CLIENT_SECRET', '');
  }
  private get redirectUri(): string {
    return this.config.get<string>('GOOGLE_REDIRECT_URI', 'http://localhost:3001/voice-agent/google/callback');
  }

  getAuthUrl(tenantId: string): string {
    const scopes = 'https://www.googleapis.com/auth/calendar.events';
    const state = Buffer.from(JSON.stringify({ tenantId })).toString('base64url');
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleCallback(code: string, state: string) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured');
    }
    const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    const tenantId = stateData.tenantId;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
    const tokens: any = await res.json();

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');
    const settings = (tenant.settings as any) || {};
    settings.googleCalendar = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date ? Number(tokens.expiry_date) : undefined,
    };
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { settings: settings as any } });

    return { success: true, message: 'Google Calendar connected successfully' };
  }

  async createEvent(tenantId: string, eventData: {
    summary: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees?: string[];
  }) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');
    const settings = (tenant.settings as any) || {};
    const googleCal = settings.googleCalendar;
    if (!googleCal?.accessToken) throw new Error('Google Calendar not connected');

    let accessToken = googleCal.accessToken;
    if (googleCal.expiryDate && Date.now() > Number(googleCal.expiryDate) - 60_000) {
      accessToken = await this.refreshToken(tenantId, googleCal.refreshToken);
    }

    const event = {
      summary: eventData.summary,
      description: eventData.description,
      start: { dateTime: eventData.startTime.toISOString() },
      end: { dateTime: eventData.endTime.toISOString() },
      attendees: eventData.attendees?.map((email) => ({ email })),
      reminders: { useDefault: true },
    };

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(event),
    });
    if (!res.ok) throw new Error(`Google Calendar create failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  private async refreshToken(tenantId: string, refreshToken?: string): Promise<string> {
    if (!refreshToken) throw new Error('No Google refresh token');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
    const tokens: any = await res.json();

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant) {
      const settings = (tenant.settings as any) || {};
      settings.googleCalendar = {
        ...settings.googleCalendar,
        accessToken: tokens.access_token,
        expiryDate: tokens.expiry_date ? Number(tokens.expiry_date) : undefined,
      };
      await this.prisma.tenant.update({ where: { id: tenantId }, data: { settings: settings as any } });
    }
    return tokens.access_token;
  }
}
