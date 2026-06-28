import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  async handleNombaWebhook(payload: any, rawBody: string, signature?: string) {
    // Log payload for easy debugging on Railway logs
    this.logger.log(`[NOMBA WEBHOOK RECEIVED] payload: ${JSON.stringify(payload)}`);
    this.logger.log(`[NOMBA WEBHOOK HEADERS] signature: ${signature}`);

    return {
      status: 'success',
      message: 'Nomba webhook received successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
