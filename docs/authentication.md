---
title: Authentication
description: Secure your downstream API requests to the Wallet Primitive gateway.
---

Wallet Primitive uses API keys for downstream authorization. Integrators must attach their API key to the header of all B2B requests.

## Request Headers

Every request to a wallet, customer, or reconciliation route requires the following header:

| Header | Description | Example |
| :--- | :--- | :--- |
| `x-api-key` | Your workspace API key | `wp_live_chowdeck_test_key_123456` |

---

## Code Examples

### 1. Curl

```bash
curl -X GET "http://localhost:9999/wallets" \
  -H "x-api-key: wp_live_chowdeck_test_key_123456" \
  -H "Content-Type: application/json"
```

### 2. Node.js (Axios)

```javascript
const axios = require('axios');

async function getWallets() {
  try {
    const response = await axios.get('http://localhost:9999/wallets', {
      headers: {
        'x-api-key': 'wp_live_chowdeck_test_key_123456',
        'Content-Type': 'application/json'
      }
    });
    console.log(response.data);
  } catch (error) {
    console.error('Request failed:', error.response.data);
  }
}
```

### 3. Python (Requests)

```python
import requests

url = "http://localhost:9999/wallets"
headers = {
    "x-api-key": "wp_live_chowdeck_test_key_123456",
    "Content-Type": "application/json"
}

response = requests.get(url, headers=headers)
print(response.json())
```
