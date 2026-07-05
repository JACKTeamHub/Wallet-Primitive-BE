import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';

// Import Use Case
import { HandleNombaWebhookUseCase } from './use-cases/handle-nomba-webhook.use-case';

@Module({
  controllers: [WebhooksController],
  providers: [HandleNombaWebhookUseCase],
  exports: [HandleNombaWebhookUseCase],
})
export class WebhooksModule {}
