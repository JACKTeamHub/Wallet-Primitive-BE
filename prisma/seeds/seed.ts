import { PrismaClient } from '@generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as crypto from 'crypto';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database with Wallet Primitive mock structures...');

  const encryptionKey =
    process.env.ENCRYPTION_KEY || 'supersecretencryptionkey12345678';

  const encryptHelper = (text: string, keyStr: string): string => {
    const key = Buffer.from(keyStr, 'utf8');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  };

  const passwordHash = crypto
    .createHash('sha256')
    .update('password123')
    .digest('hex');

  // Define workspaces to seed
  const workspacesData = [
    {
      id: 'seed-workspace-chowdeck',
      name: 'Chowdeck Workspace',
      email: 'dev@chowdeck.com',
      rawApiKey: 'wp_live_chowdeck_test_key_123456',
      customerName: 'John Doe',
      customerEmail: 'john@chowdeck.com',
      accountNumber: '1029384756',
      balance: 120500.0,
      transactions: [
        { type: 'CREDIT' as const, amount: 150000.0, desc: 'Investor Funding' },
        { type: 'DEBIT' as const, amount: 29500.0, desc: 'Payout for Logistics dispatch' }
      ]
    },
    {
      id: 'seed-workspace-jumia',
      name: 'Jumia Workspace',
      email: 'dev@jumia.com',
      rawApiKey: 'wp_live_jumia_test_key_123456',
      customerName: 'Mary Smith',
      customerEmail: 'mary@jumia.com',
      accountNumber: '5647382910',
      balance: 450000.0,
      transactions: [
        { type: 'CREDIT' as const, amount: 500000.0, desc: 'Store Settlement Payout' },
        { type: 'DEBIT' as const, amount: 50000.0, desc: 'API Refund for order #JUM-9982' }
      ]
    },
    {
      id: 'seed-workspace-gig',
      name: 'GIG Logistics Workspace',
      email: 'dev@giglogistics.com',
      rawApiKey: 'wp_live_gig_test_key_123456',
      customerName: 'David Johnson',
      customerEmail: 'david@giglogistics.com',
      accountNumber: '8877665544',
      balance: 0.0,
      transactions: [] // Empty wallet ready to receive simulated webhooks
    }
  ];

  for (const data of workspacesData) {
    console.log(`\n--- Seeding ${data.name} ---`);

    // 1. Upsert Workspace
    const workspace = await prisma.workspace.upsert({
      where: { id: data.id },
      update: { name: data.name },
      create: { id: data.id, name: data.name },
    });

    // 2. Upsert Developer User
    const user = await prisma.developerUser.upsert({
      where: { email: data.email },
      update: { verified: true },
      create: {
        email: data.email,
        passwordHash,
        workspaceId: workspace.id,
        verified: true,
      },
    });
    console.log(`Developer User created: ${user.email} (verified: true)`);

    // 3. Upsert API Key
    const keyHash = crypto.createHash('sha256').update(data.rawApiKey).digest('hex');
    await prisma.apiKey.upsert({
      where: { keyHash },
      update: {},
      create: {
        keyHash,
        name: 'Development Demo Key',
        workspaceId: workspace.id,
      },
    });
    console.log(`API Key seeded: ${data.rawApiKey}`);

    // 4. Upsert Nomba Credentials
    const encryptedClientId = encryptHelper(`client-id-${data.id}`, encryptionKey);
    const encryptedClientSecret = encryptHelper(`client-secret-${data.id}`, encryptionKey);
    const encryptedAccountId = encryptHelper(`account-id-${data.id}`, encryptionKey);

    await prisma.nombaCredential.upsert({
      where: { workspaceId: workspace.id },
      update: {
        clientId: encryptedClientId,
        clientSecret: encryptedClientSecret,
        accountId: encryptedAccountId,
      },
      create: {
        clientId: encryptedClientId,
        clientSecret: encryptedClientSecret,
        accountId: encryptedAccountId,
        workspaceId: workspace.id,
      },
    });

    // 5. Upsert Customer
    const customer = await prisma.customer.upsert({
      where: {
        workspaceId_email: {
          workspaceId: workspace.id,
          email: data.customerEmail,
        },
      },
      update: { name: data.customerName },
      create: {
        email: data.customerEmail,
        name: data.customerName,
        workspaceId: workspace.id,
      },
    });
    console.log(`Customer created: ${customer.name}`);

    // 6. Upsert Wallet
    const wallet = await prisma.wallet.upsert({
      where: { accountNumber: data.accountNumber },
      update: { balance: data.balance },
      create: {
        customerId: customer.id,
        workspaceId: workspace.id,
        accountNumber: data.accountNumber,
        bankName: 'Nomba Microfinance Bank',
        balance: data.balance,
        status: 'ACTIVE',
      },
    });
    console.log(`Persistent Wallet created: ${wallet.accountNumber} (Balance: NGN ${wallet.balance})`);

    // 7. Seed Ledger Entries
    const existingLedgerCount = await prisma.ledgerEntry.count({
      where: { walletId: wallet.id },
    });

    if (existingLedgerCount === 0 && data.transactions.length > 0) {
      let currentRunningBalance = 0;
      for (const tx of data.transactions) {
        if (tx.type === 'CREDIT') {
          currentRunningBalance += tx.amount;
        } else {
          currentRunningBalance -= tx.amount;
        }

        await prisma.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            workspaceId: workspace.id,
            type: tx.type,
            amount: tx.amount,
            runningBalance: currentRunningBalance,
            status: 'SUCCESS',
            description: tx.desc,
            nombaRef: `seed_tx_${crypto.randomBytes(6).toString('hex')}`,
          },
        });
      }
      console.log(`Seeded ${data.transactions.length} ledger entries.`);
    }
  }

  console.log('\nDatabase seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
