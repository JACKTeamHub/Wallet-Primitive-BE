import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import configuration from './shared/config/configuration';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AppLoggerModule } from './infrastructure/logger/logger.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      expandVariables: true,
    }),
    AppLoggerModule,
    PrismaModule,
    WebhooksModule,
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
