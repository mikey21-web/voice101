import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PendingApprovalItem {
  id: string;
  type: string;
  summary: string;
  amountPaise?: string;
  requestedAt: Date;
  link: { module: string; id: string };
}

/**
 * One screen's worth of "what needs my approval right now" (spec 56.5's
 * Approvals tab), reading each already-tested module's own pending state
 * instead of forcing everything through the generic ApprovalRequest model.
 */
@Injectable()
export class ApprovalsAggregatorService {
  constructor(private prisma: PrismaService) {}

  async findPending(tenantId: string): Promise<PendingApprovalItem[]> {
    const approvalRequests = await this.prisma.approvalRequest.findMany({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    const items: PendingApprovalItem[] = [];

    for (const a of approvalRequests) {
      items.push({
        id: `approval:${a.id}`,
        type: a.type,
        summary: a.reason || `${a.type} approval for ${a.entityType}`,
        amountPaise: a.amountPaise?.toString(),
        requestedAt: a.createdAt,
        link: { module: 'approvals', id: a.id },
      });
    }

    return items.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }
}
