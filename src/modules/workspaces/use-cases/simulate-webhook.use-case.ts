import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SimulateWebhookDto } from '../dto/simulate-webhook.dto';
import { HandleNombaWebhookUseCase } from '../../webhooks/use-cases/handle-nomba-webhook.use-case';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';

@Injectable()
export class SimulateWebhookUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly handleNombaWebhookUseCase: HandleNombaWebhookUseCase,
  ) {}

  async execute(workspaceId: string, dto: SimulateWebhookDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const secret =
      this.configService.get<string>('NOMBA_WEBHOOK_SECRET') ||
      'NombaHackathon2026';

    const transactionId =
      dto.transactionId || `mock_tx_${randomUUID().substring(0, 8)}`;
    const timestamp = new Date().toISOString();

    const payload = {
      event_type: 'payment_success',
      requestId: `req_${randomUUID().substring(0, 8)}`,
      data: {
        merchant: {
          userId: 'mock_user_id',
          walletId: 'mock_wallet_id',
        },
        transaction: {
          aliasAccountNumber: dto.accountNumber,
          transactionAmount: dto.amount,
          transactionId,
          type: 'CREDIT',
          time: new Date().toISOString(),
          responseCode: '00',
          narration: dto.narration,
        },
      },
    };

    const hashingPayload = [
      payload.event_type,
      payload.requestId,
      payload.data.merchant.userId,
      payload.data.merchant.walletId,
      payload.data.transaction.transactionId,
      payload.data.transaction.type,
      payload.data.transaction.time,
      payload.data.transaction.responseCode,
      timestamp,
    ].join(':');

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(hashingPayload);
    const generatedSignature = hmac.digest('base64');

    const headers = {
      'nomba-signature': generatedSignature,
      'nomba-timestamp': timestamp,
    };

    return this.handleNombaWebhookUseCase.execute(payload, headers);
  }
}
