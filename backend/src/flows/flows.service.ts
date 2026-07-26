import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFlowDto, UpdateFlowDto } from './dto/flow.dto';

@Injectable()
export class FlowsService {
  constructor(private prisma: PrismaService) {}

  private async currentTenantId(): Promise<string> {
    const tenant = await this.prisma.tenant.findFirstOrThrow();
    return tenant.id;
  }

  async create(dto: CreateFlowDto) {
    const tenantId = await this.currentTenantId();
    // Only one default flow at a time — it's what a fresh conversation starts on.
    if (dto.isDefault) {
      await this.prisma.flow.updateMany({ where: { tenantId }, data: { isDefault: false } });
    }
    return this.prisma.flow.create({
      data: {
        tenantId,
        name: dto.name,
        nodes: dto.nodes ?? [],
        edges: dto.edges ?? [],
        triggerKeywords: dto.triggerKeywords ?? [],
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async findAll() {
    const tenantId = await this.currentTenantId();
    return this.prisma.flow.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' } });
  }

  async findOne(id: string) {
    const flow = await this.prisma.flow.findUnique({ where: { id } });
    if (!flow) throw new NotFoundException('Flow not found');
    return flow;
  }

  async update(id: string, dto: UpdateFlowDto) {
    const flow = await this.prisma.flow.findUnique({ where: { id } });
    if (!flow) throw new NotFoundException('Flow not found');
    if (dto.isDefault) {
      await this.prisma.flow.updateMany({ where: { tenantId: flow.tenantId, id: { not: id } }, data: { isDefault: false } });
    }
    return this.prisma.flow.update({ where: { id }, data: dto as any });
  }

  async remove(id: string) {
    const flow = await this.prisma.flow.findUnique({ where: { id } });
    if (!flow) throw new NotFoundException('Flow not found');
    return this.prisma.flow.delete({ where: { id } });
  }
}
