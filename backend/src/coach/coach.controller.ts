import { Controller, Get, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CoachService } from './coach.service';

const ADMIN_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];

@ApiTags('Coach')
@Controller('coach')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CoachController {
  constructor(private service: CoachService) {}

  @Get('me')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  @ApiOperation({ summary: 'Your own coaching for your recent calls' })
  mine(@Req() req: any, @Query('limit') limit?: string) {
    return this.service.forRep(req.user.tenantId, req.user.id, limit ? +limit : undefined);
  }

  @Get('rep/:userId')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  @ApiOperation({ summary: "One rep's coaching. A rep may only read their own." })
  forRep(@Param('userId') userId: string, @Req() req: any, @Query('limit') limit?: string) {
    // Enforced here rather than in the front end. A rep reading a colleague's
    // scores is the leaderboard this product deliberately does not have.
    if (userId !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
      throw new ForbiddenException('You can only view your own coaching');
    }
    return this.service.forRep(req.user.tenantId, userId, limit ? +limit : undefined);
  }

  @Get('admin/overview')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Every rep side by side. Admin only, never shown to reps.' })
  overview(@Req() req: any, @Query('days') days?: string) {
    return this.service.adminOverview(req.user.tenantId, days ? +days : undefined);
  }

  @Get('knowledge-base')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  @ApiOperation({ summary: 'Calls worth learning from, for ramping new reps' })
  knowledgeBase(@Req() req: any, @Query('limit') limit?: string) {
    return this.service.knowledgeBase(req.user.tenantId, limit ? +limit : undefined);
  }
}
