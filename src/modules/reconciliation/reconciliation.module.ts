import { Module } from '@nestjs/common';
import { NombaModule } from '@infrastructure/nomba/nomba.module';
import { ReconciliationController } from './reconciliation.controller';

// Import Use Cases
import { ReconcileUseCase } from './use-cases/reconcile.use-case';

@Module({
  imports: [NombaModule],
  controllers: [ReconciliationController],
  providers: [ReconcileUseCase],
  exports: [ReconcileUseCase],
})
export class ReconciliationModule {}
