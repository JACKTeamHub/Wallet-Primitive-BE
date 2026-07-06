---
title: Inbound Webhooks
description: Handle real-time virtual account credit notifications securely.
---

Nomba dispatchers push webhook events when funds hit customer accounts. Wallet Primitive cryptographically signs and verifies these payloads.

## 1. Webhook Signature Verification

Every payload contains two headers:
* `nomba-signature`: Base64 HMAC-SHA256 hash.
* `nomba-timestamp`: Request dispatch time.

The backend validates signatures by computing the SHA-256 HMAC hash of the string below:
```
[event_type]:[requestId]:[userId]:[walletId]:[transactionId]:[type]:[time]:[responseCode]:[timestamp]
```
If the generated signature matches the header, the payment is processed.

---

## 2. Webhook Simulator
Use the simulator endpoint in your development workflow to bypass setting up external tunnels.

### Request (`POST /workspaces/{workspaceId}/simulate-webhook`)
```json
{
  "aliasAccountNumber": "1029384756",
  "amount": 15000,
  "transactionId": "tx_sim_992120",
  "narration": "Simulated balance deposit"
}
```

### Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Webhook processed and verified",
  "timestamp": "2026-07-06T07:25:30.000Z"
}
```
