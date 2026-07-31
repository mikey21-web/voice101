import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { VoiceEmployeeService, EmployeeInput } from './voice-employee.service';
import { CallFlowGeneratorService } from './call-flow-generator.service';

/** Multi-employee CRUD — the core object model of the voice-agent engine. Route shape mirrors
 * Outpero's /employees surface (see REVERSE-ENGINEERED.md) so the frontend can be wired the
 * same way theirs is: list -> create -> edit sections/variables as a draft -> publish -> call. */
@Controller('voice-employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceEmployeeController {
  constructor(private service: VoiceEmployeeService, private generator: CallFlowGeneratorService) {}

  /** Mirrors Outpero's "Tell us how the call should go" hire step: one free-text description
   * comes in, a full section-graph draft comes back for the user to review before create(). */
  @Post('generate-draft')
  @Roles('OWNER', 'ADMIN')
  async generateDraft(@Body() body: { description: string; businessName?: string }) {
    return this.generator.generate(body.description, body.businessName);
  }

  @Get()
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  list(@Req() req: any, @Query('include_archived') includeArchived?: string) {
    return this.service.list(req.user.tenantId, includeArchived === 'true');
  }

  @Get(':id')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  get(@Req() req: any, @Param('id') id: string) {
    return this.service.get(req.user.tenantId, id);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(@Req() req: any, @Body() body: EmployeeInput) {
    return this.service.create(req.user.tenantId, body);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  update(@Req() req: any, @Param('id') id: string, @Body() body: Partial<EmployeeInput>) {
    return this.service.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.tenantId, id);
  }

  @Post(':id/publish')
  @Roles('OWNER', 'ADMIN')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.service.publish(req.user.tenantId, id, req.user.sub);
  }

  @Post(':id/activate')
  @Roles('OWNER', 'ADMIN')
  activate(@Req() req: any, @Param('id') id: string) {
    return this.service.activate(req.user.tenantId, id);
  }

  @Post(':id/deactivate')
  @Roles('OWNER', 'ADMIN')
  deactivate(@Req() req: any, @Param('id') id: string) {
    return this.service.deactivate(req.user.tenantId, id);
  }

  @Get(':id/versions')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  listVersions(@Req() req: any, @Param('id') id: string) {
    return this.service.listVersions(req.user.tenantId, id);
  }

  @Post(':id/versions/:revision/restore')
  @Roles('OWNER', 'ADMIN')
  restoreVersion(@Req() req: any, @Param('id') id: string, @Param('revision') revision: string) {
    return this.service.restoreVersion(req.user.tenantId, id, parseInt(revision, 10));
  }

  @Post(':id/test-call')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  testCall(@Req() req: any, @Param('id') id: string, @Body() body: { toNumber: string; context?: Record<string, any> }) {
    return this.service.testCall(req.user.tenantId, id, body.toNumber, body.context || {});
  }
}
