# Configuration Guide (`sonaraim-admin`)

> Zero-hardcode runtime configuration reference for `sonaraim-admin`.

## 1. Zero-Hardcode Policy

`sonaraim-admin` strictly enforces a zero-hardcode policy via `loadAdminConfig()` in `src/config.mjs`. No default hostnames, URLs, IP addresses, or fallback port numbers exist in the codebase. If any required variable is omitted or malformed, startup fails immediately with an informative error.

---

## 2. Environment Variables

| Variable | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_B2B_API_BASE_URL` | URL (`http:`/`https:`) | Yes | Upstream base URL for the `sonaraim-b2b` enterprise gateway API (or `B2B_API_BASE_URL`). | `http://127.0.0.1:8042` |
| `VITE_NODE_API_BASE_URL` | URL (`http:`/`https:`) | Yes | Upstream base URL for the `sonaraim-node` relay node API (or `NODE_API_BASE_URL`). | `http://127.0.0.1:8040` |
| `ADMIN_HTTP_PORT` | Integer (`1..65535`) | Yes | TCP port where the `sonaraim-admin` HTTP server binds. | `8044` |
| `ADMIN_HTTP_HOST` | Host string | No | Bind host address (default `127.0.0.1` or `0.0.0.0`). | `0.0.0.0` |
| `ADMIN_OPERATOR_TOKEN` | Secret string | No | Secret token protecting the Operator Console and Card Studio. Enforces Bearer or session cookie auth. | `sec_operator_token_99` |
| `B2B_BOOTSTRAP_API_KEY` | Secret string | No | Pre-shared API key for dispatching cards from the Visual Card Studio to `sonaraim-b2b`. | `sec_bootstrap_key_1234` |
| `B2B_ADMIN_API_KEY` | Secret string | No | Pre-shared administrative key for provisioning new B2B tenants via `/operator/tenants`. | `master-admin-key-secret` |

---

## 3. Sample Configuration

Copy `samples/.env.example` to `.env` for local development or inject variables via container environment settings:

```dotenv
VITE_B2B_API_BASE_URL=http://127.0.0.1:8042
VITE_NODE_API_BASE_URL=http://127.0.0.1:8040
ADMIN_HTTP_PORT=8044
ADMIN_HTTP_HOST=0.0.0.0
ADMIN_OPERATOR_TOKEN=test-operator-token
B2B_BOOTSTRAP_API_KEY=sec_bootstrap_key_1234
B2B_ADMIN_API_KEY=master-admin-key-secret
```

---

## 4. Operator Evaluation Thresholds

Health evaluation functions in `src/operatorConsole.mjs` require explicit threshold parameters at runtime to prevent embedded magic numbers:

- `evaluateMeshHealth(peers, { maxHealthyLatencyMs, maxHealthyPacketLossPct })`
  - `maxHealthyLatencyMs`: Upper latency bound in milliseconds before a peer is flagged as degraded (e.g., `150`).
  - `maxHealthyPacketLossPct`: Maximum acceptable packet loss percentage (e.g., `5.0`).
- `evaluateMerkleEpochSync(nodeStates, { maxAllowedEpochDrift })`
  - `maxAllowedEpochDrift`: Maximum allowed divergence between node Merkle tree epochs before raising an out-of-sync alert (e.g., `2`).
