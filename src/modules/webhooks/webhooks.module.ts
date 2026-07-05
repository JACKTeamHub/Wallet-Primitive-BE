import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';

// Import Use Case
import { HandleNombaWebhookUseCase } from './use-cases/handle-nomba-webhook.use-case';
import { ListWebhooksUseCase } from './use-cases/list-webhooks.use-case';
import { GetWebhookDetailUseCase } from './use-cases/get-webhook-detail.use-case';

@Module({
  controllers: [WebhooksController],
  providers: [
    HandleNombaWebhookUseCase,
    ListWebhooksUseCase,
    GetWebhookDetailUseCase,
  ],
  exports: [
    HandleNombaWebhookUseCase,
    ListWebhooksUseCase,
    GetWebhookDetailUseCase,
  ],
})
export class WebhooksModule {}
