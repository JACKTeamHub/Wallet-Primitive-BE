import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      expandVariables: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const url = new URL(
          configService.get<string>('REDIS_URL') || 'redis://127.0.0.1:6379',
        );
        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port || '6379', 10),
            username: url.username || undefined,
            password: url.password
              ? decodeURIComponent(url.password)
              : undefined,
          },
        };
      },
      inject: [ConfigService],
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
    DashboardModule,
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
