# System Diagrams (`sonaraim-admin`)

> Mermaid architecture, sequence, and state diagrams for the Sonaraim Dual-Console Web Application.

## 1. Dual-Console Component Architecture

```mermaid
flowchart TD
    Env["Environment Variables (.env)"] --> Config["src/config.mjs (loadAdminConfig)"]
    Config --> CardStudio["src/cardStudio.mjs (B2B Card Studio)"]
    Config --> OperatorConsole["src/operatorConsole.mjs (Node Operator Console)"]

    CardStudio --> BuildCard["buildSonaraimCard()"]
    CardStudio --> ValidateCard["validateSonaraimCard()"]
    CardStudio --> SignManifest["createCardSigningManifest()"]

    OperatorConsole --> MeshHealth["evaluateMeshHealth()"]
    OperatorConsole --> MerkleSync["evaluateMerkleEpochSync()"]
    OperatorConsole --> KybCheck["evaluateKybChecklist()"]

    SignManifest --> B2BApi["sonaraim-b2b Gateway API"]
    MeshHealth --> NodeApi["sonaraim-node Telemetry API"]
    MerkleSync --> NodeApi
```

## 2. B2B Declarative Card Authoring & Signing Sequence

```mermaid
sequenceDiagram
    participant Tenant as B2B Tenant Admin
    participant Studio as Card Studio (cardStudio.mjs)
    participant Signer as Tenant Ed25519 Hardware/Key Vault
    participant B2B as sonaraim-b2b API

    Tenant->>Studio: buildSonaraimCard(params)
    Studio-->>Tenant: Frozen sonaraim.card.v1 payload
    Tenant->>Studio: validateSonaraimCard(card)
    Studio-->>Tenant: { valid: true, errors: [] }
    Tenant->>Studio: createCardSigningManifest(card, issuedAtIso)
    Studio-->>Tenant: { payloadDigestHex, algorithm: "Ed25519-BLAKE3" }
    Tenant->>Signer: Sign payloadDigestHex with did:web private key
    Signer-->>Tenant: Detached Ed25519 signature
    Tenant->>B2B: Publish signed Sonaraim Card template
```

## 3. Node Operator P2P Mesh & Merkle Health State Machine

```mermaid
stateDiagram-v2
    [*] --> Healthy: All nodes connected & within latency/loss/epoch thresholds
    Healthy --> Degraded: Node latency > maxHealthyLatencyMs or epoch drift > maxAllowedEpochDrift
    Degraded --> Healthy: Relay metrics & Merkle epoch converge
    Healthy --> Critical: Peer disconnected or Merkle split-brain detected
    Degraded --> Critical: Peer disconnected or Merkle split-brain detected
    Critical --> Degraded: Disconnected peer reconnects (catching up epochs)
    Critical --> Healthy: Full mesh connectivity & Merkle root consensus restored
```
