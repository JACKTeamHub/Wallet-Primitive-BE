import { Module } from '@nestjs/common';
import { TemporaryAccountsController } from './temporary-accounts.controller';

// Import Use Cases
import { CreateTempAccountUseCase } from './use-cases/create-temp-account.use-case';
import { FindAllTempAccountsUseCase } from './use-cases/find-all-temp-accounts.use-case';
import { FindOneTempAccountUseCase } from './use-cases/find-one-temp-account.use-case';

@Module({
  controllers: [TemporaryAccountsController],
  providers: [
    CreateTempAccountUseCase,
    FindAllTempAccountsUseCase,
    FindOneTempAccountUseCase,
  ],
  exports: [
    CreateTempAccountUseCase,
    FindAllTempAccountsUseCase,
    FindOneTempAccountUseCase,
  ],
})
export class TemporaryAccountsModule {}
