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
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') || '127.0.0.1',
          port: configService.get<number>('REDIS_PORT') || 6379,
          password: configService.get<string>('REDIS_PASSWORD'),
          ...(configService.get<string>('REDIS_TLS') === 'true' && {
            tls: {},
          }),
        },
      }),
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
