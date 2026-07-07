import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '@infrastructure/encryption/encryption.service';
import { PrismaService } from '@infrastructure/prisma/prisma.service';

@Injectable()
export class NombaService {
  private readonly logger = new Logger(NombaService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('NODE_ENV') === 'production'
        ? 'https://api.nomba.com'
        : 'https://sandbox.nomba.com';
  }

  private async getDecryptedCredentials(workspaceId: string) {
    const credentialRecord = await this.prisma.nombaCredential.findUnique({
      where: { workspaceId },
    });

    if (!credentialRecord) {
      throw new BadRequestException(
        'Nomba credentials are not configured for this workspace. Please register credentials first.',
      );
    }

    try {
      return {
        clientId: this.encryption.decrypt(credentialRecord.clientId),
        clientSecret: this.encryption.decrypt(credentialRecord.clientSecret),
        accountId: this.encryption.decrypt(credentialRecord.accountId),
        subAccountId: credentialRecord.subAccountId
          ? this.encryption.decrypt(credentialRecord.subAccountId)
          : undefined,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to decrypt Nomba credentials for workspace ${workspaceId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Payment gateway decryption failed. Check server encryption key.',
      );
    }
  }

  async getAccessToken(workspaceId: string): Promise<string> {
    const credentials = await this.getDecryptedCredentials(workspaceId);
    const { clientId, clientSecret, accountId } = credentials;

    // Developer explicit mock mode check
    if (clientId.startsWith('mock') || clientSecret.startsWith('mock')) {
      return 'mock-access-token';
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/auth/token/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accountId: accountId,
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Nomba OAuth token request failed: ${response.status} - ${errorText}`,
        );
        throw new UnauthorizedException(
          `Nomba authentication failed: ${errorText || response.statusText}`,
        );
      }

      const body = (await response.json()) as {
        data: { access_token: string };
      };

      this.logger.log(
        `Successfully obtained access token from Nomba. Length: ${body.data.access_token.length}`,
      );

      return body.data.access_token;
    } catch (error: any) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(`Nomba auth request network error: ${error.message}`);
      throw new InternalServerErrorException(
        `Nomba auth network failure: ${error.message}`,
      );
    }
  }

  async createVirtualAccount(
    workspaceId: string,
    params: {
      accountRef: string;
      accountName: string;
      bvn?: string;
      expectedAmount?: string;
      expiryDate?: string;
    },
  ) {
    const credentials = await this.getDecryptedCredentials(workspaceId);
    const token = await this.getAccessToken(workspaceId);

    // Dynamic mock fallback only if using mock credentials
    if (token === 'mock-access-token') {
      return this.generateMockVirtualAccount(
        params.accountRef,
        params.accountName,
      );
    }

    try {
      const url = credentials.subAccountId
        ? `${this.baseUrl}/v1/accounts/virtual/${credentials.subAccountId}`
        : `${this.baseUrl}/v1/accounts/virtual`;

      const webhookUrl =
        this.configService.get<string>('WEBHOOK_URL') ||
        'https://jackwalletprimitive.onrender.com/api/v1/webhook/nomba';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          accountId: credentials.accountId,
        },
        body: JSON.stringify({
          accountRef: params.accountRef,
          accountName: params.accountName,
          bvn: params.bvn || '22222222222',
          callbackUrl: webhookUrl,
          ...(params.expectedAmount && {
            expectedAmount: params.expectedAmount,
          }),
          ...(params.expiryDate && { expiryDate: params.expiryDate }),
        }),
      });

      const body = await response.json();

      if (!response.ok || body.code !== '00') {
        this.logger.error(
          `Nomba API returned error: ${response.status} - ${JSON.stringify(body)}`,
        );
        throw new BadRequestException(
          `Nomba virtual account error: ${body.description || body.message || 'API call failed'}`,
        );
      }

      return {
        bankAccountNumber: body.data.bankAccountNumber,
        bankName: body.data.bankName,
        bankAccountName: body.data.bankAccountName,
        accountRef: body.data.accountRef,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(
        `Nomba virtual account API network error: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to communicate with Nomba: ${error.message}`,
      );
    }
  }

  private generateMockVirtualAccount(accountRef: string, accountName: string) {
    const randomSuffix = Math.floor(
      10000000 + Math.random() * 90000000,
    ).toString();
    const bankAccountNumber = `99${randomSuffix}`;

    return {
      bankAccountNumber,
      bankName: 'Nombank Sandbox Mock',
      bankAccountName: `Nomba/${accountName}`,
      accountRef,
    };
  }

  async lookupTransaction(
    workspaceId: string,
    transactionRef: string,
  ): Promise<{
    status: 'SUCCESS' | 'FAILED';
    amount: number;
    aliasAccountNumber?: string;
  }> {
    const credentials = await this.getDecryptedCredentials(workspaceId);

    if (
      credentials.clientId.startsWith('mock') ||
      credentials.clientSecret.startsWith('mock')
    ) {
      if (transactionRef.startsWith('mock_fail')) {
        return { status: 'FAILED', amount: 0 };
      }
      return {
        status: 'SUCCESS',
        amount: 5000,
        aliasAccountNumber: '7551220992',
      };
    }

    const token = await this.getAccessToken(workspaceId);

    try {
      const url = `${this.baseUrl}/v1/transactions/accounts/single?transactionRef=${transactionRef}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          accountId: credentials.accountId,
        },
      });

      if (!response.ok) {
        throw new Error(`Nomba status inquiry failed: ${response.statusText}`);
      }

      const body = await response.json();
      const txData = body.data || {};
      const status = txData.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
      const amount = txData.amount || 0;
      const aliasAccountNumber = txData.aliasAccountNumber || undefined;

      return { status, amount, aliasAccountNumber };
    } catch (error: any) {
      this.logger.error(
        `[NombaService] Transaction lookup failed: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to verify transaction with Nomba: ${error.message}`,
      );
    }
  }
}
