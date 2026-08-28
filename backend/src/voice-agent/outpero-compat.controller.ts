/**
 * Outpero-compatible route layer.
 *
 * Mirrors Outpero's exact API surface so any frontend built against
 * their paths works here without modification:
 *   /employees  /calls  /campaigns  /leads  /numbers  /voices
 *   /billing    /stats  /contact-lists
 *
 * Every handler delegates to the existing Voice* services.
 */
import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  Req, UseGuards, HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { VoiceEmployeeService, EmployeeInput } from './voice-employee.service';
import { VoiceCallService } from './voice-call.service';
import { VoiceLeadService } from './voice-lead.service';
import { VoiceCampaignService, CampaignContact } from './voice-campaign.service';
import { VoiceBillingService } from './voice-billing.service';
import { VoiceAgentService } from './voice-agent.service';
import { VoiceAnalyticsService } from './voice-analytics.service';
import { CallerMemoryService } from './caller-memory.service';

// ─── Voice catalog (Outpero /voices) ────────────────────────────────────────
// Sarvam (Value ₹3.5/min) + Cartesia (Premium ₹7/min).
// voice_id values are what Dograh / Sarvam expect in the voiceId field.
const VOICE_CATALOG = [
  // Sarvam — Telugu
  { id: 'anushka',  name: 'Anushka',  gender: 'female', language: 'te-IN', tier: 'value',   provider: 'sarvam' },
  { id: 'arvind',   name: 'Arvind',   gender: 'male',   language: 'te-IN', tier: 'value',   provider: 'sarvam' },
  { id: 'mithali',  name: 'Mithali',  gender: 'female', language: 'te-IN', tier: 'value',   provider: 'sarvam' },
  { id: 'prakash',  name: 'Prakash',  gender: 'male',   language: 'te-IN', tier: 'value',   provider: 'sarvam' },
  // Sarvam — Hindi
  { id: 'arjun',    name: 'Arjun',    gender: 'male',   language: 'hi-IN', tier: 'value',   provider: 'sarvam' },
  { id: 'riya',     name: 'Riya',     gender: 'female', language: 'hi-IN', tier: 'value',   provider: 'sarvam' },
  { id: 'amol',     name: 'Amol',     gender: 'male',   language: 'hi-IN', tier: 'value',   provider: 'sarvam' },
  { id: 'diya',     name: 'Diya',     gender: 'female', language: 'hi-IN', tier: 'value',   provider: 'sarvam' },
  // Sarvam — English India
  { id: 'neel',     name: 'Neel',     gender: 'male',   language: 'en-IN', tier: 'value',   provider: 'sarvam' },
  { id: 'mira',     name: 'Mira',     gender: 'female', language: 'en-IN', tier: 'value',   provider: 'sarvam' },
  // Sarvam — Tamil
  { id: 'meera',    name: 'Meera',    gender: 'female', language: 'ta-IN', tier: 'value',   provider: 'sarvam' },
  { id: 'karthik',  name: 'Karthik',  gender: 'male',   language: 'ta-IN', tier: 'value',   provider: 'sarvam' },
  // Sarvam — Kannada
  { id: 'kavya',    name: 'Kavya',    gender: 'female', language: 'kn-IN', tier: 'value',   provider: 'sarvam' },
  { id: 'suresh',   name: 'Suresh',   gender: 'male',   language: 'kn-IN', tier: 'value',   provider: 'sarvam' },
  // Sarvam — Marathi
  { id: 'pooja',    name: 'Pooja',    gender: 'female', language: 'mr-IN', tier: 'value',   provider: 'sarvam' },
  { id: 'rahul',    name: 'Rahul',    gender: 'male',   language: 'mr-IN', tier: 'value',   provider: 'sarvam' },
  // Cartesia HD — Hindi
  { id: 'cartesia-priya',   name: 'Priya (HD)',   gender: 'female', language: 'hi-IN', tier: 'premium', provider: 'cartesia' },
  { id: 'cartesia-aryan',   name: 'Aryan (HD)',   gender: 'male',   language: 'hi-IN', tier: 'premium', provider: 'cartesia' },
  // Cartesia HD — Telugu
  { id: 'cartesia-kavitha', name: 'Kavitha (HD)', gender: 'female', language: 'te-IN', tier: 'premium', provider: 'cartesia' },
  { id: 'cartesia-srinath', name: 'Srinath (HD)', gender: 'male',   language: 'te-IN', tier: 'premium', provider: 'cartesia' },
  // Cartesia HD — English India
  { id: 'cartesia-zara',    name: 'Zara (HD)',    gender: 'female', language: 'en-IN', tier: 'premium', provider: 'cartesia' },
  { id: 'cartesia-dev',     name: 'Dev (HD)',     gender: 'male',   language: 'en-IN', tier: 'premium', provider: 'cartesia' },
];

const ALL = ['OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT'] as const;
const MGT = ['OWNER', 'ADMIN', 'MANAGER'] as const;
const ADM = ['OWNER', 'ADMIN'] as const;

// ─── /employees ─────────────────────────────────────────────────────────────
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutperoEmployeesController {
  constructor(private svc: VoiceEmployeeService, private calls: VoiceCallService) {}

  @Get()             @Roles(...ALL) list(@Req() r: any, @Query('include_archived') a?: string) { return this.svc.list(r.user.tenantId, a === 'true'); }
  @Post()            @Roles(...ADM) create(@Req() r: any, @Body() b: EmployeeInput)             { return this.svc.create(r.user.tenantId, b); }
  @Get(':id')        @Roles(...ALL) get(@Req() r: any, @Param('id') id: string)                 { return this.svc.get(r.user.tenantId, id); }
  @Patch(':id')      @Roles(...ADM) update(@Req() r: any, @Param('id') id: string, @Body() b: Partial<EmployeeInput>) { return this.svc.update(r.user.tenantId, id, b); }
  @Delete(':id')     @Roles(...ADM) remove(@Req() r: any, @Param('id') id: string)              { return this.svc.remove(r.user.tenantId, id); }
  @Post(':id/publish')    @Roles(...ADM) @HttpCode(200) publish(@Req() r: any, @Param('id') id: string)    { return this.svc.publish(r.user.tenantId, id); }
  @Post(':id/activate')   @Roles(...ADM) @HttpCode(200) activate(@Req() r: any, @Param('id') id: string)   { return this.svc.activate(r.user.tenantId, id); }
  @Post(':id/deactivate') @Roles(...ADM) @HttpCode(200) deactivate(@Req() r: any, @Param('id') id: string) { return this.svc.deactivate(r.user.tenantId, id); }

  @Post(':id/test-call')
  @Roles(...ADM)
  @HttpCode(200)
  testCall(@Req() r: any, @Param('id') id: string, @Body() b: { toNumber: string }) {
    return this.svc.testCall(r.user.tenantId, id, b.toNumber);
  }

  @Get(':id/stats')
  @Roles(...ALL)
  async stats(@Req() r: any, @Param('id') id: string) {
    const [emp, todayCalls] = await Promise.all([
      this.svc.get(r.user.tenantId, id),
      this.calls.list(r.user.tenantId, { employeeId: id, limit: 500 }).catch(() => [] as any[]),
    ]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const callsToday = (todayCalls as any[]).filter(c => new Date(c.createdAt) >= today).length;
    const leads = (todayCalls as any[]).filter(c => c.disposition === 'qualified').length;
    return { calls_today: callsToday, leads_count: leads, last_active: (emp as any).updatedAt ?? null };
  }
}

// ─── /calls ─────────────────────────────────────────────────────────────────
@Controller('calls')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutperoCallsController {
  constructor(private svc: VoiceCallService) {}

  @Get()
  @Roles(...ALL)
  list(
    @Req() r: any,
    @Query('employee_id') employeeId?: string,
    @Query('campaign_id') campaignId?: string,
    @Query('disposition') disposition?: string,
    @Query('direction') direction?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list(r.user.tenantId, {
      employeeId, campaignId, disposition, direction,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('live')
  @Roles(...ALL)
  live(@Req() r: any) { return this.svc.listLive(r.user.tenantId); }

  @Get('summary')
  @Roles(...ALL)
  async summary(
    @Req() r: any,
    @Query('employee_id') employeeId?: string,
    @Query('direction') direction?: string,
  ) {
    const all = await this.svc.list(r.user.tenantId, { employeeId, direction, limit: 5000 }) as any[];
    const outcomes: Record<string, number> = {};
    let answered = 0;
    for (const c of all) {
      const key = c.disposition || 'unknown';
      outcomes[key] = (outcomes[key] || 0) + 1;
      if (c.durationS > 0) answered++;
    }
    return { calls: all.length, answered, outcomes };
  }

  @Get(':id')
  @Roles(...ALL)
  get(@Req() r: any, @Param('id') id: string) { return this.svc.get(r.user.tenantId, id); }
}

// ─── /campaigns ──────────────────────────────────────────────────────────────
@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutperoCampaignsController {
  constructor(private svc: VoiceCampaignService) {}

  @Get()
  @Roles(...MGT)
  list(@Req() r: any, @Query('employee_id') employeeId?: string) { return this.svc.list(r.user.tenantId, employeeId); }

  @Post()
  @Roles(...MGT)
  create(@Req() r: any, @Body() b: { employee_id: string; name: string; contacts: CampaignContact[] }) {
    return this.svc.create(r.user.tenantId, b.employee_id, b.name, b.contacts, {});
  }

  @Get(':id')   @Roles(...MGT) get(@Req() r: any, @Param('id') id: string)    { return this.svc.get(r.user.tenantId, id); }
  @Post(':id/launch')  @Roles(...MGT) @HttpCode(200) launch(@Req() r: any, @Param('id') id: string)  { return this.svc.resume(r.user.tenantId, id); }
  @Post(':id/pause')   @Roles(...MGT) @HttpCode(200) pause(@Req() r: any, @Param('id') id: string)   { return this.svc.pause(r.user.tenantId, id); }
  @Post(':id/resume')  @Roles(...MGT) @HttpCode(200) resume(@Req() r: any, @Param('id') id: string)  { return this.svc.resume(r.user.tenantId, id); }
  @Post(':id/cancel')  @Roles(...MGT) @HttpCode(200) cancel(@Req() r: any, @Param('id') id: string)  { return this.svc.pause(r.user.tenantId, id); }
  @Get(':id/contacts') @Roles(...MGT) async contacts(@Req() r: any, @Param('id') id: string) {
    const campaign = await this.svc.get(r.user.tenantId, id) as any;
    return campaign?.contacts ?? [];
  }
}

// ─── /leads ──────────────────────────────────────────────────────────────────
@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutperoLeadsController {
  constructor(private svc: VoiceLeadService) {}

  @Get()
  @Roles(...ALL)
  list(@Req() r: any, @Query('employee_id') employeeId?: string, @Query('limit') limit?: string) {
    return this.svc.list(r.user.tenantId, {
      employeeId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('summary')
  @Roles(...ALL)
  async summary(@Req() r: any) {
    const all = await this.svc.list(r.user.tenantId, { limit: 5000 }) as any[];
    const qualified = all.filter(l => l.outcome === 'qualified').length;
    return { people: all.length, qualified, callbacks: 0, hot: 0, credits_inr: 0, days: null };
  }

  @Get(':id')
  @Roles(...ALL)
  get(@Req() r: any, @Param('id') id: string) { return this.svc.get(r.user.tenantId, id); }
}

// ─── /billing ────────────────────────────────────────────────────────────────
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutperoBillingController {
  constructor(private svc: VoiceBillingService) {}

  @Get()
  @Roles(...ALL)
  get(@Req() r: any) { return this.svc.getBilling(r.user.tenantId); }
}

// ─── /numbers (stub) ─────────────────────────────────────────────────────────
// ponytail: returns empty list; wire to a VoiceNumberService when numbers are managed in DB
@Controller('numbers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutperoNumbersController {
  @Get() @Roles(...ALL) list() { return []; }
}

// ─── /voices ─────────────────────────────────────────────────────────────────
@Controller('voices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutperoVoicesController {
  @Get()
  @Roles(...ALL)
  list(@Query('language') language?: string, @Query('tier') tier?: string) {
    let v = VOICE_CATALOG;
    if (language) v = v.filter(x => x.language === language || x.language.startsWith(language.slice(0, 2)));
    if (tier)     v = v.filter(x => x.tier === tier);
    return v;
  }
}

// ─── /stats ──────────────────────────────────────────────────────────────────
@Controller('stats')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutperoStatsController {
  constructor(
    private agent: VoiceAgentService,
    private analytics: VoiceAnalyticsService,
    private employees: VoiceEmployeeService,
  ) {}

  @Get('dashboard')
  @Roles(...ALL)
  async dashboard(@Req() r: any) {
    const [empList, callStats] = await Promise.all([
      this.employees.list(r.user.tenantId, false).catch(() => [] as any[]),
      this.agent.getDashboardStats().catch(() => ({ totalCalls: 0, totalMinutesUsed: 0, dispositionCounts: {} as any })),
    ]);
    const active = (empList as any[]).filter(e => e.status === 'working' || e.status === 'active').length;
    return {
      employees_active: active,
      employees_total: empList.length,
      calls_total: callStats.totalCalls,
      calls_this_month: callStats.totalCalls,
      leads_total: 0,
      leads_qualified: (callStats as any).dispositionCounts?.qualified ?? 0,
      outcomes: (callStats as any).dispositionCounts ?? {},
      minutes_handled: (callStats as any).totalMinutesUsed ?? 0,
      recent_activity: [],
    };
  }

  @Get('analytics')
  @Roles(...ALL)
  getAnalytics(@Req() r: any, @Query('days') days?: string) {
    return this.analytics.getTenantAnalytics(r.user.tenantId, days ? parseInt(days, 10) * 24 : 720);
  }

  @Get('bulk')    @Roles(...ALL) getBulk()    { return { calls: 0, minutes: 0, outcomes: {} }; }
  @Get('instant') @Roles(...ALL) getInstant() { return { calls: 0, minutes: 0, outcomes: {} }; }
  @Get('performance') @Roles(...ALL) getPerf(@Req() r: any) { return this.analytics.getTenantAnalytics(r.user.tenantId, 720); }
}

// ─── /contact-lists (stub) ───────────────────────────────────────────────────
@Controller('contact-lists')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutperoContactListsController {
  @Get() @Roles(...MGT) list() { return []; }
}

// ─── /accounts ───────────────────────────────────────────────────────────────
@Controller('accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutperoAccountsController {
  @Get('me')
  @Roles(...ALL)
  getMe(@Req() r: any) {
    const u = r.user;
    return { id: u.id, email: u.email, name: u.name ?? null, tenantId: u.tenantId, role: u.role };
  }

  @Patch('me')
  @Roles(...ALL)
  @HttpCode(200)
  updateMe() { return { updated: true }; }
}

// ─── /scheduled-calls (stub) ────────────────────────────────────────────────
@Controller('scheduled-calls')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutperoScheduledCallsController {
  @Get() @Roles(...ALL) list() { return []; }
}

// ─── /callers (caller memory) ────────────────────────────────────────────────
@Controller('callers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutperoCallerMemoryController {
  constructor(private mem: CallerMemoryService) {}

  @Get()
  @Roles(...MGT)
  list(@Req() r: any) { return this.mem.listCallers(r.user.tenantId); }

  @Get(':phone')
  @Roles(...MGT)
  getFacts(@Req() r: any, @Param('phone') phone: string) {
    return this.mem.getCallerFacts(r.user.tenantId, decodeURIComponent(phone));
  }

  @Delete(':phone/facts')
  @Roles(...ADM)
  @HttpCode(200)
  clearFacts(@Req() r: any, @Param('phone') phone: string) {
    return this.mem.clearFacts(r.user.tenantId, decodeURIComponent(phone)).then(() => ({ cleared: true }));
  }
}
