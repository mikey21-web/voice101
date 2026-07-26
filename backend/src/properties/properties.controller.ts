import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, UploadedFiles, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { SearchPropertyDto } from './dto/search-property.dto';

@ApiTags('Properties')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PropertiesController {
  constructor(private service: PropertiesService, private config: ConfigService) {}

  // Public, unauthenticated listing page — the link Mikey shares with leads.
  @Public()
  @Get('properties/public/:slug')
  getPublicListing(@Param('slug') slug: string) {
    return this.service.getPublicBySlug(slug);
  }

  @Get('properties/:id/public-link')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'SALES_AGENT')
  getPublicLink(@Param('id') id: string) {
    const dashboardUrl = this.config.get<string>('DASHBOARD_PUBLIC_URL')
      || this.config.get<string>('PUBLIC_URL', '').replace(/\/api\/?$/, '');
    return this.service.getPublicLink(id, dashboardUrl);
  }

  @Post('properties')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  create(@Body() dto: CreatePropertyDto, @Req() req: any) {
    return this.service.create({
      tenantId: req.user?.tenantId,
      ...dto,
      availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : undefined,
    });
  }

  @Get('properties')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'VIEWER', 'SALES_AGENT')
  findAll(@Query() q: any, @Req() req: any) {
    return this.service.findAll({
      tenantId: req.user?.tenantId,
      propertyType: q.propertyType,
      status: q.status,
      minPrice: q.minPrice ? +q.minPrice : undefined,
      maxPrice: q.maxPrice ? +q.maxPrice : undefined,
      bedrooms: q.bedrooms ? +q.bedrooms : undefined,
      location: q.location,
      featured: q.featured === 'true' ? true : q.featured === 'false' ? false : undefined,
      page: q.page ? +q.page : 1,
      limit: q.limit ? +q.limit : 20,
      sortBy: q.sortBy,
      sortOrder: q.sortOrder,
    });
  }

  @Get('properties/search')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'VIEWER', 'SALES_AGENT')
  search(@Query() q: any, @Req() req: any) {
    const tenantId = q.tenantId || req.user?.tenantId;
    return this.service.search(tenantId, {
      text: q.query || q.text,
      propertyType: q.propertyType,
      minPrice: q.minPrice ? +q.minPrice : undefined,
      maxPrice: q.maxPrice ? +q.maxPrice : undefined,
      bedrooms: q.bedrooms ? +q.bedrooms : undefined,
      minArea: q.minArea ? +q.minArea : undefined,
      maxArea: q.maxArea ? +q.maxArea : undefined,
      location: q.location,
      status: q.status,
      limit: q.limit ? +q.limit : 10,
    });
  }

  @Get('properties/:id')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'VIEWER', 'SALES_AGENT')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch('properties/:id')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdatePropertyDto) {
    return this.service.update(id, dto);
  }

  @Delete('properties/:id')
  @Roles('OWNER', 'ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('properties/:id/images')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 10, { limits: { fileSize: 8 * 1024 * 1024 } }))
  addImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[]) {
    return this.service.addImages(id, files || []);
  }

  @Delete('properties/:id/images/:imageId')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.service.removeImage(id, imageId);
  }

  @Post('properties/:id/brochure')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('brochure', { limits: { fileSize: 20 * 1024 * 1024 } }))
  setBrochure(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.service.setBrochure(id, file);
  }

  @Delete('properties/:id/brochure')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  removeBrochure(@Param('id') id: string) {
    return this.service.removeBrochure(id);
  }

  @Get('tenants/:tenantId/properties')
  @Roles('OWNER', 'ADMIN')
  findByTenant(@Param('tenantId') tenantId: string, @Query() q: any) {
    return this.service.findAll({
      tenantId,
      propertyType: q.propertyType,
      status: q.status,
      page: q.page ? +q.page : 1,
      limit: q.limit ? +q.limit : 20,
    });
  }
}
