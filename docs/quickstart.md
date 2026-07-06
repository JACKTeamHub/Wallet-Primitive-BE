---
title: Quickstart
description: Learn how to spin up Wallet Primitive locally and test your first API endpoints.
---

## Installation & Setup

Follow these steps to run the NestJS gateway in your local environment.

### 1. Install Dependencies
Clone the repository and install packages using `pnpm`:
```bash
pnpm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure you provide a 32-character string for the `ENCRYPTION_KEY` parameter. This key is used to encrypt Nomba sandbox keys at rest in the database.

### 3. Spin Up Services (PostgreSQL)
Run Docker Compose to spin up a local PostgreSQL instance:
```bash
docker compose up -d
```

### 4. Run Migrations & Seed Data
Initialize your schema tables and populate the default multi-tenant organizations (Chowdeck, Jumia, and GIG Logistics):
```bash
pnpm run db:migrate
pnpm run db:seed
```

### 5. Start Development Server
```bash
pnpm run start:dev
```
The application will boot at `http://localhost:9999`.

---

## Interactive Swagger Playground

Once the server is running, you can explore the complete OpenAPI Swagger document at:
👉 **`http://localhost:9999/api`**

To test secure endpoints:
1. Click **Authorize** (top-right of Swagger).
2. Enter one of the seeded B2B API keys:
   * **Chowdeck API Key**: `wp_live_chowdeck_test_key_123456`
   * **Jumia API Key**: `wp_live_jumia_test_key_123456`
   * **GIG Logistics API Key**: `wp_live_gig_test_key_123456`
