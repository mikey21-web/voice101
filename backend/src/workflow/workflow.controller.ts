import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WorkflowService } from './workflow.service';

@ApiTags('Workflows')
@Controller('workflows')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WorkflowController {
  constructor(private service: WorkflowService) {}

  @Post()
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new workflow definition' })
  create(@Body() dto: { name: string; tags?: string[] }, @Req() req) {
    return this.service.create({ ...dto, tenantId: req.user.tenantId });
  }

  @Get()
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  @ApiOperation({ summary: 'List all workflows for the tenant' })
  findAll(@Req() req) {
    return this.service.findAll(req.user.tenantId);
  }

  @Get(':id')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  @ApiOperation({ summary: 'Get workflow details with latest version' })
  findOne(@Param('id') id: string, @Req() req) {
    return this.service.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update workflow metadata' })
  update(@Param('id') id: string, @Body() dto: { name?: string; tags?: string[] }) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Delete a workflow' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/versions')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new draft version with steps, edges, and triggers' })
  createVersion(@Param('id') id: string, @Body() dto: { steps: any[]; edges: any[]; triggers?: any[] }) {
    return this.service.createVersion(id, dto.steps, dto.edges, dto.triggers);
  }

  @Post(':id/publish')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Publish the latest draft version (activates workflow)' })
  publish(@Param('id') id: string) {
    return this.service.publishVersion(id);
  }

  @Get(':id/instances')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'List execution history for a workflow' })
  getInstances(@Param('id') id: string) {
    return this.service.getInstances(id);
  }
}
