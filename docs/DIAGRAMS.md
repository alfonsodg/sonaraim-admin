# System Diagrams (`sonaraim-admin`)

> Mermaid sequence, state, and interaction diagrams for `sonaraim-admin`.

---

## 1. Operator Zero-Trust Login & Session Validation Flow

```mermaid
sequenceDiagram
    autonumber
    participant Op as Node Operator
    participant Admin as sonaraim-admin Server
    participant Auth as AuthGate (authGate.mjs)

    Op->>Admin: GET /operator (Unauthenticated)
    Admin->>Auth: isOperatorAuthorized(req)
    Auth-->>Admin: false (missing cookie/Bearer)
    Admin-->>Op: 401 Unauthorized -> Redirect to /login
    Op->>Admin: GET /login
    Admin-->>Op: 200 OK (Accessible Login View)
    Op->>Admin: POST /login (operatorToken)
    Admin->>Auth: safeEqualString(token, requiredToken)
    Auth->>Auth: createOperatorSessionToken(token)
    Auth-->>Admin: sessionToken (HMAC-SHA256)
    Admin-->>Op: 200 OK with Set-Cookie: sonaraim_operator_session=...
    Op->>Admin: GET /operator (Cookie attached)
    Admin->>Auth: isOperatorAuthorized(req)
    Auth-->>Admin: true
    Admin-->>Op: 200 OK (Rendered Operator Console)
```

---

## 2. Card Studio Live Card Build & Dispatch Flow

```mermaid
sequenceDiagram
    autonumber
    participant Merchant as B2B Tenant Merchant
    participant Studio as Visual Card Studio
    participant Builder as cardStudio.mjs
    participant B2B as sonaraim-b2b Gateway

    Merchant->>Studio: POST /studio/cards (tenantDid, cardTitle, recipientDid)
    Studio->>Builder: buildSonaraimCard(params)
    Builder->>Builder: Validate schema & sanitize components (no HTML/eval)
    Builder->>Builder: createCardSigningManifest(card)
    Builder-->>Studio: Valid card + JCS SHA-256 digest
    alt recipientDid provided
        Studio->>B2B: POST /v1/messages (apiKey, recipientDid, card)
        B2B-->>Studio: 200 OK (dispatched, message_id)
    end
    Studio-->>Merchant: 200 OK (Rendered preview + dispatch status)
```

---

## 3. Upstream Telemetry Aggregation & Health Evaluation

```mermaid
sequenceDiagram
    autonumber
    participant Prom as Prometheus / Operator
    participant Admin as sonaraim-admin
    participant Client as apiClient.mjs
    participant Node as sonaraim-node
    participant B2B as sonaraim-b2b

    Prom->>Admin: GET /api/live-telemetry
    Admin->>Client: fetchUpstreamTelemetry(config)
    par Probe Relay Node
        Client->>Node: GET /health (timeout 500ms)
        Node-->>Client: 200 OK (node_id, queued_envelopes, kt_tree_head)
    and Probe B2B Gateway
        Client->>B2B: GET /health (timeout 500ms)
        B2B-->>Client: 200 OK (service, registered_tenants)
    end
    Client-->>Admin: Aggregated telemetry state
    Admin->>Admin: Update Prometheus counters
    Admin-->>Prom: 200 OK (telemetry payload)
```

---

## 4. Dynamic Peer Registration & Tenant Provisioning Flow

```mermaid
sequenceDiagram
    autonumber
    participant Op as Super Admin Operator
    participant Admin as sonaraim-admin
    participant Client as apiClient.mjs
    participant Node as sonaraim-node
    participant B2B as sonaraim-b2b

    alt Peer Registration
        Op->>Admin: POST /operator/peers (peerId, rpcUrl, multiaddr)
        Admin->>Client: registerNodePeer(config, peerData)
        Client->>Node: POST /v1/p2p/peers (Bearer Auth)
        Node-->>Client: 200 OK
        Admin-->>Op: 200 OK (Registered peer)
    else Tenant Provisioning
        Op->>Admin: POST /operator/tenants (tenantDid, apiKey, tier, seats)
        Admin->>Client: provisionB2bTenant(config, tenantData)
        Client->>B2B: POST /v1/tenants (Admin Auth)
        B2B-->>Client: 201 Created
        Admin-->>Op: 200 OK (Provisioned tenant)
    end
```
