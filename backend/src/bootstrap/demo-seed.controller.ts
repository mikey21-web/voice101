import { Controller, Post, Delete, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DemoSeedService } from './demo-seed.service';

@ApiTags('Demo')
@Controller('demo-seed')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DemoSeedController {
  constructor(private service: DemoSeedService) {}

  @Post()
  // Owner only. This wipes and rewrites demo data, which is not something a
  // sales agent should be able to trigger on a tenant that is being used.
  @Roles('OWNER')
  @ApiOperation({ summary: 'Fill this tenant with a believable demo pipeline' })
  seed(@Req() req: any) {
    return this.service.seed(req.user.tenantId, req.user.id);
  }

  @Delete()
  @Roles('OWNER')
  @ApiOperation({ summary: 'Remove everything the demo seed created' })
  wipe(@Req() req: any) {
    return this.service.wipe(req.user.tenantId);
  }
}
