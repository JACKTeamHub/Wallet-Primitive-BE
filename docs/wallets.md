---
title: Virtual Wallets & KYC
description: Provision persistent virtual bank accounts and upgrade KYC tier limits.
---

Integrating organizations can onboard customers and issue dedicated NUBAN virtual accounts using standard JSON requests.

## 1. Create a Customer
Before opening a wallet, create a Customer record to anchor their financial identity:

### Request (`POST /customers`)
```json
{
  "email": "janedoe@gmail.com",
  "name": "Jane Doe"
}
```

---

## 2. Provision Virtual Wallet
Request a virtual account NUBAN from Nomba. This will map the account name to the customer name (sanitized).

### Request (`POST /wallets`)
```json
{
  "customerId": "8f8b89e9-d971-46bb-88b1-a67b937016cf",
  "bvn": "22222222222"
}
```

### Response (`201 Created`)
```json
{
  "id": "e962b9f3-80c1-4ec9-bf0c-519b780ea693",
  "customerId": "8f8b89e9-d971-46bb-88b1-a67b937016cf",
  "workspaceId": "seed-workspace-chowdeck",
  "accountNumber": "1029384756",
  "bankName": "Nomba Microfinance Bank",
  "status": "ACTIVE",
  "kycTier": "TIER_1",
  "bvn": "22222222222",
  "balance": "0.0000"
}
```

---

## 3. Upgrade Wallet KYC Tier
Upgrade a customer's KYC level to lift spending limits. 

* **Tier 1 Limits**: Max single NGN 50,000 / Max daily NGN 100,000.
* **Tier 2 Limits**: Max single NGN 200,000 / Max daily NGN 500,000 (Requires valid **BVN**).
* **Tier 3 Limits**: Max single NGN 5,000,000 / Max daily NGN 10,000,000 (Requires valid **BVN** + **NIN**).

### Request (`PATCH /wallets/{walletId}/kyc`)
```json
{
  "kycTier": "TIER_2",
  "bvn": "22222222222"
}
```

### Response (`200 OK`)
```json
{
  "id": "e962b9f3-80c1-4ec9-bf0c-519b780ea693",
  "customerId": "8f8b89e9-d971-46bb-88b1-a67b937016cf",
  "kycTier": "TIER_2",
  "bvn": "22222222222",
  "nin": null,
  "status": "ACTIVE",
  "balance": "150000.0000"
}
```
