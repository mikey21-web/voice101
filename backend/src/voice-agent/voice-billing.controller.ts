import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { VoiceBillingService } from './voice-billing.service';

@Controller('voice-numbers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceNumberController {
  constructor(private service: VoiceBillingService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  list(@Req() req: any) {
    return this.service.listNumbers(req.user.tenantId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  add(@Req() req: any, @Body() body: { number: string; provider?: string }) {
    return this.service.addNumber(req.user.tenantId, body.number, body.provider);
  }

  @Patch(':id/kyc')
  @Roles('OWNER', 'ADMIN')
  setKyc(@Req() req: any, @Param('id') id: string, @Body() body: { status: 'not_started' | 'pending' | 'verified' }) {
    return this.service.setNumberKyc(req.user.tenantId, id, body.status);
  }

  @Post(':id/assign/:employeeId')
  @Roles('OWNER', 'ADMIN')
  assign(@Req() req: any, @Param('id') id: string, @Param('employeeId') employeeId: string) {
    return this.service.assignNumber(req.user.tenantId, employeeId, id);
  }
}

@Controller('voice-billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceBillingController {
  constructor(private service: VoiceBillingService) {}

  @Get()
  @Roles('OWNER', 'ADMIN')
  get(@Req() req: any) {
    return this.service.getBilling(req.user.tenantId);
  }
}

@Controller('voice-wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceWalletController {
  constructor(private service: VoiceBillingService) {}

  @Get()
  @Roles('OWNER', 'ADMIN')
  get(@Req() req: any) {
    return this.service.getWallet(req.user.tenantId);
  }
}
