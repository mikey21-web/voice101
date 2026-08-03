import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EscalationService } from './escalation.service';

@ApiTags('Escalations')
@Controller('escalations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EscalationController {
  constructor(private service: EscalationService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  @ApiOperation({ summary: 'Leads a human has been paged for, still unresolved' })
  listOpen(@Req() req: any) {
    return this.service.listOpen(req.user.tenantId);
  }

  @Post(':id/resolve')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  @ApiOperation({ summary: 'Hand the lead back to Mikey once the human is done' })
  async resolve(@Param('id') id: string, @Req() req: any) {
    await this.service.resolve(req.user.tenantId, id, req.user.id);
    return { status: 'resolved' };
  }
}
