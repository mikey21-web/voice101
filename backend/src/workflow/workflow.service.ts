import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  async create(dto: { name: string; tenantId: string; tags?: string[] }) {
    const workflow = await this.prisma.workflowDefinition.create({
      data: { name: dto.name, tenantId: dto.tenantId, tags: dto.tags || [] },
    });
    await this.prisma.workflowVersion.create({
      data: { workflowId: workflow.id, version: 1, status: 'draft' },
    });
    return workflow;
  }

  async findAll(tenantId: string) {
    return this.prisma.workflowDefinition.findMany({
      where: { tenantId },
      include: { versions: { include: { steps: true, triggers: true }, orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const wf = await this.prisma.workflowDefinition.findFirst({
      where: { id, tenantId },
      include: { versions: { include: { steps: { orderBy: { displayOrder: 'asc' } }, triggers: true, edges: true }, orderBy: { version: 'desc' } } },
    });
    if (!wf) throw new NotFoundException('Workflow not found');
    return wf;
  }

  async update(id: string, dto: { name?: string; tags?: string[] }) {
    return this.prisma.workflowDefinition.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    return this.prisma.workflowDefinition.delete({ where: { id } });
  }

  async publishVersion(workflowId: string) {
    const current = await this.prisma.workflowVersion.findFirst({
      where: { workflowId, status: 'draft' },
      orderBy: { version: 'desc' },
    });
    if (!current) throw new NotFoundException('No draft version found');

    await this.prisma.workflowVersion.updateMany({
      where: { workflowId, status: 'active' },
      data: { status: 'archived' },
    });

    const published = await this.prisma.workflowVersion.update({
      where: { id: current.id },
      data: { status: 'active', publishedAt: new Date() },
    });

    await this.prisma.workflowDefinition.update({ where: { id: workflowId }, data: { active: true } });
    return published;
  }

  async createVersion(workflowId: string, steps: any[], edges: any[], triggers?: any[]) {
    const latest = await this.prisma.workflowVersion.findFirst({
      where: { workflowId }, orderBy: { version: 'desc' },
    });

    const version = await this.prisma.workflowVersion.create({
      data: { workflowId, version: (latest?.version || 0) + 1, status: 'draft' },
    });

    if (steps?.length) {
      await this.prisma.workflowStep.createMany({
        data: steps.map((s, i) => ({
          versionId: version.id, stepKey: s.stepKey, actionType: s.actionType,
          label: s.label, config: s.config || {}, displayOrder: i,
        })),
      });
    }

    if (edges?.length) {
      await this.prisma.workflowEdge.createMany({
        data: edges.map(e => ({ versionId: version.id, ...e })),
      });
    }

    if (triggers?.length) {
      await this.prisma.workflowTrigger.createMany({
        data: triggers.map(t => ({ versionId: version.id, type: t.type, config: t.config || {} })),
      });
    }

    return version;
  }

  async getInstances(workflowId: string) {
    return this.prisma.workflowInstance.findMany({
      where: { workflowId },
      include: { steps: true },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }
}
