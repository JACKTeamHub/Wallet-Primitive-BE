import { Module } from '@nestjs/common';
import { NombaModule } from '@infrastructure/nomba/nomba.module';
import { ReconciliationController } from './reconciliation.controller';

// Import Use Cases
import { ReconcileUseCase } from './use-cases/reconcile.use-case';
import { ListReconciliationsUseCase } from './use-cases/list-reconciliations.use-case';
import { GetReconciliationDetailUseCase } from './use-cases/get-reconciliation-detail.use-case';

@Module({
  imports: [NombaModule],
  controllers: [ReconciliationController],
  providers: [
    ReconcileUseCase,
    ListReconciliationsUseCase,
    GetReconciliationDetailUseCase,
  ],
  exports: [
    ReconcileUseCase,
    ListReconciliationsUseCase,
    GetReconciliationDetailUseCase,
  ],
})
export class ReconciliationModule {}
