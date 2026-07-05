import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';

// Import Use Case
import { HandleNombaWebhookUseCase } from './use-cases/handle-nomba-webhook.use-case';

@ApiTags('webhooks')
@Controller('webhook')
export class WebhooksController {
  constructor(
    private readonly handleNombaWebhookUseCase: HandleNombaWebhookUseCase,
  ) {}

  @Post('nomba')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive incoming webhook events from Nomba' })
  @ApiHeader({
    name: 'nomba-signature',
    description: 'HMAC-SHA256 signature of the webhook payload',
    required: true,
  })
  @ApiHeader({
    name: 'nomba-timestamp',
    description: 'Timestamp when the webhook was generated',
    required: true,
  })
  @ApiBody({
    description: 'Incoming Nomba webhook payload',
    schema: {
      type: 'object',
      properties: {
        event_type: { type: 'string', example: 'payment_success' },
        requestId: { type: 'string', example: 'req_12345' },
        data: {
          type: 'object',
          properties: {
            merchant: {
              type: 'object',
              properties: {
                userId: { type: 'string', example: 'dev-user-id' },
                walletId: { type: 'string', example: 'dev-wallet-id' },
              },
            },
            transaction: {
              type: 'object',
              properties: {
                aliasAccountNumber: { type: 'string', example: '1950215058' },
                transactionAmount: { type: 'number', example: 4000 },
                transactionId: { type: 'string', example: 'tx_abc123' },
                type: { type: 'string', example: 'vact_transfer' },
                time: { type: 'string', example: '2026-07-01T12:00:00.000Z' },
                responseCode: { type: 'string', example: '' },
                narration: { type: 'string', example: 'Test deposit' },
                sessionId: { type: 'string', example: 'sess_123' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(
    @Body() payload: Record<string, any>,
    @Headers() headers: Record<string, string>,
  ) {
    return this.handleNombaWebhookUseCase.execute(payload, headers);
  }
}
