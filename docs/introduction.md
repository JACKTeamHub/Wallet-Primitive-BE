---
title: Introduction
description: Welcome to Wallet Primitive — a secure, multi-tenant B2B payment gateway and double-entry ledger routing engine.
---

**Wallet Primitive** is a developer-first financial infrastructure layer built on top of **Nomba's Sandbox APIs**. It enables businesses to deploy isolated, persistent virtual bank accounts, enforce strict KYC guidelines, track ledger balances using transaction-safe double-entry accounting, and handle complex payment states like quarantining and manual overrides.

## Key Primitives

<CardGroup cols={2}>
  <Card title="Multi-Tenant Workspaces" icon="building">
    Encrypt sandbox API keys at rest using AES-256-GCM and isolate client wallets.
  </Card>
  <Card title="KYC Limits & Verification" icon="shield-halved">
    Auto-enforce transaction limits (Tier 1/2/3) mapped to BVN and NIN checks.
  </Card>
  <Card title="Double-Entry Ledger" icon="calculator">
    Execute atomic internal transfers with row-level locked transaction security.
  </Card>
  <Card title="Quarantine System" icon="shield-alert">
    Hold and review misdirected payments, frozen wallets, or over-limit transfers.
  </Card>
</CardGroup>

## Getting Started
To integrate Wallet Primitive into your backend stack, start by reviewing our [Quickstart Guide](/quickstart) or checking the [Architecture Flow](/architecture).
