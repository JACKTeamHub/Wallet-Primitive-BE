import { Module } from '@nestjs/common';
import { TemporaryAccountsService } from './temporary-accounts.service';
import { TemporaryAccountsController } from './temporary-accounts.controller';

@Module({
  controllers: [TemporaryAccountsController],
  providers: [TemporaryAccountsService],
  exports: [TemporaryAccountsService],
})
export class TemporaryAccountsModule {}
