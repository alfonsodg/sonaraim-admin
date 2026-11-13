# System Architecture (`sonaraim-admin`)

> Dual-Console Administrative Interface for Federated Node Operators and Verified B2B Enterprise Tenants.

## 1. Overview

`sonaraim-admin` provides administrative oversight, operational telemetry evaluation, and declarative UI authoring tools for the Sonaraim sovereign communication ecosystem. It cleanly separates infrastructure operations (Node Operator Console) from commercial tenant orchestration (Visual Card Studio) while preserving strict zero-knowledge and zero-remote-code-execution guarantees.

---

## 2. High-Level System Topology (ASCII)

```text
+-----------------------------------------------------------------------------------+
|                                  sonaraim-admin                                   |
|                                                                                   |
|  +-------------------------------------+   +-----------------------------------+  |
|  |     Super Admin & Node Operator     |   |      B2B Tenant & Card Studio     |  |
|  |  - P2P Mesh Telemetry Probing       |   |  - Declarative Card Builder       |  |
|  |  - Merkle Epoch Sync Drift Check    |   |  - JCS SHA-256 Digest Generator   |  |
|  |  - Automated KYB (did:web) Audit    |   |  - Live Dispatch to sonaraim-b2b  |  |
|  |  - Peer Node & Tenant Provisioning  |   |  - Flat-Rate Seat Quota Ledger    |  |
|  +------------------+------------------+   +-----------------+-----------------+  |
|                     |                                        |                    |
|                     +--------------------+-------------------+                    |
|                                          |                                        |
|                       +------------------v------------------+                     |
|                       |  Zero-Trust Auth Gate (authGate.mjs)|                     |
|                       |  - HMAC-SHA256 Session Cookie       |                     |
|                       |  - Timing-Safe Bearer Token Compare |                     |
|                       +------------------+------------------+                     |
|                                          |                                        |
|                       +------------------v------------------+                     |
|                       | Upstream API Client (apiClient.mjs) |                     |
|                       +---------+-----------------+---------+                     |
+---------------------------------|-----------------|-------------------------------+
                                  |                 |
                   Timeout Probes |                 | Live Card Dispatch
                                  v                 v
                 +-------------------+   +--------------------+
                 |   sonaraim-node   |   |    sonaraim-b2b    |
                 | (Relay Telemetry) |   | (Enterprise Bridge)|
                 +-------------------+   +--------------------+
```

---

## 3. Subsystem Responsibilities

### 3.1 Zero-Trust Operator Authentication Gate (`src/authGate.mjs`)

Provides multi-factor session authentication for administrative routes:

- **Timing-Safe Token Comparison**: Uses `crypto.timingSafeEqual()` to evaluate operator tokens and session cookies without exposing timing side channels.
- **HMAC Session Tokens**: Issues cryptographically signed HMAC-SHA256 session tokens bound to a fixed server context (`sonaraim-operator-session-v1`).
- **Cookie Security**: Emits `sonaraim_operator_session` cookies with `HttpOnly`, `SameSite=Lax`, and `Path=/`.
- **Passkey/Session Views**: Renders accessible login views (`renderLoginView`) with clear error messaging and screen-reader status banners.

### 3.2 Visual Card Studio (`src/cardStudio.mjs`, `src/ui/studioView.mjs`)

Enables enterprise merchants and developers to construct, validate, and test rich interactive cards:

- **Declarative Primitives**: Assembles cards strictly from approved component types (`TextBlock`, `MediaImage`, `KeyValueRow`, `ActionButton`).
- **Zero-HTML Policy**: Statically forbids raw HTML (`<script>`, `<iframe>`) and executable logic, eliminating WebView injection vectors.
- **JCS Manifest Creation**: Computes deterministic JSON Canonicalization Scheme (RFC 8785) digests for signing by enterprise DID private keys.
- **Live Dispatch**: Dispatches the constructed card directly to `sonaraim-b2b` via `POST /v1/messages` when a recipient DID is provided.

### 3.3 Node Operator Console (`src/operatorConsole.mjs`, `src/ui/operatorView.mjs`)

Evaluates health and compliance across federated nodes:

- **Mesh Health Evaluation**: Analyzes peer latency, packet loss percentage, and stream counts against operator-configured thresholds, flagging degraded or disconnected nodes.
- **Merkle Epoch Sync**: Probes connected relay nodes to detect epoch divergence and split-brain equivocation.
- **Automated KYB Checklist**: Evaluates business `did:web:` identities against HTTPS DID document availability, TLS certificate chain validity, Ed25519 public key presence, and DNS TXT verification challenges.

### 3.4 Upstream API Client & Telemetry Probing (`src/apiClient.mjs`)

- **Timeout Boundaries**: Wraps all HTTP requests in `AbortSignal.timeout(timeoutMs)` to prevent hanging when upstream nodes are unreachable.
- **Telemetry Aggregation**: Probes `/health` on both `sonaraim-node` and `sonaraim-b2b` simultaneously, updating Prometheus metrics.

### 3.5 Flat-Rate Seat Governance (`src/tenantBilling.mjs`)

- **Zero-Markup Enforcement**: Enforces the architectural principle of zero per-message fees.
- **Seat Quotas**: Manages maximum active seat allocations across SMB, PRO, and ENTERPRISE tiers.
