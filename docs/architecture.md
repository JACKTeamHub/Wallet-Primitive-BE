---
title: System Architecture
description: Learn how the gateway, the PostgreSQL database, and Nomba's Sandbox APIs communicate.
---

Wallet Primitive utilizes an event-driven, transaction-locked design that links inbound payment notifications directly to a double-entry ledger.

## Interaction Flow Diagram

Below is the master component relationship flow:

```mermaid
graph TB
    subgraph Clients ["Integrators & External Servers"]
        DevServer["Developer Server"]
        EndUser["End-User Client"]
    end

    subgraph GW ["Wallet-Primitive Gateway (NestJS Backend)"]
        AuthGuard["API Key Guard (SHA-256 Hashing)"]
        
        subgraph Core ["Core Modules (Use Cases)"]
            WS["Workspaces & Keys"]
            Wallets["Wallets Module"]
            Transfers["Ledger Transfer Engine"]
            Checkouts["Temporary Checkouts"]
        end

        subgraph Security ["Security Services"]
            Enc["AES-256-GCM Encryption"]
            WebhookSec["HMAC-SHA256 Sig Check & Replay Guard"]
        end

        subgraph Ledger ["Ledger Engine"]
            RowLocking["Row-Level Locked DB Transaction"]
            DoubleEntry["Double-Entry Ledger Log Writer"]
        end
    end

    subgraph DB ["Database (PostgreSQL)"]
        TableWorkspaces["Workspaces & Credentials"]
        TableWallets["Customers & Wallets"]
        TableLedgers["Double-Entry Journals"]
        TableAuditLogs["Audit Logs"]
    end

    subgraph Nomba ["Nomba APIs"]
        NombaOAuth["OAuth Token Manager"]
        NombaVA["Virtual Accounts Endpoint"]
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

## Architectural Highlights

### 1. Zero-Trust API Key Validation
Every B2B request requires the `x-api-key` header. The gateway extracts the key, hashes it using SHA-256, and queries the database for match verification. Plain API keys are never stored in the database.

### 2. Multi-Tenant Encryption at Rest
Integration keys (client secret, sub-account credentials) provided by developers are encrypted using AES-256-GCM before saving to PostgreSQL. They are decrypted dynamically inside `NombaService` during API calls.

### 3. ACID-Wrapped Ledger
Monetary transfers employ explicit PostgreSQL transaction locks (`$transaction`). If a debit succeeds but a credit fails (or vice versa), the entire transaction rolls back immediately, keeping ledger integrity absolute.
