import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { PublicProfileService } from './public-profile.service';
import { UpdatePublicProfileDto } from './dto/public-profile.dto';

@ApiTags('PublicProfile')
@Controller('public-profile')
export class PublicProfileController {
  constructor(private service: PublicProfileService, private config: ConfigService) {}

  // Authenticated editor endpoints
  @Get('mine') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'MANAGER') @ApiBearerAuth()
  getMine() { return this.service.getMine(); }

  // The broker's own shareable mini-site link — Mikey sends this to leads over WhatsApp/Telegram.
  @Get('link') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT') @ApiBearerAuth()
  getMyLink() {
    const dashboardUrl = this.config.get<string>('DASHBOARD_PUBLIC_URL')
      || this.config.get<string>('PUBLIC_URL', '').replace(/\/api\/?$/, '');
    return this.service.getMyLink(dashboardUrl);
  }

  @Patch('mine') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN') @ApiBearerAuth()
  updateMine(@Body() d: UpdatePublicProfileDto) { return this.service.upsertMine(d); }

  // Public, unauthenticated microsite endpoint
  @Public()
  @Get('org/:slug')
  getPublic(@Param('slug') slug: string) { return this.service.getPublicBySlug(slug); }
}
