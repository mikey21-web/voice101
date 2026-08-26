import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, Res, UseInterceptors, UploadedFile, HttpCode, Headers, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { AdvancedFeaturesService } from './advanced-features.service';
import { CreatePipelineStageDto, UpdatePipelineStageDto, ReorderStagesDto, CreateSavedFilterDto, CreateSlaRuleDto, UpdateSlaRuleDto, CreateRevenueDto, RevenueQueryDto, MergeContactsDto, CreateBlocklistDto, UpdateNotificationPrefsDto } from './dto/advanced-features.dto';

@ApiTags('Advanced')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdvancedFeaturesController {
  constructor(private svc: AdvancedFeaturesService) {}

  // Pipeline stages
  @Get('pipeline-stages') @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'SUPPORT_AGENT', 'VIEWER') getStages() { return this.svc.getStages(); }
  @Post('pipeline-stages') @Roles('OWNER', 'ADMIN', 'MANAGER') createStage(@Body() d: CreatePipelineStageDto) { return this.svc.createStage(d); }
  @Patch('pipeline-stages/:id') @Roles('OWNER', 'ADMIN', 'MANAGER') updateStage(@Param('id') id: string, @Body() d: UpdatePipelineStageDto) { return this.svc.updateStage(id, d); }
  @Delete('pipeline-stages/:id') @Roles('OWNER', 'ADMIN') deleteStage(@Param('id') id: string) { return this.svc.deleteStage(id); }
  @Patch('pipeline-stages/reorder') @Roles('OWNER', 'ADMIN', 'MANAGER') reorderStages(@Body() d: ReorderStagesDto) { return this.svc.reorderStages(d.stageIds); }

  // Saved filters
  @Get('saved-filters') @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT') getFilters(@Req() req) { return this.svc.getFilters(req.user.sub); }
  @Post('saved-filters') @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT') createFilter(@Body() d: CreateSavedFilterDto, @Req() req) { return this.svc.createFilter({ ...d, userId: req.user.sub }); }
  @Delete('saved-filters/:id') @Roles('OWNER', 'ADMIN', 'MANAGER') deleteFilter(@Param('id') id: string) { return this.svc.deleteFilter(id); }

  // Ownership history
  @Get('leads/:id/ownership-history') @Roles('OWNER', 'ADMIN', 'MANAGER', 'VIEWER') getOwnershipHistory(@Param('id') id: string) { return this.svc.getOwnershipHistory(id); }

  // Merge
  @Post('contacts/merge') @Roles('OWNER', 'ADMIN', 'MANAGER') mergeContacts(@Body() d: MergeContactsDto, @Req() req) { return this.svc.mergeContacts(d.primaryId, d.secondaryId, req.user.sub); }
  @Post('contacts/detect-duplicates') @Roles('OWNER', 'ADMIN', 'MANAGER') detectDuplicates(@Body() d: { email?: string; phone?: string; name?: string }) { return this.svc.detectDuplicates('contact', d); }

  // Internal notes
  @Get('leads/:id/notes') @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'SUPPORT_AGENT') getNotes(@Param('id') id: string) { return this.svc.getNotes(id); }
  @Post('leads/:id/notes') @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT') createNote(@Param('id') id: string, @Body('content') content: string, @Req() req) { return this.svc.createNote(id, req.user.sub, content); }

  // Blocklist
  @Get('blocklist') @Roles('OWNER', 'ADMIN', 'MANAGER') getBlocklist() { return this.svc.getBlocklist(); }
  @Post('blocklist') @Roles('OWNER', 'ADMIN', 'MANAGER') addToBlocklist(@Body() d: CreateBlocklistDto) { return this.svc.addToBlocklist(d.type, d.value, d.reason); }
  @Delete('blocklist/:id') @Roles('OWNER', 'ADMIN') removeFromBlocklist(@Param('id') id: string) { return this.svc.removeFromBlocklist(id); }

  // Notification preferences
  @Get('notifications/preferences') @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'SUPPORT_AGENT', 'VIEWER') getNotifPrefs(@Req() req) { return this.svc.getNotificationPrefs(req.user.sub); }
  @Patch('notifications/preferences') @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'SUPPORT_AGENT', 'VIEWER') updateNotifPrefs(@Body() d: UpdateNotificationPrefsDto, @Req() req) { return this.svc.updateNotificationPrefs(req.user.sub, d); }

  // SLA rules
  @Get('sla-rules') @Roles('OWNER', 'ADMIN', 'MANAGER', 'VIEWER') getSlaRules() { return this.svc.getSlaRules(); }
  @Post('sla-rules') @Roles('OWNER', 'ADMIN', 'MANAGER') createSlaRule(@Body() d: CreateSlaRuleDto) { return this.svc.createSlaRule(d as any); }
  @Patch('sla-rules/:id') @Roles('OWNER', 'ADMIN', 'MANAGER') updateSlaRule(@Param('id') id: string, @Body() d: UpdateSlaRuleDto) { return this.svc.updateSlaRule(id, d as any); }
  @Delete('sla-rules/:id') @Roles('OWNER', 'ADMIN') deleteSlaRule(@Param('id') id: string) { return this.svc.deleteSlaRule(id); }

  // Revenue
  @Get('revenue') @Roles('OWNER', 'ADMIN', 'MANAGER', 'VIEWER') getRevenue(@Query() q: Record<string, string>) { return this.svc.getRevenue(q); }
  @Post('revenue') @Roles('OWNER', 'ADMIN', 'MANAGER') createRevenue(@Body() d: CreateRevenueDto) { return this.svc.createRevenue(d as any); }

  // Import/export
  @Post('import/start') @Roles('OWNER', 'ADMIN', 'MANAGER') startImport(@Req() req, @Body('totalRows') totalRows: number) { return this.svc.startImport(req.user.sub, totalRows || 0); }
  @Post('import/:logId/process') @Roles('OWNER', 'ADMIN', 'MANAGER') @ApiConsumes('multipart/form-data') @UseInterceptors(FileInterceptor('file'))
  async processImport(@Param('logId') logId: string, @UploadedFile() file: Express.Multer.File, @Body('entity') entity: string) {
    if (!file) return { error: 'CSV file required' };
    const csv = file.buffer.toString('utf8');
    const lines = csv.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) return { error: 'CSV must have header + at least one data row' };

    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(line => {
      const vals = parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ''; });
      return row;
    });
    const allowedEntities = ['contact', 'lead'] as const;
    const resolvedEntity = allowedEntities.includes(entity as any) ? (entity as typeof allowedEntities[number]) : 'contact';
    return this.svc.processImport(logId, rows, resolvedEntity);
  }
  @Post('export/start') @Roles('OWNER', 'ADMIN', 'MANAGER', 'VIEWER') startExport(@Req() req) { return this.svc.startExport(req.user.sub); }
  @Post('export/:logId/complete') @Roles('OWNER', 'ADMIN', 'MANAGER') completeExport(@Param('logId') logId: string, @Body() d: { entity: string }) { return this.svc.completeExport(logId, (d.entity === 'lead' ? 'lead' : 'contact')); }
  @Get('import-export/logs') @Roles('OWNER', 'ADMIN', 'MANAGER') getImportLogs(@Req() req) { return this.svc.getImportLogs(req.user.sub); }

  // Data retention purge
  @Post('data/purge-spam-cold') @Roles('OWNER') purgeSpamAndCold(@Body('retentionDays') retentionDays?: number) { return this.svc.purgeSpamAndCold(retentionDays); }

  // SLA evaluation
  @Post('sla-rules/evaluate') @Roles('OWNER', 'ADMIN') evaluateSla() { return this.svc.evaluateSlaRules(); }

  // Failure inbox
  @Get('failure-inbox') @Roles('OWNER', 'ADMIN') getFailureInbox() { return this.svc.getFailureInbox(); }
  @Public()
  @Post('failure-inbox') @HttpCode(200)
  recordFailure(@Body() d: { eventType: string; error: string; payload?: Record<string, unknown>; workflow?: string }, @Headers('authorization') auth?: string) {
    const expectedToken = process.env.N8N_BACKEND_JWT;
    if (!expectedToken) throw new UnauthorizedException('Failure inbox not configured');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expectedToken);
    if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) throw new UnauthorizedException('Invalid n8n token');
    return this.svc.recordFailure(d);
  }
  @Post('failure-inbox/:id/retry') @Roles('OWNER', 'ADMIN') retryFailedEvent(@Param('id') id: string) { return this.svc.retryFailedEvent(id); }

  // Smart Lists
  @Get('smart-lists') @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'SUPPORT_AGENT', 'VIEWER') getSmartLists(@Req() req) { return this.svc.getSmartLists(req.user.tenantId); }

  // Sandbox test
  @Get('sandbox/test') @Roles('OWNER', 'ADMIN') sandboxTest() { return this.svc.sandboxTest(); }

  // Export download
  @Get('exports/:filename')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  downloadExport(@Param('filename') filename: string, @Res() res: any) {
    const storagePath = process.env.STORAGE_PATH || './uploads';
    const fullPath = path.join(storagePath, filename);
    if (!fs.existsSync(fullPath)) throw new NotFoundException('Export file not found');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv');
    return res.sendFile(fullPath);
  }
}
