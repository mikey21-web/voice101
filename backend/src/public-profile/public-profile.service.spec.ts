import { Test, TestingModule } from '@nestjs/testing';
import { PublicProfileService } from './public-profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('PublicProfileService', () => {
  let service: PublicProfileService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      tenant: { findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'tenant-1' }) },
      publicProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create, update }) => Promise.resolve({ id: 'pp-1', ...create, ...update })),
      },
      property: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicProfileService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PublicProfileService>(PublicProfileService);
  });

  describe('upsertMine', () => {
    it('should upsert keyed by the current tenant, no joins involved', async () => {
      await service.upsertMine({ companyName: 'Vezraa', slug: 'vezraa' });
      expect(prisma.publicProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
      );
    });

    it('should reject a slug already taken by another tenant', async () => {
      prisma.publicProfile.findUnique.mockResolvedValue({ tenantId: 'other-tenant', slug: 'taken' });
      await expect(service.upsertMine({ slug: 'taken' })).rejects.toThrow(ConflictException);
    });

    it('should allow re-saving your own existing slug', async () => {
      prisma.publicProfile.findUnique.mockResolvedValue({ tenantId: 'tenant-1', slug: 'vezraa' });
      await expect(service.upsertMine({ slug: 'vezraa', tagline: 'Updated' })).resolves.toBeDefined();
    });
  });

  describe('getPublicBySlug', () => {
    it('should throw NotFoundException when unpublished', async () => {
      prisma.publicProfile.findUnique.mockResolvedValue({ slug: 'vezraa', published: false });
      await expect(service.getPublicBySlug('vezraa')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when no profile exists for the slug', async () => {
      prisma.publicProfile.findUnique.mockResolvedValue(null);
      await expect(service.getPublicBySlug('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return the profile when published', async () => {
      prisma.publicProfile.findUnique.mockResolvedValue({ slug: 'vezraa', published: true, companyName: 'Vezraa' });
      const p = await service.getPublicBySlug('vezraa');
      expect(p.companyName).toBe('Vezraa');
    });
  });
});
