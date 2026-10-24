# Server, database, and dashboard

For the current self-contained v2 deployment, use [the Nexus deployment guide](../../server/DEPLOY-NEXUS.md). `npm start` now supervises the API and required workers, and the configured administrator is bootstrapped automatically. The sections below describe the legacy v1 analytics/training system; optional v2 connected play adds recoverable guest accounts.

## Production configuration

- `NODE_ENV=production`
- `PORT=8787`
- `DATABASE_URL=<Nexus PostgreSQL connection string>`
- `PSS_INSTALL_HASH_SECRET=<long random retained secret>`
- `PSS_MODEL_DIR=<restricted model path>`
- `PSS_PYTHON=<Python executable>`
- `PSS_TRAINING_ENABLED=true` only on a resource-limited worker host
- `PSS_MODEL_SIGNING_PRIVATE_KEY=<Ed25519 private PEM path>` only on the approval host

Use HTTPS at a reverse proxy. Do not expose database credentials, model-signing keys, Android keys, `.env`, dataset exports, or training working directories from the web root. Nexus should inject `DATABASE_URL` into the web server and restricted training worker.

## Administrator bootstrap

```powershell
cd server
$env:PSS_ADMIN_USERNAME='operator'
$env:PSS_ADMIN_PASSWORD='<14+ character secret>'
npm run create-admin
Remove-Item Env:PSS_ADMIN_PASSWORD
npm start
```

Ordinary players never have accounts. Admin passwords use scrypt and unique salt. Sessions are server-side, expiring, HttpOnly/SameSite cookies; production cookies are Secure. Mutating routes require CSRF. Login and ingestion are rate-limited.

## Database and retention

PostgreSQL migrations create the analytics, consented experience, administrator, immutable dataset snapshot, training-run, model registry, and audit tables at server startup. Back up the managed PostgreSQL database and test restoration. The initial recommended raw retention is 180 days, subject to law and the published policy. Automate deletion after the adopted period. Existing aggregates/models are not claimed to be unlearned. Prior SQLite rows are not copied automatically and require a deliberate export/import if they must be retained.

## Dashboard and training safety

The private dashboard reads authenticated API data only. Empty states stay empty. Revenue is blank unless official reporting is integrated. Mobile endpoints cannot launch jobs. The admin API accepts only fixed allow-listed commands. Worker execution is disabled by default and should run under CPU, memory, time, disk, and OS-identity limits.
