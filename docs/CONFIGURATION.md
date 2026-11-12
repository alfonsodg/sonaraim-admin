# Configuration Guide (`sonaraim-admin`)

> Zero-hardcode runtime configuration reference for `sonaraim-admin`.

## 1. Zero-Hardcode Policy

`sonaraim-admin` enforces a strict zero-hardcode policy via `loadAdminConfig()` in `src/config.mjs`. No default URLs, IP addresses, or fallback port numbers exist in the codebase. If any required variable is omitted or malformed, startup fails immediately with a descriptive error.

## 2. Required Environment Variables

| Variable | Type | Validation Rule | Description |
| :--- | :--- | :--- | :--- |
| `VITE_B2B_API_BASE_URL` | URL (`http:` or `https:`) | Must parse via `new URL()`, trailing slashes stripped | Upstream base URL for the `sonaraim-b2b` enterprise gateway API |
| `VITE_NODE_API_BASE_URL` | URL (`http:` or `https:`) | Must parse via `new URL()`, trailing slashes stripped | Upstream base URL for the `sonaraim-node` operator telemetry API |
| `ADMIN_HTTP_PORT` | Integer (`1..65535`) | Must be an integer between `1` and `65535` | Local TCP port where the `sonaraim-admin` HTTP server binds |

## 3. Sample Setup

Copy `samples/.env.example` to `.env` for local development or inject variables via CI/CD secrets in staging and production:

```bash
cp samples/.env.example .env
```

Example content (`samples/.env.example`):

```dotenv
VITE_B2B_API_BASE_URL=https://b2b.sonaraim.example.com/api/v1
VITE_NODE_API_BASE_URL=https://node.sonaraim.example.com/api/v1
ADMIN_HTTP_PORT=8080
```

## 4. Operator Threshold Parameters

Health evaluation functions in `src/operatorConsole.mjs` also require explicit threshold objects at call time rather than hardcoded magic numbers:

- `evaluateMeshHealth(peers, { maxHealthyLatencyMs, maxHealthyPacketLossPct })`
- `evaluateMerkleEpochSync(nodeStates, { maxAllowedEpochDrift })`
