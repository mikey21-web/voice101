import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PropertyStatus } from '@prisma/client';

@Injectable()
export class PublicProfileService {
  constructor(private prisma: PrismaService) {}

  private async currentTenantId(): Promise<string> {
    const tenant = await this.prisma.tenant.findFirstOrThrow();
    return tenant.id;
  }

  async getMine() {
    const tenantId = await this.currentTenantId();
    // Simple single-table lookup — no joins, so no risk of the ambiguous-column bug
    // that surfaced in Vyuha's equivalent save endpoint.
    return this.prisma.publicProfile.findUnique({ where: { tenantId } });
  }

  async upsertMine(data: any) {
    const tenantId = await this.currentTenantId();
    if (data.slug) {
      const existing = await this.prisma.publicProfile.findUnique({ where: { slug: data.slug } });
      if (existing && existing.tenantId !== tenantId) throw new ConflictException('That URL slug is already taken');
    }
    return this.prisma.publicProfile.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data },
    });
  }

  // Authenticated: the broker's own shareable mini-site link, e.g. for Mikey to send to a lead.
  async getMyLink(dashboardUrl: string) {
    const tenantId = await this.currentTenantId();
    const profile = await this.prisma.publicProfile.findUnique({ where: { tenantId } });
    if (!profile?.slug) throw new NotFoundException('Public profile has no slug yet — set one in Settings first');
    return { url: `${dashboardUrl.replace(/\/$/, '')}/#/org/${profile.slug}` };
  }

  async getPublicBySlug(slug: string) {
    const profile = await this.prisma.publicProfile.findUnique({ where: { slug } });
    if (!profile || !profile.published) throw new NotFoundException('Profile not found');

    // Broker mini-site: list every live property for this tenant alongside the profile.
    const properties = await this.prisma.property.findMany({
      where: { tenantId: profile.tenantId, status: PropertyStatus.AVAILABLE, deletedAt: null },
      include: { images: { orderBy: { orderIndex: 'asc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });

    return { ...profile, properties };
  }
}
