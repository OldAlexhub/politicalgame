# Political Strategy Simulator

**Gain Power. Rule Nations. Shape History.**

Political Strategy Simulator is a fictional, nonpartisan Android grand-strategy game by **Old Alex Hub**. It contains four offline-first campaigns, a deterministic political simulation, local saves, explainable fallback opponents, optional collective-learning telemetry, conservative AdMob placement, and a controlled ONNX policy update path.

The game does not claim to predict real elections, is not affiliated with a government or political organization, and does not collect a player's real political beliefs for its learning dataset.

## What is implemented

- Presidential campaign across 50 states and Washington, D.C., using the 538-elector 2020 census apportionment for a fictional 2028 election.
- Fictional Republic, Monarchy, and Political Transition campaigns with distinct institutions, factions, actors, resources, objectives, and endings.
- Versioned, fixed-point TypeScript simulation with seeded randomness, legal actions, immediate/delayed effects, actor memory, procedural event chains, AI turns, campaign results, and replay-compatible state.
- Integrity-checked multiple local save slots using a two-phase commit over the native AsyncStorage key-value database.
- U.S. state boundaries from the public-domain Census-derived `us-atlas` dataset, rendered locally with no paid map service.
- Explicit gameplay analytics/collective-learning opt-in, separate from Google advertising consent.
- AdMob via `react-native-google-mobile-ads`, with Google test IDs in debug builds and the supplied production IDs in release builds.
- Signed policy manifests, SHA-256 model verification, compatibility checks, atomic activation, campaign policy pinning, rollback, ONNX Runtime inference, and a deterministic fallback.
- Express/PostgreSQL backend with secure admin sessions, CSRF protection, validation, deletion, real aggregation, dataset creation, training orchestration, and a private dashboard.
- Python Gymnasium environment, behavior cloning, Conservative Q-Learning (offline RL), self-play league training, evaluation gates, ONNX export, and cross-language golden fixtures.

## Requirements

- Windows 10/11 for `release.py` automation (ordinary development can use another supported React Native host).
- Node.js 22.11 or newer.
- Python 3.11 or newer.
- Android Studio with its bundled JBR, Android SDK Platform 36, build tools, platform-tools, and an emulator/device.

The Android project targets API 36. Google Play requires new phone/tablet apps and updates to target Android 16/API 36 starting August 31, 2026; verify the policy again immediately before submission: [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878).

## Run the Android app

```powershell
cd strategy
npm install
npm test -- --runInBand
npm run lint
npx tsc --noEmit
npm run android
```

Core campaigns do not require the server. To connect optional telemetry/model updates, set `apiBaseUrl` in `src/config/appConfig.ts` to an HTTPS production endpoint. Do not use cleartext HTTP in a release build.

## Run the server

```powershell
cd server
npm install
$env:PSS_INSTALL_HASH_SECRET = '<long-random-secret>'
npm run create-admin
npm start
```

Open `http://localhost:8787/` and sign in with the administrator account. In production, terminate TLS at a hardened reverse proxy, set `NODE_ENV=production`, use a durable `PSS_INSTALL_HASH_SECRET`, and configure backups.

## Train a small baseline

```powershell
cd server
python -m pip install -r ml/requirements.txt
python ml/cli.py baseline --episodes 64 --epochs 8 --seeds 24 --model-dir data/models
```

The command bootstraps deterministic self-play experiences when no consented dataset exists, trains a reward-weighted behavior-cloning policy, evaluates it against scripted and random policies over fixed seeds/modes/difficulties, exports ONNX, validates PyTorch/ONNX numerical parity, and writes an **unapproved candidate** manifest. Training completion never deploys a model.

See [ML methodology](docs/ML.md), [server deployment](docs/SERVER.md), and [Android release](docs/ANDROID_RELEASE.md).

## Tests

```powershell
# Mobile simulation, persistence, ads, and render smoke test
cd strategy
npm test -- --runInBand

# Backend security, ingestion, aggregation, deletion, and datasets
cd ..\server
npm test

# Gym environment, training, offline RL, self-play, and ONNX parity
python -m pytest ml/tests -q

# Windows release automation
cd ..
python -m pytest tests -q
```

## Build release artifacts

```powershell
python release.py --check-env
python release.py --generate-key-only
python release.py --skip-screenshots
```

The script finds Android Studio's JBR and SDK, writes `android/local.properties`, creates/reuses an ignored upload keystore, builds a signed APK and AAB, and packages release materials under `releases/`. The AAB is the Google Play artifact. Back up the keystore and its properties together in an encrypted secret store.

## Production checklist

- Monitor `info@oldalexhub.com` for support, privacy, and data requests.
- Configure the HTTPS API endpoint and retain the installation-hash secret.
- Back up the Android upload key and the model-signing private key. Never put either in a release package.
- Exercise the UMP consent flow, test ads, model download, offline fallback, edge-to-edge layout, and deletion on physical devices in target regions.
- Review the verified API 36 emulator screenshots in `releases/screenshots/` and recapture them on the final physical-device matrix if needed.
- Complete Play Console Data safety, content rating, ads declaration, privacy-policy URL, and political-content review using the actual deployed behavior.
- Run dependency audit and update/mitigate transitive findings before submission.

## Project layout

```text
strategy/                 React Native Android app
  src/game/               deterministic simulation and scenarios
  src/services/           saves, consented telemetry, ads, model policy
  src/ui/                 shared layouts, screens, map, dashboards
  docs/                    mechanics, mathematics, ML, operations, release
  store_assets/            Play listing copy and compliance notes
server/                   Express API and private dashboard
  src/                     auth, validation, database, operations
  ml/                      training/evaluation/export pipeline
  shared/                  cross-language contracts and golden fixtures
release.py                Windows signing/build/package automation
releases/                 generated artifacts (not source)
```
