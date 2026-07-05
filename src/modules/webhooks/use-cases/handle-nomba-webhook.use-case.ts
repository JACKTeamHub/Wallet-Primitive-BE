import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@generated/prisma/client';
import { KYC_LIMITS } from '../../../shared/utils/kyc-limits.util';
import * as crypto from 'crypto';

@Injectable()
export class HandleNombaWebhookUseCase {
  private readonly logger = new Logger(HandleNombaWebhookUseCase.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.webhookSecret =
      this.configService.get<string>('NOMBA_WEBHOOK_SECRET') ||
      'NombaHackathon2026';
  }

  async execute(
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

    // Validate timestamp drift (replay protection) - maximum 5 minutes allowed in production
    const eventTime = new Date(timestamp);
    const timeDifference = Math.abs(Date.now() - eventTime.getTime());
    if (
      this.configService.get<string>('NODE_ENV') === 'production' &&
      (isNaN(timeDifference) || timeDifference > 5 * 60 * 1000)
    ) {
      this.logger.error(
        `[NOMBA WEBHOOK] Replay attack check failed. Time drift: ${timeDifference}ms`,
      );
      throw new UnauthorizedException(
        'Webhook request expired (time drift exceeds 5 minutes)',
      );
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

    if (payload.event_type === 'payment_success') {
      const transaction = payload.data?.transaction || {};
      const aliasAccountNumber = transaction.aliasAccountNumber;
      const amount = transaction.transactionAmount;
      const transactionId = transaction.transactionId;
      const sessionId = transaction.sessionId;
      const narration = transaction.narration;

      if (!aliasAccountNumber || amount === undefined || !transactionId) {
        this.logger.warn('[NOMBA WEBHOOK] Missing payment details in payload');
        return {
          status: 'ignored',
          message: 'Missing key transaction variables',
        };
      }

      const alreadyProcessed = await this.prisma.processedWebhook.findUnique({
        where: { eventRef: transactionId },
      });

      if (alreadyProcessed) {
        this.logger.log(
          `[NOMBA WEBHOOK] Event ${transactionId} has already been processed. Skipping.`,
        );
        return {
          status: 'success',
          message: 'Already processed (idempotent)',
        };
      }

      const wallet = await this.prisma.wallet.findUnique({
        where: { accountNumber: aliasAccountNumber },
      });

      if (wallet) {
        const creditAmount = new Prisma.Decimal(amount);

        const limits = KYC_LIMITS[wallet.kycTier];
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // Fetch daily credit sum
        const aggregate = await this.prisma.ledgerEntry.aggregate({
          where: {
            walletId: wallet.id,
            type: 'CREDIT',
            status: 'SUCCESS',
            createdAt: { gte: startOfDay },
          },
          _sum: { amount: true },
        });

        const dailySum = (aggregate._sum.amount || new Prisma.Decimal(0)).add(creditAmount);
        const exceedsSingleLimit = creditAmount.gt(limits.singleTxLimit);
        const exceedsDailyLimit = dailySum.gt(limits.dailyLimit);

        if (
          wallet.status === 'FROZEN' ||
          wallet.status === 'CLOSED' ||
          exceedsSingleLimit ||
          exceedsDailyLimit
        ) {
          let quarantineReason = `Wallet is ${wallet.status}`;
          if (exceedsSingleLimit) {
            quarantineReason = `Exceeds single transaction limit of NGN ${limits.singleTxLimit.toFixed(2)} for ${wallet.kycTier}`;
          } else if (exceedsDailyLimit) {
            quarantineReason = `Exceeds daily deposit limit of NGN ${limits.dailyLimit.toFixed(2)} for ${wallet.kycTier}`;
          }

          this.logger.warn(
            `[NOMBA WEBHOOK] Wallet ${wallet.id} transaction quarantined. Reason: ${quarantineReason}.`,
          );

          await this.prisma.$transaction(async (tx) => {
            await tx.processedWebhook.create({
              data: {
                eventRef: transactionId,
                workspaceId: wallet.workspaceId,
              },
            });

            await tx.ledgerEntry.create({
              data: {
                walletId: wallet.id,
                workspaceId: wallet.workspaceId,
                type: 'CREDIT',
                amount: creditAmount,
                runningBalance: wallet.balance, // Balance does not increase
                status: 'QUARANTINED',
                nombaRef: transactionId,
                sessionId: sessionId || null,
                description: narration || `Quarantined Deposit: ${quarantineReason}`,
              },
            });
          });

          return {
            status: 'quarantined',
            message: `Deposit quarantined: ${quarantineReason}`,
          };
        }

        await this.prisma.$transaction(async (tx) => {
          const currentWallet = await tx.wallet.findUnique({
            where: { id: wallet.id },
          });

          if (!currentWallet) {
            throw new NotFoundException('Wallet missing during execution');
          }

          const newBalance = currentWallet.balance.add(creditAmount);

          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: newBalance },
          });

          await tx.processedWebhook.create({
            data: {
              eventRef: transactionId,
              workspaceId: wallet.workspaceId,
            },
          });

          await tx.ledgerEntry.create({
            data: {
              walletId: wallet.id,
              workspaceId: wallet.workspaceId,
              type: 'CREDIT',
              amount: creditAmount,
              runningBalance: newBalance,
              nombaRef: transactionId,
              sessionId: sessionId || null,
              description: narration || `Nomba Webhook Deposit of ${amount}`,
            },
          });
        });

        this.logger.log(
          `[NOMBA WEBHOOK] Successfully credited persistent wallet ${wallet.id} with ${amount}.`,
        );
      } else {
        // Look up Temporary Account
        const tempAccount = await this.prisma.temporaryAccount.findUnique({
          where: { accountNumber: aliasAccountNumber },
        });

        if (!tempAccount) {
          this.logger.warn(
            `[NOMBA WEBHOOK] No wallet or temporary account found matching account number: ${aliasAccountNumber}`,
          );
          return {
            status: 'Not Found',
            message: 'Matching virtual account not found',
          };
        }

        if (tempAccount.status === 'EXPIRED') {
          this.logger.warn(
            `[NOMBA WEBHOOK] Rejected deposit of ${amount} to expired account: ${aliasAccountNumber}`,
          );
          return {
            status: 'ignored',
            message: 'Virtual account expired',
          };
        }

        const creditAmount = new Prisma.Decimal(amount);

        await this.prisma.$transaction(async (tx) => {
          const currentTempAccount = await tx.temporaryAccount.findUnique({
            where: { id: tempAccount.id },
          });

          if (!currentTempAccount) {
            throw new NotFoundException(
              'Temporary checkout account missing during execution',
            );
          }

          const newReceivedAmount =
            currentTempAccount.receivedAmount.add(creditAmount);
          const isFullyFunded = newReceivedAmount.gte(
            currentTempAccount.expectedAmount,
          );
          const newStatus = isFullyFunded ? 'FUNDED' : 'ACTIVE';

          await tx.temporaryAccount.update({
            where: { id: tempAccount.id },
            data: {
              receivedAmount: newReceivedAmount,
              status: newStatus,
            },
          });

          await tx.processedWebhook.create({
            data: {
              eventRef: transactionId,
              workspaceId: tempAccount.workspaceId,
            },
          });
        });

        this.logger.log(
          `[NOMBA WEBHOOK] Successfully processed temporary virtual account deposit for ${tempAccount.accountNumber}`,
        );
      }
    }

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
