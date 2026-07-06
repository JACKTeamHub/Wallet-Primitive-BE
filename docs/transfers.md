---
title: Ledger Transfers
description: Transfer funds atomically between customer wallets.
---

Transfer money internally within a workspace. Every transfer is executed within a database transaction block and logs matching credit and debit entries to the immutable ledger.

## 1. Execute Transfer

### Request (`POST /wallets/transfer`)
```json
{
  "senderWalletId": "e962b9f3-80c1-4ec9-bf0c-519b780ea693",
  "recipientWalletId": "341c8f1a-b620-4e1b-8533-875fba18cf23",
  "amount": 25000,
  "description": "Payout for contract delivery"
}
```

### Response (`201 Created`)
```json
{
  "transactionGroupId": "8e3c63e2-8924-4f24-9b2f-370129bc78af",
  "amount": 25000,
  "senderWalletId": "e962b9f3-80c1-4ec9-bf0c-519b780ea693",
  "recipientWalletId": "341c8f1a-b620-4e1b-8533-875fba18cf23",
  "status": "SUCCESS",
  "timestamp": "2026-07-06T07:22:15.000Z"
}
```

---

## 2. Limit Enforcements

If the transfer amount exceeds the sender wallet's single transaction limit or pushes the wallet past its daily cumulative spending limit, the API rejects the request:

### Error Response (`400 Bad Request`)
```json
{
  "statusCode": 400,
  "message": "Transfer amount exceeds the single transaction limit of NGN 50000.00 for TIER_1",
  "error": "Bad Request"
}
```
