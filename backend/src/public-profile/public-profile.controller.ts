import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { PublicProfileService } from './public-profile.service';
import { UpdatePublicProfileDto } from './dto/public-profile.dto';

@ApiTags('PublicProfile')
@Controller('public-profile')
export class PublicProfileController {
  constructor(private service: PublicProfileService) {}

  // Authenticated editor endpoints
  @Get('mine') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN', 'MANAGER') @ApiBearerAuth()
  getMine() { return this.service.getMine(); }

  @Patch('mine') @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'ADMIN') @ApiBearerAuth()
  updateMine(@Body() d: UpdatePublicProfileDto) { return this.service.upsertMine(d); }

  // Public, unauthenticated microsite endpoint
  @Public()
  @Get('org/:slug')
  getPublic(@Param('slug') slug: string) { return this.service.getPublicBySlug(slug); }
}
