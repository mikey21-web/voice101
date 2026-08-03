import { Module } from '@nestjs/common';
import { UnitHoldsService } from './unit-holds.service';
import { UnitHoldsController } from './unit-holds.controller';
import { AutomationModule } from '../automation/automation.module';

@Module({
  imports: [AutomationModule],
  controllers: [UnitHoldsController],
  providers: [UnitHoldsService],
  exports: [UnitHoldsService],
})
export class UnitHoldsModule {}
