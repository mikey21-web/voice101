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

  @Post('buy')
  @Roles('OWNER', 'ADMIN')
  buy(@Req() req: any, @Body() body: { number: string }) {
    return this.service.buyNumber(req.user.tenantId, body.number);
  }

  @Post(':id/release')
  @Roles('OWNER', 'ADMIN')
  release(@Req() req: any, @Param('id') id: string) {
    return this.service.releaseNumber(req.user.tenantId, id);
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

  @Post('topup')
  @Roles('OWNER', 'ADMIN')
  createTopUp(@Req() req: any, @Body() body: { amount: number }) {
    return this.service.createTopUp(req.user.tenantId, body.amount);
  }

  @Post('topup/verify')
  @Roles('OWNER', 'ADMIN')
  verifyTopUp(@Req() req: any, @Body() body: { order_id: string; payment_id?: string }) {
    return this.service.verifyTopUp(req.user.tenantId, body.order_id, body.payment_id);
  }
}
