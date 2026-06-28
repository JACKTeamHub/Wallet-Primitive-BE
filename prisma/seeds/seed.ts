import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with Wallet Primitive mock structures...');

  // 1. Create Workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: 'seed-workspace-id-12345' },
    update: {},
    create: {
      id: 'seed-workspace-id-12345',
      name: 'Nomba Hackathon Workspace',
    },
  });
  console.log(`Workspace created/verified: ${workspace.name} (${workspace.id})`);

  // 2. Create Developer User
  // Simple SHA-256 hashing for seed password (or bcrypt hash)
  const passwordHash = crypto.createHash('sha256').update('password123').digest('hex');
  const user = await prisma.developerUser.upsert({
    where: { email: 'dev@nomba.com' },
    update: {},
    create: {
      email: 'dev@nomba.com',
      passwordHash,
      workspaceId: workspace.id,
    },
  });
  console.log(`Developer User created: ${user.email}`);

  // 3. Create API Key
  const rawApiKey = 'wp_test_1234567890';
  const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');
  await prisma.apiKey.upsert({
    where: { keyHash },
    update: {},
    create: {
      keyHash,
      name: 'Development Test Key',
      workspaceId: workspace.id,
    },
  });
  console.log(`API Key seeded: ${rawApiKey} (Use this for Authorization: Bearer ${rawApiKey})`);

  // 4. Create Encrypted Nomba Credentials
  // Encryption parameters matching AES-256-GCM encryption strategy
  const fakeNombaCredentials = {
    clientId: 'nomba-client-id-xyz',
    clientSecret: 'nomba-client-secret-abc',
    accountId: 'nomba-account-123',
  };
  
  // Note: For seed simplicity, we save these plaintext or placeholder encrypted values
  await prisma.nombaCredential.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      clientId: fakeNombaCredentials.clientId,
      clientSecret: fakeNombaCredentials.clientSecret,
      accountId: fakeNombaCredentials.accountId,
      workspaceId: workspace.id,
    },
  });
  console.log('Seed Nomba Credentials created.');

  // 5. Create Customer
  const customer = await prisma.customer.upsert({
    where: {
      workspaceId_email: {
        workspaceId: workspace.id,
        email: 'customer@johndoe.com',
      },
    },
    update: {},
    create: {
      email: 'customer@johndoe.com',
      name: 'John Doe',
      workspaceId: workspace.id,
    },
  });
  console.log(`Customer created: ${customer.name}`);

  // 6. Create Wallet
  const wallet = await prisma.wallet.upsert({
    where: { accountNumber: '1029384756' },
    update: {},
    create: {
      customerId: customer.id,
      workspaceId: workspace.id,
      accountNumber: '1029384756',
      bankName: 'Nomba Microfinance Bank',
      balance: 50000.0, // Initial balance 50,000.00
      status: 'ACTIVE',
    },
  });
  console.log(`Persistent Wallet created: ${wallet.accountNumber} (Balance: ${wallet.balance})`);

  // 7. Add Initial Ledger Entry
  const ledgerCount = await prisma.ledgerEntry.count({
    where: { walletId: wallet.id },
  });
  if (ledgerCount === 0) {
    await prisma.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        workspaceId: workspace.id,
        type: 'CREDIT',
        amount: 50000.0,
        runningBalance: 50000.0,
        status: 'SUCCESS',
        description: 'Initial Wallet Provisioning Deposit',
        nombaRef: 'init-dep-tx-ref-999',
      },
    });
    console.log('Seeded initial CREDIT ledger entry.');
  }

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
