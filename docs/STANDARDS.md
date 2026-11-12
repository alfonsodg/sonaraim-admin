# Engineering Standards (`sonaraim-admin`)

> Development, security, testing, and documentation standards enforced in `sonaraim-admin`.

## 1. Architectural & Security Mandates

- **Zero Hardcoded Configuration**: All URLs, ports, thresholds, and environment-specific values must be injected via environment variables (`src/config.mjs`) or explicit caller parameters. No default URLs or fallback ports are permitted in source code.
- **Zero Remote Code Execution in Cards**: `Sonaraim Cards` authored in the B2B Card Studio (`src/cardStudio.mjs`) are strictly declarative JSON schemas (`sonaraim.card.v1`). Only whitelisted native UI primitives (`header`, `text`, `input`, `select`, `date_picker`, `key_value_list`) and deterministic actions (`submit_intent`, `approve_payment`, `dismiss`) pass validation.
- **Cryptographic Non-Repudiation**: Every published B2B Card template generates a canonical signing manifest (`Ed25519-BLAKE3`) bound to a verified `did:web` corporate identity.

## 2. Code Quality & Modularity

- **Module System**: Native Node.js ECMAScript Modules (`"type": "module"`, `.mjs`).
- **File Size Limit**: Every source and test file must remain under 300 lines with a single, well-defined responsibility.
- **Mandatory JSDoc Comments**: Every exported function, internal helper, and module header must include complete JSDoc annotations (`@fileoverview`, `@param`, `@returns`, `@throws`).
- **Immutability**: Configuration objects, built cards, and diagnostic reports returned by domain functions are frozen via `Object.freeze()`.

## 3. Test-Driven Development (TDD)

- **Workflow**: Red -> Green -> Refactor using the built-in `node:test` and `node:assert/strict` runners.
- **Coverage Scope**:
  - Environment configuration validation and error throwing on missing/malformed inputs.
  - Declarative Card Studio building, schema validation, and malicious component rejection.
  - Operator Console P2P mesh telemetry scoring, Merkle epoch drift detection, and `did:web` KYB verification.

## 4. Git & Issue Lifecycle

- **Branching Model**: `feature/*` and `fix/*` branch from `develop`; `develop` integrates changes before release merges to `main`.
- **Conventional Commits**: `<type>(<scope>): <subject> (#issue)` with `Ref #issue` in the commit footer.
- **Documentation Quality**: All Markdown files must pass `markdownlint` with zero errors before commit, and Mermaid diagrams reside exclusively in `docs/DIAGRAMS.md`.
