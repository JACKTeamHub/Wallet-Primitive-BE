---
title: Quarantine Operations
description: Monitor and resolve misdirected or over-limit payments.
---

When funds arrive via webhooks but cannot be credited due to wallet constraints, the transaction is isolated.

## 1. Quarantine Triggers
A transaction is quarantined if:
1. **Wallet Status**: The target wallet status is `FROZEN`, `CLOSED`, or `SUSPENDED`.
2. **KYC Limits**: The deposit amount exceeds the customer's KYC single transaction limit or pushes the wallet past its daily cumulative balance limit.

Quarantined funds **do not increase** the wallet's balance. Instead, they write to the ledger with `status: QUARANTINED` to keep track of the blocked state.

---

## 2. Resolving Quarantined Funds

Workspace administrators can inspect, approve, or reject quarantined entries:

### A. List Quarantined Entries
Retrieve all quarantined ledger entries in a workspace:
`GET /workspaces/{workspaceId}/quarantine`

### B. Release Funds
Move funds from quarantine to a customer's active wallet:
`POST /workspaces/{workspaceId}/quarantine/{ledgerEntryId}/release`

*Note: The target wallet status must be active for the release to execute.*

### C. Reject Funds
Decline the transaction and mark the ledger entry status as `FAILED`:
`POST /workspaces/{workspaceId}/quarantine/{ledgerEntryId}/reject`
