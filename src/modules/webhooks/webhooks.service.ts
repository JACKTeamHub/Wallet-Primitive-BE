import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookSecret =
      this.configService.get<string>('NOMBA_WEBHOOK_SECRET') ||
      'NombaHackathon2026';
  }

  async handleNombaWebhook(
    payload: Record<string, any>,
    headers: Record<string, string>,
  ) {
    const signature = headers['nomba-signature'];
    const timestamp = headers['nomba-timestamp'];

    this.logger.log(
      `[NOMBA WEBHOOK RECEIVED] Event: ${payload.event_type}, RequestID: ${payload.requestId}`,
    );

    if (!signature || !timestamp) {
      this.logger.warn(
        '[NOMBA WEBHOOK] Missing signature or timestamp headers',
      );
      throw new UnauthorizedException('Missing verification headers');
    }

    const isValid = this.verifySignature(
      payload,
      this.webhookSecret,
      timestamp,
      signature,
    );
    if (!isValid) {
      this.logger.error('[NOMBA WEBHOOK] Invalid webhook signature detected');
      throw new UnauthorizedException('Invalid signature');
    }

    this.logger.log(
      `[NOMBA WEBHOOK] Verification successful for RequestID: ${payload.requestId}`,
    );

    return {
      status: 'success',
      message: 'Webhook processed and verified',
      timestamp: new Date().toISOString(),
    };
  }

  private verifySignature(
    payload: any,
    secret: string,
    timestamp: string,
    expectedSignature: string,
  ): boolean {
    try {
      const eventType = payload.event_type || '';
      const requestId = payload.requestId || '';
      const merchant = payload.data?.merchant || {};
      const transaction = payload.data?.transaction || {};

      const userId = merchant.userId || '';
      const walletId = merchant.walletId || '';
      const transactionId = transaction.transactionId || '';
      const type = transaction.type || '';
      const time = transaction.time || '';

      let responseCode = transaction.responseCode || '';
      if (responseCode === null || responseCode === 'null') {
        responseCode = '';
      }

      const hashingPayload = [
        eventType,
        requestId,
        userId,
        walletId,
        transactionId,
        type,
        time,
        responseCode,
        timestamp,
      ].join(':');

      this.logger.debug(
        `[NOMBA SIGNATURE VERIFICATION] Hashing payload: [${hashingPayload}]`,
      );

      // Generate HMAC SHA256 and convert to Base64
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(hashingPayload);
      const generatedSignature = hmac.digest('base64');

      return generatedSignature === expectedSignature;
    } catch (error) {
      this.logger.error('Error verifying signature:', error);
      return false;
    }
  }
}
