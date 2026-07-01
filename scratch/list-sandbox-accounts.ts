import { PrismaClient } from '@generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as crypto from 'crypto';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const algorithm = 'aes-256-gcm';
const encryptionKey = process.env.ENCRYPTION_KEY || 'supersecretencryptionkey12345678';
const keyBuffer = Buffer.from(encryptionKey, 'utf8');

function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

async function run() {
  try {
    const credsList = await prisma.nombaCredential.findMany();
    let creds = null;

    for (const c of credsList) {
      const decryptedId = decrypt(c.clientId);
      if (!decryptedId.startsWith('mock')) {
        creds = c;
        break;
      }
    }

    if (!creds) {
      console.log(
        'No real Nomba credentials registered in the database. Please register your credentials first.',
      );
      process.exit(1);
    }

    const clientId = decrypt(creds.clientId);
    const clientSecret = decrypt(creds.clientSecret);
    const accountId = decrypt(creds.accountId);

    console.log('Authenticating with Nomba Sandbox...');

    const tokenResponse = await fetch(
      'https://sandbox.nomba.com/v1/auth/token/issue',
      {
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
      },
    );

    if (!tokenResponse.ok) {
      console.error(
        'Failed to authenticate with Nomba Sandbox:',
        await tokenResponse.text(),
      );
      process.exit(1);
    }

    const tokenData = (await tokenResponse.json()) as any;
    const token = tokenData.data.access_token;

    console.log('Fetching active virtual accounts...');

    const listResponse = await fetch(
      'https://sandbox.nomba.com/v1/accounts/virtual/list',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          accountId: accountId,
        },
        body: JSON.stringify({
          expired: false,
        }),
      },
    );

    if (!listResponse.ok) {
      console.error(
        'Failed to list virtual accounts:',
        await listResponse.text(),
      );
      process.exit(1);
    }

    const listData = (await listResponse.json()) as any;
    const accounts = listData.data.results || [];

    console.log('\n====================================');
    console.log(`FOUND ${accounts.length} SANDBOX VIRTUAL ACCOUNTS`);
    console.log('====================================\n');

    accounts.forEach((acc: any, i: number) => {
      console.log(`Account #${i + 1}:`);
      console.log(`- Bank Name     : ${acc.bankName}`);
      console.log(`- Account Number: ${acc.bankAccountNumber}`);
      console.log(`- Account Name  : ${acc.bankAccountName}`);
      console.log(`- Ref ID        : ${acc.accountRef}`);
      console.log('------------------------------------');
    });
  } catch (err) {
    console.error('Error running script:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
