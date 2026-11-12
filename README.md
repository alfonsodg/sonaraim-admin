# Sonaraim Admin (`sonaraim-admin`)

> Dual-Console Administrative Interface for Federated Node Operators and Verified B2B Enterprise Tenants.

`sonaraim-admin` provides the control plane, telemetry evaluators, and declarative UI authoring tools for the Sonaraim sovereign communication ecosystem. It separates infrastructure governance (Node Operator & Super Admin Console) from commercial message orchestration (B2B Tenant Console & Visual Card Studio) while preserving strict zero-knowledge and zero-remote-code-execution guarantees.

## Key Capabilities

1. **B2B Tenant Console & Visual Card Studio (`src/cardStudio.mjs`)**
   - Declarative builder and schema validator for `Sonaraim Cards` (`sonaraim.card.v1`).
   - Strict rejection of unsafe or executable components (`iframe`, remote scripts, arbitrary evaluation).
   - Canonical SHA-256 / `Ed25519-BLAKE3` signing manifest generation bound to verified `did:web` identities.
2. **Super Admin & Node Operator Console (`src/operatorConsole.mjs`)**
   - Real-time P2P relay mesh telemetry evaluation (latency, packet loss, active streams, degraded/disconnected node detection).
   - Federated Merkle epoch synchronization validator with drift and split-brain detection across global nodes.
   - Automated KYB (`did:web`) verification checklist evaluator (HTTPS DID document reachability, TLS chain validation, Ed25519 key presence, DNS TXT challenge).
3. **Zero-Hardcode Configuration (`src/config.mjs`)**
   - Environment-only configuration loading (`VITE_B2B_API_BASE_URL`, `VITE_NODE_API_BASE_URL`, `ADMIN_HTTP_PORT`) with strict URL and TCP port validation.

## Repository Structure

```text
sonaraim-admin/
├── docs/
│   ├── ARCHITECTURE.md    # Dual-console system design & ASCII diagrams
│   ├── CONFIGURATION.md   # Environment variable reference & validation rules
│   ├── DIAGRAMS.md        # Mermaid sequence, state, and architecture diagrams
│   └── STANDARDS.md       # Coding, security, testing, and linting standards
├── samples/
│   └── .env.example       # Sample environment configuration template
├── src/
│   ├── config.mjs         # Zero-hardcode environment variable loader
│   ├── cardStudio.mjs     # Declarative Sonaraim Card builder & validator
│   ├── operatorConsole.mjs# Mesh health, Merkle sync & KYB checklist logic
│   └── index.mjs          # Public ESM package exports
├── tests/
│   └── admin.test.mjs     # Node.js native test runner suite
├── Dockerfile             # Multi-stage container build & minimal runtime
└── package.json           # ESM module manifest
```

## Quick Start

### Prerequisites

- Node.js (latest LTS/stable, `>=22.0.0`)
- Environment variables configured (see `samples/.env.example` and [docs/CONFIGURATION.md](docs/CONFIGURATION.md))

### Running Tests

```bash
npm test
```

### Usage Example

```javascript
import {
  loadAdminConfig,
  buildSonaraimCard,
  validateSonaraimCard,
  createCardSigningManifest,
} from '@sonaraim/admin';

const config = loadAdminConfig(process.env);

const card = buildSonaraimCard({
  cardId: 'card_invoice_approval_01',
  version: '1.0.0',
  tenantDid: 'did:web:billing.acme.example.com',
  title: 'Approve Invoice #9042',
  components: [
    { id: 'hdr', type: 'header', text: 'Invoice #9042 Ready for Approval' },
  ],
  actions: [
    { id: 'act_ok', type: 'approve_payment', label: 'Approve Payment' },
  ],
});

const validation = validateSonaraimCard(card);
if (validation.valid) {
  const manifest = createCardSigningManifest(card, new Date().toISOString());
  console.log('Ready to sign digest:', manifest.payloadDigestHex, 'via', config.b2bApiBaseUrl);
}
```

## Documentation Catalog

- [Architecture Specification](docs/ARCHITECTURE.md)
- [System Diagrams (Mermaid)](docs/DIAGRAMS.md)
- [Configuration Guide](docs/CONFIGURATION.md)
- [Engineering Standards](docs/STANDARDS.md)

## License

Apache-2.0
