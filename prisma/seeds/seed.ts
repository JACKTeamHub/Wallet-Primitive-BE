import { PrismaClient } from '@generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as crypto from 'crypto';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const customersTemplate = [
  { name: 'Tunde Bakare', email: 'tunde@bakare.me' },
  { name: 'Chioma Nnaji', email: 'chioma@nnaji.io' },
  { name: 'Abubakar Musa', email: 'abubakar@musa.net' },
  { name: 'Funmi Oyelade', email: 'funmi@oyelade.org' },
  { name: 'Emeka Okafor', email: 'emeka@okafor.com' },
  { name: 'Yinka Shonibare', email: 'yinka@shonibare.co' },
  { name: 'Halima Bello', email: 'halima@bello.dev' },
  { name: 'Nkem Dilim', email: 'nkem@dilim.com' },
  { name: 'Olumide Adewale', email: 'olumide@adewale.com' },
  { name: 'Zainab Kabir', email: 'zainab@kabir.net' },
];

const creditDescriptions = [
  'Deposit via Bank Transfer',
  'Nomba Webhook Deposit',
  'Invoice payment inflow',
  'Reconciliation Credit',
  'Refund for Order #WP-9021',
  'Merchant settlement funding',
];

const debitDescriptions = [
  'Transfer to Bank Account',
  'Utility Bill Payout',
  'Airtime Purchase',
  'Vendor Payout',
  'Card withdrawal',
  'System service fee payout',
];

async function main() {
  console.log('Seeding database with high-volume Wallet Primitive mock structures...');

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

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = `${salt}:${crypto
    .pbkdf2Sync('password123', salt, 10000, 64, 'sha512')
    .toString('hex')}`;

  const workspacesData = [
    {
      id: 'seed-workspace-chowdeck',
      name: 'Chowdeck Workspace',
      email: 'dev@chowdeck. wocom',
      rawApiKey: 'wp_live_chowdeck_test_key_123456',
    },
    {
      id: 'seed-workspace-jumia',
      name: 'Jumia Workspace',
      email: 'dev@jumia.com',
      rawApiKey: 'wp_live_jumia_test_key_123456',
    },
    {
      id: 'seed-workspace-gig',
      name: 'GIG Logistics Workspace',
      email: 'dev@giglogistics.com',
      rawApiKey: 'wp_live_gig_test_key_123456',
    },
  ];

  for (const wData of workspacesData) {
    console.log(`\n--- Seeding Workspace: ${wData.name} ---`);

    // 1. Upsert Workspace
    const workspace = await prisma.workspace.upsert({
      where: { id: wData.id },
      update: { name: wData.name },
      create: { id: wData.id, name: wData.name },
    });

    // 2. Upsert Developer User
    await prisma.developerUser.upsert({
      where: { email: wData.email },
      update: { verified: true },
      create: {
        email: wData.email,
        passwordHash,
        workspaceId: workspace.id,
        verified: true,
      },
    });

    // 3. Upsert API Key
    const keyHash = crypto.createHash('sha256').update(wData.rawApiKey).digest('hex');
    await prisma.apiKey.upsert({
      where: { keyHash },
      update: {},
      create: {
        keyHash,
        name: 'Development Demo Key',
        workspaceId: workspace.id,
      },
    });

    // 4. Upsert Nomba Credentials
    const encryptedClientId = encryptHelper(`client-id-${wData.id}`, encryptionKey);
    const encryptedClientSecret = encryptHelper(`client-secret-${wData.id}`, encryptionKey);
    const encryptedAccountId = encryptHelper(`account-id-${wData.id}`, encryptionKey);

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

    // Clean up existing ledger entries for wallets in this workspace to seed fresh history
    const existingWallets = await prisma.wallet.findMany({
      where: { workspaceId: workspace.id },
    });
    for (const ew of existingWallets) {
      await prisma.ledgerEntry.deleteMany({ where: { walletId: ew.id } });
    }

    // 5. Seed Customers & Wallets & Ledger History
    for (let i = 0; i < customersTemplate.length; i++) {
      const template = customersTemplate[i];
      const customerEmail = `${wData.id}-${i}-${template.email}`;

      const customer = await prisma.customer.upsert({
        where: {
          workspaceId_email: {
            workspaceId: workspace.id,
            email: customerEmail,
          },
        },
        update: { name: template.name },
        create: {
          email: customerEmail,
          name: template.name,
          workspaceId: workspace.id,
        },
      });

      // Generate a static but unique account number for this seed customer
      const customerSeedAccount = `99${(10000000 + i * 7 + wData.name.length * 31).toString().slice(0, 8)}`;
      const wallet = await prisma.wallet.upsert({
        where: { accountNumber: customerSeedAccount },
        update: { status: 'ACTIVE' },
        create: {
          customerId: customer.id,
          workspaceId: workspace.id,
          accountNumber: customerSeedAccount,
          bankName: 'Nombank Sandbox Bank',
          balance: 0.0,
          status: 'ACTIVE',
        },
      });

      // Generate 15 sorted random dates
      const dates: Date[] = [];
      for (let t = 0; t < 15; t++) {
        const backdays = 14 - t;
        const date = new Date();
        date.setDate(date.getDate() - backdays);
        date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
        dates.push(date);
      }
      dates.sort((a, b) => a.getTime() - b.getTime());

      // Generate transactions in chronological order
      let currentBalance = 25000.0; // Start with NGN 25,000 starting cash context

      // Create an initial deposit transaction on the first date
      await prisma.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          workspaceId: workspace.id,
          type: 'CREDIT',
          amount: 25000.0,
          runningBalance: currentBalance,
          status: 'SUCCESS',
          description: 'Initial Wallet Provisioning Deposit',
          nombaRef: `seed_tx_${crypto.randomBytes(6).toString('hex')}`,
          createdAt: dates[0],
        },
      });

      for (let t = 1; t < 15; t++) {
        const isCredit = Math.random() > 0.4 || currentBalance < 15000.0;
        const amount = Math.round(500.0 + Math.random() * 9500.0); // NGN 500 to NGN 10,000
        
        let desc = '';
        if (isCredit) {
          currentBalance += amount;
          desc = creditDescriptions[Math.floor(Math.random() * creditDescriptions.length)];
        } else {
          currentBalance -= amount;
          desc = debitDescriptions[Math.floor(Math.random() * debitDescriptions.length)];
        }

        await prisma.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            workspaceId: workspace.id,
            type: isCredit ? 'CREDIT' : 'DEBIT',
            amount: amount,
            runningBalance: currentBalance,
            status: 'SUCCESS',
            description: desc,
            nombaRef: `seed_tx_${crypto.randomBytes(6).toString('hex')}`,
            createdAt: dates[t],
          },
        });
      }

      // Sync wallet balance to final ledger balance
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: currentBalance },
      });

      console.log(`Seeded Wallet ${wallet.accountNumber} for ${customer.name} with 15 ledger entries. Final Balance: NGN ${currentBalance.toFixed(2)}`);
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
