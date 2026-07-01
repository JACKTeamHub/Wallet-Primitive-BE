import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { EncryptionService } from '@infrastructure/encryption/encryption.service';
import { PrismaService } from '@infrastructure/prisma/prisma.service';

@Injectable()
export class NombaService {
  private readonly logger = new Logger(NombaService.name);
  private readonly baseUrl = 'https://sandbox.nomba.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

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

      const body = (await response.json()) as { access_token: string };
      return body.access_token;
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
      const response = await fetch(`${this.baseUrl}/v1/accounts/virtual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          accountId: credentials.accountId,
        },
        body: JSON.stringify({
          accountRef: params.accountRef,
          accountName: params.accountName,
          bvn: params.bvn || '22222222222', // default sandbox BVN
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
}
