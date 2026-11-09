# SolanaPilot Explorer Rollback Runbook

This document defines the deployment monitoring policy, automated rollback criteria, and step-by-step incident response procedures for SolanaPilot Web Explorer.

---

## 1. Numeric Rollback Triggers

An immediate, unconditional rollback to the previous stable release must be initiated if **any** of the following quantitative conditions are met:

| Metric | Trigger Threshold | Time Window / Evaluation | Action |
|---|---|---|---|
| **5xx Error Rate** | **> 2.0%** of total requests | 5-minute rolling window | Immediate rollback |
| **Readiness Check** | `/api/ready` returns HTTP 503 or times out | **> 3 consecutive probes** (30 seconds) | Immediate rollback |
| **Health Check** | `/api/health` returns non-200 or times out | **> 2 consecutive probes** (20 seconds) | Immediate rollback |
| **API Latency (p95)** | **> 1,500 ms** on `/api/programs` or `/api/ready` | 5-minute sustained window | Initiate investigation; rollback if sustained > 10 min |
| **Auth / SIWS Failure** | **> 10.0%** verification failures on `/api/auth` or `/api/account/link` | 5-minute window | Immediate rollback |
| **Smoke Suite Failure** | Exit code `!= 0` from `smoke.mjs` | Immediate post-deploy execution | Abort promotion; keep previous deployment active |

---

## 2. Immediate Rollback Procedures

### Platform: Vercel (Production)

1. **Instant Alias Reassignment:**
   Navigate to the Vercel Dashboard -> Deployments, locate the last known healthy deployment hash, click `...` -> **Promote to Production**.
   Or run via CLI:
   ```bash
   vercel rollback <previous-deployment-url>
   ```
2. **Purge Edge Cache:**
   Purge Vercel CDN cache to invalidate any poisoned edge responses:
   ```bash
   vercel purge
   ```

### Platform: Self-Hosted / Docker / Kubernetes

1. **Rollback Deployment:**
   ```bash
   kubectl rollout undo deployment/solanapilot-web
   ```
   Or revert container image tag to previous release tag.
2. **Verify Pod Status:**
   ```bash
   kubectl rollout status deployment/solanapilot-web
   ```

---

## 3. Database Compatibility Guidelines

To ensure safe zero-downtime rollbacks, schema changes follow the **Expand and Contract** pattern:

1. **Additive Only:** New fields must be nullable or have default values. Never drop columns or rename existing active fields in the same release that ships new application code.
2. **Two-Phase Deprecation:**
   - *Phase 1 (Expand):* Add new column/table, deploy code supporting both old and new.
   - *Phase 2 (Contract):* Remove old column in a subsequent release after verifying stability.
3. If an application rollback is executed, the previous application version will continue operating normally against the expanded schema without database-level rollback.

---

## 4. Post-Rollback Verification

Immediately following rollback, run the automated smoke test suite against the target URL:

```bash
cd web-explorer
node scripts/smoke.mjs https://your-production-url.com
```

Confirm that:
- `/api/health` returns `200 OK`
- `/api/ready` reports dependencies connected
- Malformed inputs return `400` / `4xx` (never `200`)
- Payloads exceeding 100 KB return `413 Payload Too Large`
- Probe latencies are within acceptable limits (< 200 ms for health, < 500 ms for RPC)

---

## 5. Post-Mortem & Incident Review

1. Freeze production deployments until root cause is identified.
2. Capture logs and telemetry for the incident window.
3. Write a regression test reproducing the failure before re-attempting promotion.

