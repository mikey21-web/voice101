import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';

@Controller('voice-agent/google')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GoogleCalendarController {
  constructor(
    private googleCalendar: GoogleCalendarService,
    private prisma: PrismaService,
  ) {}

  @Get('auth')
  @Roles('OWNER', 'ADMIN')
  getAuthUrl(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return { url: this.googleCalendar.getAuthUrl(tenantId) };
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string) {
    return this.googleCalendar.handleCallback(code, state);
  }

  @Get('status')
  @Roles('OWNER', 'ADMIN')
  async status(@Req() req: any) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: req.user.tenantId } });
    const settings = (tenant?.settings as any) || {};
    return {
      connected: !!settings.googleCalendar?.accessToken,
      expiryDate: settings.googleCalendar?.expiryDate,
    };
  }
}
