# Architecture Specification (`sonaraim-admin`)

> System design, module boundaries, and ASCII data flows for the Sonaraim Dual-Console Web Application.

## 1. Architectural Overview

`sonaraim-admin` serves two distinct operational personas through isolated logical modules backed by a zero-hardcode configuration layer:

1. **Node Operator & Super Admin Console (`src/operatorConsole.mjs`)**: Monitors the health of the federated `libp2p` / QUIC relay mesh, verifies that global nodes maintain synchronized Merkle tree epochs without split-brain divergence, and audits B2B organization `did:web` KYB verification checklists.
2. **B2B Tenant Console & Visual Card Studio (`src/cardStudio.mjs`)**: Enables verified commercial tenants to compose declarative `Sonaraim Cards`, validate them against strict schema rules that forbid remote code execution, and produce canonical cryptographic signing manifests.

## 2. System Component Topology (ASCII)

```text
+-------------------------------------------------------------------------+
|                         sonaraim-adminRuntime                           |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                     src/config.mjs (Zero-Hardcode)                |  |
|  |   VITE_B2B_API_BASE_URL | VITE_NODE_API_BASE_URL | ADMIN_HTTP_PORT|  |
|  +-------------------+-------------------------------+---------------+  |
|                      |                               |                  |
|                      v                               v                  |
|  +-----------------------------------+   +---------------------------+  |
|  |       src/cardStudio.mjs          |   |  src/operatorConsole.mjs  |  |
|  |  - buildSonaraimCard()            |   |  - evaluateMeshHealth()   |  |
|  |  - validateSonaraimCard()         |   |  - evaluateMerkleEpochSync|  |
|  |  - createCardSigningManifest()    |   |  - evaluateKybChecklist() |  |
|  +-----------------+-----------------+   +-------------+-------------+  |
+--------------------|-----------------------------------|----------------+
                     |                                   |
                     v                                   v
      +------------------------------+    +------------------------------+
      |   sonaraim-b2b API Gateway   |    |  sonaraim-node Admin API     |
      | (Template Registry & Webhooks|    | (Mesh Telemetry & Merkle Log)|
      +------------------------------+    +------------------------------+
```

## 3. Declarative Card Studio Pipeline (ASCII)

```text
[B2B Tenant Author]
        |
        | 1. Define metadata, components[], actions[]
        v
[buildSonaraimCard()] ---> Produces immutable sonaraim.card.v1 object
        |
        | 2. Enforce whitelist & did:web syntax
        v
[validateSonaraimCard()] --(Invalid)--> Returns { valid: false, errors[] }
        |
     (Valid)
        | 3. Canonicalize JSON + SHA-256 digest
        v
[createCardSigningManifest()] ---> Returns Ed25519-BLAKE3 Signing Manifest
```

## 4. Federated Merkle Epoch & KYB Evaluation Flow (ASCII)

```text
[Federated Node Snapshots]                  [B2B did:web KYB Submission]
           |                                             |
           v                                             v
[evaluateMerkleEpochSync()]                 [evaluateKybChecklist()]
  - Compute highestEpoch                      - Check did:web prefix
  - Detect root mismatch at same epoch        - Check HTTPS /.well-known/did.json
  - Flag nodes lagging > maxAllowedDrift      - Check TLS cert + DNS TXT + Ed25519
           |                                             |
           v                                             v
  { inSync, splitBrainDetected,               { verified: true/false,
    driftedNodes[] }                            failedChecks[] }
```

## 5. Module Responsibilities

- **`src/config.mjs`**: Validates environment variables at startup. Rejects missing values, non-HTTP(S) URLs, and out-of-range TCP ports.
- **`src/cardStudio.mjs`**: Enforces the `sonaraim.card.v1` schema so mobile and desktop clients only render native components from verified `did:web` senders.
- **`src/operatorConsole.mjs`**: Computes deterministic health verdicts for P2P relays, Merkle state roots, and enterprise KYB onboarding.
- **`src/index.mjs`**: Clean barrel module exposing the public API surface.
