# Security Policy (`sonaraim-admin`)

## 1. Supported Versions

Security updates and patches are actively provided for the following releases:

| Version | Supported | Security Policy |
| :--- | :--- | :--- |
| `develop` | :white_check_mark: Yes | Bleeding edge; security fixes land here first |
| `0.1.x` | :white_check_mark: Yes | Current minor release series |
| `< 0.1.0` | :x: No | Unsupported pre-release builds |

---

## 2. Reporting a Vulnerability

The Sonaraim engineering team treats security issues with high priority. We request that all security reports be handled through coordinated responsible disclosure.

### Reporting Procedure

- **Email**: Send vulnerability reports directly to [security@sonaraim.org](mailto:security@sonaraim.org).
- **PGP Encryption**: For proof-of-concept exploits, please encrypt your message with the Sonaraim Security PGP Key (`https://sonaraim.org/security.asc`).
- **Required Details**:
  - Clear summary of the vulnerability, affected endpoint, view, or component.
  - Minimal steps to reproduce or exploit proof-of-concept.
  - Assessment of potential impact on operator access, tenant isolation, or card validation.

### Response SLAs

- **Initial Acknowledgment**: Within **24 hours**.
- **Triage & Classification**: Within **48 hours**.
- **Remediation & Patch Target**: Critical severity issues are patched within **7 days**; high severity issues within **14 days**.
- **Coordinated Disclosure**: We request a **90-day embargo** from initial notification before public release.

---

## 3. Threat Model & Administrative Security Scope

`sonaraim-admin` provides administrative access to network telemetry and enterprise card authoring under a zero-trust model.

### 3.1 Operator Authentication & Session Gates

- **Constant-Time Verification**: Operator tokens and session digests are compared using `crypto.timingSafeEqual()` to prevent timing side-channel attacks.
- **HMAC Session Tokens**: Active sessions generate HMAC-SHA256 digests bound to the configured `ADMIN_OPERATOR_TOKEN` and a fixed server context.
- **Cookie Hardening**: Session cookies (`sonaraim_operator_session`) are set with `HttpOnly`, `SameSite=Lax`, and `Path=/`.

### 3.2 Visual Card Studio & Injection Prevention

- **Strict Component Whitelist**: Card Studio constructs only allowed declarative components (`TextBlock`, `MediaImage`, `KeyValueRow`, `ActionButton`).
- **Zero Remote Code Execution**: Raw HTML (`<script>`, `<iframe>`) and executable logic are rejected at both schema and structural validation levels.
- **HTML Sanitization**: All user-provided inputs rendered in HTML views are escaped using `escapeHtml()` to eliminate Cross-Site Scripting (XSS).

### 3.3 Upstream Telemetry Probing

- **Timeout Protection**: All probes to `sonaraim-node` and `sonaraim-b2b` enforce strict HTTP fetch timeouts (default 500ms) with `AbortSignal.timeout()` to prevent upstream stalling.
- **Credential Masking**: Sensitive tokens are never echoed in HTML views or logged to standard output.

---

## 4. Out-of-Scope Vulnerabilities

- Self-inflicted XSS resulting from running developer tools or browser extensions in the operator's own browser.
- Network interception of plaintext HTTP traffic in local testing environments without reverse proxy TLS.
- Denial of service attacks against ephemeral local test servers.
