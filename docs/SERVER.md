# Server, database, and dashboard

## Production configuration

- `NODE_ENV=production`
- `PORT=8787`
- `PSS_DATABASE_PATH=<durable private path>`
- `PSS_INSTALL_HASH_SECRET=<long random retained secret>`
- `PSS_DATASET_DIR=<restricted worker dataset path>`
- `PSS_MODEL_DIR=<restricted model path>`
- `PSS_PYTHON=<Python executable>`
- `PSS_TRAINING_ENABLED=true` only on a resource-limited worker host
- `PSS_MODEL_SIGNING_PRIVATE_KEY=<Ed25519 private PEM path>` only on the approval host

Use HTTPS at a reverse proxy. Do not expose SQLite, model-signing keys, Android keys, `.env`, datasets, or training working directories from the web root.

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

Node SQLite uses foreign keys, WAL, transactions, and indexes for time/mode/install queries. Back up with a SQLite-aware snapshot and test restoration. The initial recommended raw retention is 180 days, subject to law and the published policy. Automate deletion after the adopted period. Existing aggregates/models are not claimed to be unlearned.

## Dashboard and training safety

The private dashboard reads authenticated API data only. Empty states stay empty. Revenue is blank unless official reporting is integrated. Mobile endpoints cannot launch jobs. The admin API accepts only fixed allow-listed commands. Worker execution is disabled by default and should run under CPU, memory, time, disk, and OS-identity limits.
