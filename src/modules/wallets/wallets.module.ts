import { Module } from '@nestjs/common';
import { WalletsController } from './wallets.controller';

// Import Use Cases
import { CreateWalletUseCase } from './use-cases/create-wallet.use-case';
import { GetWalletBalanceUseCase } from './use-cases/get-wallet-balance.use-case';
import { GetWalletLedgerUseCase } from './use-cases/get-wallet-ledger.use-case';
import { UpdateWalletStatusUseCase } from './use-cases/update-wallet-status.use-case';
import { TransferUseCase } from './use-cases/transfer.use-case';
import { GenerateStatementUseCase } from './use-cases/generate-statement.use-case';
import { UpdateKycUseCase } from './use-cases/update-kyc.use-case';
import { ListWalletsUseCase } from './use-cases/list-wallets.use-case';
import { GetWalletDetailUseCase } from './use-cases/get-wallet-detail.use-case';

@Module({
  controllers: [WalletsController],
  providers: [
    CreateWalletUseCase,
    GetWalletBalanceUseCase,
    GetWalletLedgerUseCase,
    UpdateWalletStatusUseCase,
    TransferUseCase,
    GenerateStatementUseCase,
    UpdateKycUseCase,
    ListWalletsUseCase,
    GetWalletDetailUseCase,
  ],
  exports: [
    CreateWalletUseCase,
    GetWalletBalanceUseCase,
    GetWalletLedgerUseCase,
    UpdateWalletStatusUseCase,
    TransferUseCase,
    GenerateStatementUseCase,
    UpdateKycUseCase,
    ListWalletsUseCase,
    GetWalletDetailUseCase,
  ],
})
export class WalletsModule {}
