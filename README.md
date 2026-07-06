# Wallet-Primitive (Backend System)

A secure, multi-tenant B2B payment gateway and double-entry ledger routing engine built on NestJS, integrating directly with **Nomba's Sandbox API**. 

Built for Team **JACK** (Nomba x DevCareers Hackathon 2026).

---

## 🏗️ System Architecture

The master flow below details how developer requests, webhook alerts, cryptographic security, the database, and Nomba's APIs interact:

```mermaid
graph TB
    subgraph Clients ["Integrators & External Servers"]
        DevServer["Developer Server"]
        EndUser["End-User Client"]
    end

    subgraph GW ["Wallet-Primitive Gateway (NestJS Backend)"]
        %% Request handling
        AuthGuard["API Key Guard (SHA-256 Hashing)"]
        
        subgraph Core ["Core Modules"]
            WS["Workspaces & Keys Module"]
            Wallets["Wallets Module"]
            Transfers["Ledger Transfer Engine"]
            Checkouts["Temporary Checkouts Module"]
        end

        subgraph Security ["Security Services"]
            Enc["AES-256-GCM Encryption"]
            WebhookSec["HMAC-SHA256 Sig Check & 5m Replay Guard"]
        end

        subgraph Ledger ["Ledger Engine"]
            RowLocking["Row-Level Locked DB Transaction"]
            DoubleEntry["Double-Entry Ledger Log Writer"]
        end
    end

    subgraph DB ["Fintech Database (PostgreSQL)"]
        TableWorkspaces["Workspaces & Credentials"]
        TableWallets["Customers & Wallets"]
        TableLedgers["Double-Entry Journals"]
        TableAuditLogs["Audit Logs"]
    end

    subgraph Nomba ["Nomba APIs (Sandbox)"]
        NombaOAuth["OAuth Token Manager"]
        NombaVA["Virtual Accounts Endpoint (/accounts/virtual)"]
        NombaWebhookAlerts["Nomba Webhook Dispatcher"]
    end

    %% Flow arrows
    DevServer -->|1. Authenticate with Key| AuthGuard
    AuthGuard -->|Verify Hash| TableWorkspaces
    
    DevServer -->|2. Register Nomba Client Secret| WS
    WS -->|Encrypt Credentials| Enc
    Enc -->|Save Encrypted Credentials| TableWorkspaces
    
    EndUser -->|3. Pay Checkout / Fund Wallet| NombaWebhookAlerts
    NombaWebhookAlerts -->|4. Push Payment Webhook| WebhookSec
    WebhookSec -->|5. Verify Signature & Timestamp| TableWorkspaces
    WebhookSec -->|6. Credit Balance / Set FUNDED| Checkouts
    
    DevServer -->|7. Transfer Funds| Transfers
    Transfers -->|Row Locks & DB Tx| RowLocking
    RowLocking -->|Debit/Credit Balance| TableWallets
    RowLocking -->|Write Balanced Debit/Credit Legs| DoubleEntry
    DoubleEntry -->|Persist Journal Entries| TableLedgers
    
    Wallets & Checkouts -->|8. Create Virtual Account| NombaVA
    NombaVA -->|Authenticate API Call| NombaOAuth
```

---

## 🚀 Core Features

### 1. Clean Architecture Use Cases
* **Modularity**: Code follows the clean interactor pattern. Business rules are completely separated into single-responsibility interactor classes inside a `use-cases/` directory in every module.

### 2. Multi-Tenant Developer Workspaces
* **Onboarding**: Developers can register workspaces and developer accounts.
* **API Key Rotation & Revocation**: Keys are randomly generated (`wp_live_...`), hashed using **SHA-256**, and stored securely. Lost or leaked keys can be listed and deleted/revoked via administrative endpoints.
* **Encrypted Sandbox Credentials**: API client secrets and sub-account IDs are stored using industry-standard **AES-256-GCM encryption at rest**, decrypting only on-demand during Nomba API calls.

### 3. Smart Virtual Wallets & KYC Enforcements
* **Customer Virtual Accounts**: Onboard end-customers and automatically provision virtual wallets powered by Nomba's virtual account APIs.
* **CBN KYC Tier Limits**: Enforces transaction limits for **Tier 1** (NGN 50k single / 100k daily), **Tier 2** (NGN 200k single / 500k daily), and **Tier 3** (NGN 5M single / 10M daily).
* **KYC Upgrade Route**: `PATCH /wallets/:id/kyc` upgrades levels with strict 11-digit regex validation for BVN and NIN.
* **Alphanumeric Name Sanitization**: Automatically cleanses customer and order names (collapsing multiple spaces and stripping non-alphanumeric symbols) to bypass Nomba Sandbox's strict 400 validation constraints.

### 4. Double-Entry Accounting Ledger
* **Atomic Transfers**: Move money internally between customer wallets with zero risk of balance duplication or data corruption.
* **Lock-Safe Balance Operations**: Applies row-level locking during transfers to prevent double-spending under concurrent API requests.
* **Linked Ledgers**: Every transfer writes a balanced `DEBIT` and `CREDIT` leg sharing a unique `transactionGroupId` for full transaction auditing.

### 5. Quarantine & Misdirected Payment Handling
* **Quarantine Trigger**: Webhook deposits directed to `FROZEN` or `CLOSED` wallets, or deposits exceeding the wallet's KYC tier limits, bypass balance updates and are routed to the **Quarantine Ledger** (status `QUARANTINED`).
* **Admin Controls**: Administrative endpoints allow authenticated workspace users to either `release` quarantined funds (requires active wallet status) or `reject` them.
* **Replay Protection / Retry Support**: Webhooks targeting unmatched accounts throw a `404 Not Found` exception to trigger Nomba's automatic exponential retry backoff schedule.

### 6. Dynamic Checkout Temporary Accounts
* **Dynamic Virtual Accounts**: Generate temporary checkout accounts for payments with an `expectedAmount` and an expiration time limit.
* **Automated Status Transitions**: webhooks automatically verify deposit amounts, increment `receivedAmount`, and transition the status to `FUNDED` once the goal is reached.

### 7. Webhook & Access Security
* **HMAC-SHA256 Signatures**: Incoming webhooks are verified using cryptographic signature checks matching Nomba's specifications.
* **Replay Attack Protection**: In production, the system automatically rejects webhooks with a time drift greater than 5 minutes.
* **Salted Passwords**: Passwords are securely hashed using Node's native `crypto.pbkdf2Sync` with a salt prefix, fully protecting against dictionary attacks.
* **Protected OTP Logs**: OTP credentials are prevented from logging in production environments.
* **Audit Trails**: All core financial operations (wallet creation, transfers, manual reconciliation) log to the `AuditLog` table.

---

## 🛠️ Technology Stack
* **Framework**: [NestJS](https://nestjs.com/) (TypeScript)
* **Database**: [PostgreSQL](https://www.postgresql.org/)
* **ORM**: [Prisma](https://www.prisma.io/)
* **Validation**: [Zod](https://zod.dev/) via `nestjs-zod`
* **API Docs**: [Swagger OpenAPI](https://swagger.io/)
* **Env Management**: [Dotenvx](https://dotenvx.com/)

---

## ⚙️ Getting Started

### 1. Prerequisites
Ensure you have the following installed:
* [Node.js](https://nodejs.org/) (v20+)
* [PNPM](https://pnpm.io/)
* [Docker & Docker Compose](https://www.docker.com/)

### 2. Installation
Clone the repository and install dependencies:
```bash
pnpm install
```

### 3. Set Up Environment Variables
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Populate `.env` with your variables (including your GCM `ENCRYPTION_KEY` which must be a 32-character string).

### 4. Run Docker Services (PostgreSQL & Redis)
Spin up the local database and cache services:
```bash
docker compose up -d
```

### 5. Run Database Migrations & Seeds
Apply schema migrations to set up the tables (including KYC and status configurations) and seed the multi-tenant mock organizations:
```bash
pnpm run db:migrate
pnpm run db:seed
```
*Note: The seed script pre-populates three distinct workspace tenants (`Chowdeck Workspace`, `Jumia Workspace`, and `GIG Logistics Workspace`) with pre-verified developer users, wallets, and transaction ledgers to demonstrate absolute workspace isolation.*

### 6. Start the Development Server
```bash
pnpm run start:dev
```
The server will start at `http://localhost:9999`.

---

## 📖 API Documentation & Testing

When the server is running, the interactive Swagger OpenAPI docs are served at:
👉 **`http://localhost:9999/api`**

### Testing Flow (Multi-Tenant Demo):
1. **Authorize**: Click **"Authorize"** at the top right of the Swagger UI. Enter one of the seeded API keys to act as that organization:
   * **Chowdeck API Key**: `wp_live_chowdeck_test_key_123456`
   * **Jumia API Key**: `wp_live_jumia_test_key_123456`
   * **GIG Logistics API Key**: `wp_live_gig_test_key_123456`
2. **Retrieve Wallet**: Call `GET /wallets` or check balance details to observe each organization's isolated wallet structure.
3. **Simulate Deposit Webhooks**: Trigger an incoming payment for the tenant's wallet using the Webhook Simulator route:
   * `POST /workspaces/{workspaceId}/simulate-webhook`
4. **Enforce KYC Tier Upgrades**: Upgrade a wallet's limits using `PATCH /wallets/{walletId}/kyc`. Pass a valid 11-digit BVN or NIN to upgrade to Tier 2/3 and test transfer limits.
