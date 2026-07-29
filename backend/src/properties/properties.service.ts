import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PropertyStatus, PropertyType } from '@prisma/client';
import { saveUploadedFile, deleteUploadedFile } from '../shared/file-storage.util';
import OpenAI from 'openai';
import { CreatePropertyDto } from './dto/create-property.dto';

function slugify(title: string): string {
  const base = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${base || 'listing'}-${Math.random().toString(36).slice(2, 7)}`;
}

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);
  private aiClient: OpenAI | undefined;

  constructor(private prisma: PrismaService, private config: ConfigService) {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    const baseURL = this.config.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1';
    if (apiKey) {
      this.aiClient = new OpenAI({ apiKey, baseURL, timeout: 20000, maxRetries: 1 });
    }
  }

  async create(data: {
    tenantId: string;
    title: string;
    description?: string;
    propertyType?: any;
    status?: any;
    price?: number;
    currency?: string;
    bedrooms?: number;
    bathrooms?: number;
    areaSqft?: number;
    location?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    features?: string[];
    amenities?: string[];
    reraId?: string;
    featured?: boolean;
    availableFrom?: Date;
    images?: { url: string; caption?: string; isPrimary?: boolean }[];
  }) {
    const { images, ...propertyData } = data;

    return this.prisma.property.create({
      data: {
        ...propertyData,
        slug: slugify(propertyData.title),
        images: images?.length
          ? { create: images.map((img, i) => ({ url: img.url, caption: img.caption, isPrimary: img.isPrimary ?? i === 0, orderIndex: i })) }
          : undefined,
      },
      include: { images: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  async findAll(query: {
    tenantId: string;
    propertyType?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    location?: string;
    featured?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const { tenantId, propertyType, status, minPrice, maxPrice, bedrooms, location, featured, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: Prisma.PropertyWhereInput = { tenantId, deletedAt: null };

    if (propertyType) where.propertyType = propertyType as any;
    if (status) where.status = status as any;
    if (featured !== undefined) where.featured = featured;
    if (bedrooms) where.bedrooms = bedrooms;
    if (location) where.location = { contains: location, mode: 'insensitive' };
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    const orderBy: any = {};
    const sortField = sortBy === 'price' ? 'price' : sortBy === 'bedrooms' ? 'bedrooms' : sortBy === 'areaSqft' ? 'areaSqft' : 'createdAt';
    orderBy[sortField] = sortOrder;

    const [data, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip: (+page - 1) * +limit,
        take: +limit,
        orderBy,
        include: { images: { orderBy: { orderIndex: 'asc' }, take: 5 } },
      }),
      this.prisma.property.count({ where }),
    ]);

    return { data, meta: { total, page: +page, limit: +limit } };
  }

  async search(tenantId: string, query: {
    text?: string;
    propertyType?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    minArea?: number;
    maxArea?: number;
    location?: string;
    status?: string;
    limit?: number;
  }) {
    const { text, propertyType, minPrice, maxPrice, bedrooms, minArea, maxArea, location, status, limit = 10 } = query;

    const where: Prisma.PropertyWhereInput = { tenantId, deletedAt: null, status: PropertyStatus.AVAILABLE };

    if (text) {
      where.OR = [
        { title: { contains: text, mode: 'insensitive' } },
        { description: { contains: text, mode: 'insensitive' } },
        { location: { contains: text, mode: 'insensitive' } },
        { address: { contains: text, mode: 'insensitive' } },
      ];
    }
    if (propertyType) where.propertyType = propertyType as any;
    if (status) where.status = status as any;
    if (bedrooms) where.bedrooms = bedrooms;
    if (location) where.location = { contains: location, mode: 'insensitive' };
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }
    if (minArea !== undefined || maxArea !== undefined) {
      where.areaSqft = {};
      if (minArea !== undefined) where.areaSqft.gte = minArea;
      if (maxArea !== undefined) where.areaSqft.lte = maxArea;
    }

    return this.prisma.property.findMany({
      where,
      take: +limit,
      orderBy: { featured: 'desc' },
      include: { images: { where: { isPrimary: true }, take: 1 } },
    });
  }

  async findOne(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: { images: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async update(id: string, data: any) {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');

    const { images, ...propertyData } = data;

    if (images) {
      await this.prisma.propertyImage.deleteMany({ where: { propertyId: id } });
      if (images.length > 0) {
        await this.prisma.propertyImage.createMany({
          data: images.map((img: any, i: number) => ({
            propertyId: id,
            url: img.url,
            caption: img.caption,
            isPrimary: img.isPrimary ?? i === 0,
            orderIndex: i,
          })),
        });
      }
    }

    return this.prisma.property.update({
      where: { id },
      data: propertyData,
      include: { images: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  async remove(id: string) {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');
    return this.prisma.property.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async addImages(propertyId: string, files: Express.Multer.File[]) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId }, include: { images: true } });
    if (!property) throw new NotFoundException('Property not found');

    const startIndex = property.images.length;
    const hasPrimary = property.images.some(i => i.isPrimary);
    return this.prisma.$transaction(
      files.map((file, i) => {
        const url = saveUploadedFile(file, 'property-images');
        return this.prisma.propertyImage.create({
          data: { propertyId, url, isPrimary: !hasPrimary && i === 0, orderIndex: startIndex + i },
        });
      }),
    );
  }

  async removeImage(propertyId: string, imageId: string) {
    const image = await this.prisma.propertyImage.findUnique({ where: { id: imageId } });
    if (!image || image.propertyId !== propertyId) throw new NotFoundException('Image not found');
    deleteUploadedFile(image.url);
    return this.prisma.propertyImage.delete({ where: { id: imageId } });
  }

  async setBrochure(propertyId: string, file: Express.Multer.File) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found');
    if (property.brochureUrl) deleteUploadedFile(property.brochureUrl);
    const url = saveUploadedFile(file, 'property-brochures');
    return this.prisma.property.update({ where: { id: propertyId }, data: { brochureUrl: url } });
  }

  async removeBrochure(propertyId: string) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found');
    deleteUploadedFile(property.brochureUrl);
    return this.prisma.property.update({ where: { id: propertyId }, data: { brochureUrl: null } });
  }

  // Public, unauthenticated listing page — the shareable link Mikey sends to leads.
  async getPublicBySlug(slug: string) {
    const property = await this.prisma.property.findUnique({
      where: { slug },
      include: { images: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!property || property.deletedAt) throw new NotFoundException('Listing not found');
    await this.prisma.property.update({ where: { id: property.id }, data: { viewCount: { increment: 1 } } });

    const profile = await this.prisma.publicProfile.findUnique({ where: { tenantId: property.tenantId } });
    return { ...property, whatsapp: profile?.whatsapp };
  }

  async getPublicLink(propertyId: string, dashboardUrl: string) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found');
    const slug = property.slug ?? (await this.prisma.property.update({
      where: { id: propertyId },
      data: { slug: slugify(property.title) },
    })).slug;
    return { url: `${dashboardUrl.replace(/\/$/, '')}/#/listing/${slug}` };
  }

  // A "collection" is just several properties' slugs joined in one URL — no
  // separate table, so there's nothing to name/manage/rename later. If that
  // becomes a real ask (saved, editable collections), add a Collection model then.
  async getPublicCollectionLink(propertyIds: string[], dashboardUrl: string) {
    const slugs: string[] = [];
    for (const id of propertyIds.slice(0, 6)) {
      const property = await this.prisma.property.findUnique({ where: { id } });
      if (!property) continue;
      const slug = property.slug ?? (await this.prisma.property.update({
        where: { id },
        data: { slug: slugify(property.title) },
      })).slug;
      slugs.push(slug!);
    }
    if (!slugs.length) throw new NotFoundException('No valid properties found');
    return { url: `${dashboardUrl.replace(/\/$/, '')}/#/collection/${slugs.join(',')}` };
  }

  async getPublicCollection(slugs: string[]) {
    const properties = await this.prisma.property.findMany({
      where: { slug: { in: slugs }, deletedAt: null },
      include: { images: { orderBy: { orderIndex: 'asc' }, take: 1 } },
    });
    if (!properties.length) throw new NotFoundException('No listings found');
    await this.prisma.property.updateMany({
      where: { id: { in: properties.map(p => p.id) } },
      data: { viewCount: { increment: 1 } },
    });
    // Preserve the order the slugs were requested in, not DB order.
    return slugs.map(s => properties.find(p => p.slug === s)).filter(Boolean);
  }

  // Paste a free-text (e.g. WhatsApp) property description, AI drafts the structured fields.
  // Returns a draft only — the broker reviews/edits before POST /properties actually creates it.
  async extractFromText(text: string): Promise<Partial<CreatePropertyDto>> {
    if (!this.aiClient) return {};
    const trimmed = (text || '').slice(0, 3000);
    if (!trimmed.trim()) return {};

    try {
      const completion = await this.aiClient.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are Mikey, extracting real estate listing details from a broker's free-text description (often pasted from WhatsApp). Respond with ONLY JSON matching this shape (omit fields you cannot determine):
{
  "title": "short listing title",
  "description": "cleaned-up full description",
  "propertyType": one of ${Object.values(PropertyType).join('|')},
  "price": number (in the stated currency, no symbols/commas),
  "currency": "INR" by default unless stated otherwise,
  "bedrooms": number,
  "bathrooms": number,
  "areaSqft": number,
  "location": "area/locality",
  "address": "full address if given",
  "features": ["short", "tags"],
  "amenities": ["short", "tags"]
}
Return ONLY valid JSON, no prose.`,
          },
          { role: 'user', content: trimmed },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const parsed = JSON.parse(completion.choices[0].message.content || '{}');
      const draft: Partial<CreatePropertyDto> = {};

      if (typeof parsed.title === 'string') draft.title = parsed.title.slice(0, 200);
      if (typeof parsed.description === 'string') draft.description = parsed.description.slice(0, 3000);
      if (Object.values(PropertyType).includes(parsed.propertyType)) draft.propertyType = parsed.propertyType;
      if (typeof parsed.price === 'number' && parsed.price > 0) draft.price = parsed.price;
      if (typeof parsed.currency === 'string') draft.currency = parsed.currency.slice(0, 10);
      if (typeof parsed.bedrooms === 'number' && parsed.bedrooms >= 0) draft.bedrooms = Math.round(parsed.bedrooms);
      if (typeof parsed.bathrooms === 'number' && parsed.bathrooms >= 0) draft.bathrooms = Math.round(parsed.bathrooms);
      if (typeof parsed.areaSqft === 'number' && parsed.areaSqft > 0) draft.areaSqft = parsed.areaSqft;
      if (typeof parsed.location === 'string') draft.location = parsed.location.slice(0, 200);
      if (typeof parsed.address === 'string') draft.address = parsed.address.slice(0, 300);
      if (Array.isArray(parsed.features)) draft.features = parsed.features.filter((f: unknown) => typeof f === 'string').slice(0, 20);
      if (Array.isArray(parsed.amenities)) draft.amenities = parsed.amenities.filter((a: unknown) => typeof a === 'string').slice(0, 20);

      return draft;
    } catch (e: any) {
      this.logger.warn(`Property extraction failed: ${e.message}`);
      return {};
    }
  }
}
