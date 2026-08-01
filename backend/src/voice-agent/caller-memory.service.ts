import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CallerMemoryService {
  private readonly logger = new Logger(CallerMemoryService.name);

  constructor(private prisma: PrismaService) {}

  async getCallerFacts(tenantId: string, phoneNumber: string): Promise<Record<string, any>> {
    const caller = await this.prisma.voiceCaller.findUnique({
      where: { tenantId_phoneNumber: { tenantId, phoneNumber } },
    });
    // facts is Prisma Json, so it can legally be a string/number/array. Only an
    // object is spreadable by mergeFacts, anything else is treated as empty.
    const facts = caller?.facts;
    return facts && typeof facts === 'object' && !Array.isArray(facts)
      ? (facts as Record<string, any>)
      : {};
  }

  async mergeFacts(tenantId: string, phoneNumber: string, newFacts: Record<string, any>): Promise<Record<string, any>> {
    const existing = await this.getCallerFacts(tenantId, phoneNumber);

    const merged = { ...existing };
    for (const [key, value] of Object.entries(newFacts)) {
      if (value !== null && value !== undefined && value !== '') {
        merged[key] = value;
      }
    }

    await this.prisma.voiceCaller.upsert({
      where: { tenantId_phoneNumber: { tenantId, phoneNumber } },
      create: { tenantId, phoneNumber, facts: merged },
      update: { facts: merged },
    });

    this.logger.debug(`Merged facts for ${phoneNumber}: ${JSON.stringify(merged)}`);
    return merged;
  }

  async clearFacts(tenantId: string, phoneNumber: string): Promise<void> {
    await this.prisma.voiceCaller.updateMany({
      where: { tenantId, phoneNumber },
      data: { facts: {} },
    });
  }
}
