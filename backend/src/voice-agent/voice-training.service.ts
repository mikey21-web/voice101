import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VoiceTrainingService {
  private readonly logger = new Logger(VoiceTrainingService.name);

  constructor(private prisma: PrismaService) {}

  async createExample(
    tenantId: string,
    employeeId: string,
    callId: string | null,
    issue: string,
    correction: string,
    context?: string,
    createdBy?: string,
  ) {
    return this.prisma.voiceTrainingExample.create({
      data: {
        tenantId,
        employeeId,
        callId,
        issue,
        correction,
        context,
        createdBy,
        status: 'active',
      },
    });
  }

  async getExamplesForEmployee(employeeId: string, limit = 5): Promise<string> {
    const examples = await this.prisma.voiceTrainingExample.findMany({
      where: { employeeId, status: 'active' },
      orderBy: { appliedAt: 'desc' },
      take: limit,
    });

    if (examples.length === 0) return '';

    const formatted = examples
      .map((ex, idx) => `${idx + 1}. **Issue**: ${ex.issue}\n   **Fix**: ${ex.correction}`)
      .join('\n\n');

    return `## Past Learning Examples\nApply these lessons from previous calls:\n\n${formatted}`;
  }

  async listExamples(tenantId: string, employeeId?: string, status = 'active') {
    return this.prisma.voiceTrainingExample.findMany({
      where: {
        tenantId,
        employeeId,
        status,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async recordApplied(exampleId: string) {
    return this.prisma.voiceTrainingExample.update({
      where: { id: exampleId },
      data: { appliedAt: new Date() },
    });
  }

  async archiveExample(id: string) {
    return this.prisma.voiceTrainingExample.update({
      where: { id },
      data: { status: 'archived' },
    });
  }
}
