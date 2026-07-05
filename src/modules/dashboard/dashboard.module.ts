import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { GetDashboardUseCase } from './use-cases/get-dashboard.use-case';

@Module({
  controllers: [DashboardController],
  providers: [GetDashboardUseCase],
  exports: [GetDashboardUseCase],
})
export class DashboardModule {}
