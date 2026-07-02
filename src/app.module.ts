import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import configuration from './shared/config/configuration';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AppLoggerModule } from './infrastructure/logger/logger.module';
import { EncryptionModule } from './infrastructure/encryption/encryption.module';
import { NombaModule } from './infrastructure/nomba/nomba.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { CustomersModule } from './modules/customers/customers.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { TemporaryAccountsModule } from './modules/temporary-accounts/temporary-accounts.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { EmailModule } from './infrastructure/email/email.module';
import { BullModule } from '@nestjs/bullmq';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      expandVariables: true,
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    AppLoggerModule,
    PrismaModule,
    EncryptionModule,
    NombaModule,
    WebhooksModule,
    CustomersModule,
    WalletsModule,
    TemporaryAccountsModule,
    WorkspacesModule,
    EmailModule,
    ReconciliationModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
