# Contributing to Sonaraim Admin

Thank you for contributing to `sonaraim-admin`! This repository implements the Dual-Console Administrative Interface for the Sonaraim ecosystem, housing both the Network & Node Operator Console (Super Admin) and the B2B Tenant Console & Visual Card Studio.

To ensure strict zero-trust security, accessibility, and high code quality, all contributors must follow the guidelines outlined below.

---

## 1. Branching & Git Workflow

- **`develop` Branch**: The primary integration branch. All feature and bugfix branches must branch from and merge into `develop`.
- **`main` Branch**: Reserved exclusively for production releases (`vMAJOR.MINOR.PATCH`). Never merge directly to `main`.
- **Branch Naming**:
  - Features: `feature/<feature-name>` (e.g., `feature/card-studio-preview`)
  - Fixes: `fix/<issue-description>` (e.g., `fix/auth-cookie-path`)
- **Pull Requests**: Target `develop`. Every PR must pass all automated test suites and markdown quality gates before review.

---

## 2. Test-Driven Development (TDD) Mandatory

All code in `sonaraim-admin` must be developed using strict Test-Driven Development:

1. **Red**: Write a failing test in `tests/admin.test.mjs` reproducing the issue or defining new route/UI behavior before writing implementation code.
2. **Green**: Write the minimal code required to pass the test assertions.
3. **Refactor**: Clean up and optimize the implementation while keeping all tests passing.
4. **Coverage**: Every route, session gate, schema validation, and upstream API probe must have automated test coverage using Node.js native test runner (`node:test`).

---

## 3. Code Standards & Modularity

- **File Length Limit**: Every source file must remain under 300 lines. Split UI rendering, routing, API client, and authentication logic into dedicated modules.
- **Mandatory Documentation**: Every exported function, class, and constant must include JSDoc comments (`/** ... */`) describing parameters, return types, and potential exceptions. Complex logic blocks must have inline comments explaining *why*.
- **Zero-Hardcode Policy**: Never embed fixed URLs, IP addresses, ports, or credentials in source code. All configuration must load via `loadAdminConfig()` in `src/config.mjs` (`VITE_B2B_API_BASE_URL`, `VITE_NODE_API_BASE_URL`, `ADMIN_HTTP_PORT`, `ADMIN_OPERATOR_TOKEN`).
- **ESM Standard**: Code must use native ECMAScript Modules (`.mjs` or `"type": "module"` in `package.json`). Package manager must strictly be `npm`.

---

## 4. Conventional Commits

All commit messages must follow the Conventional Commits format and reference an issue number:

```text
<type>(<scope>): <subject> (Ref #N)
```

- **Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`.
- **Scopes**: `studio`, `operator`, `auth`, `telemetry`, `config`, `billing`.
- **Issue Reference**: Always reference the tracked issue using `Ref #N`.

Example:

```text
feat(studio): add live card dispatch to B2B gateway endpoint (Ref #9)
```

---

## 5. Tooling, Verification & Quality Gates

Run and verify the following commands locally before committing:

```bash
# 1. Complete test suite execution
npm test

# 2. Markdown quality and linting verification
npx --yes markdownlint-cli2 "*.md" "docs/*.md"
```

Both commands must pass with zero errors.

---

## 6. Documentation & Architecture Standards

- **Language**: English only for code, comments, documentation, and commit messages.
- **Mermaid Diagrams**: Mermaid diagrams belong **exclusively** inside `docs/DIAGRAMS.md`. Never place ```` ```mermaid ```` code blocks in `README.md` or `ARCHITECTURE.md` (use text or ASCII art instead).
- **Markdown Quality**: All markdown documents must pass `markdownlint` without errors.
