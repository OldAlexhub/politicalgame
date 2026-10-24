# Political world 2.0

The player controls a political movement across a continuous career. Holding executive office grants government powers; losing it leaves the movement, its organizers, money, reputation, relationships and commitments available for a comeback. The default start is a fragile new government. Opposition and royal-successor starts use the same country engine.

## Play

Open a regional hub to inspect its communities and developing problems. Tap the selected hub again for a closer view. Review a decision's authority requirements, costs and forecast before committing. Use the Assembly to inspect coalition support, the Cabinet to negotiate with people, and Promises to follow delivery. The Chronicle retains the causal history.

Normal speed advances one day every four seconds. Pause, 2x and 4x are in the top bar. Critical developments can pause automatically. Leaving the foreground pauses the domestic clock and saves; returning never advances domestic time. Online and Settings panels are paused checkpoints.

The national map uses original isometric sprite atlases. Population activity scales with production; strikes stop vehicles; demonstrations represent active situations; funded projects add service buildings and construction sites. React Native supplies accessible controls over Skia's world renderer. Reduced motion disables visual motion independently of simulation progression.

## Simulation contract

`packages/simulation` is the single pure TypeScript engine for the app, replay worker and Python training bridge. Server releases include a byte-identical, checksum-verified copy in `server/shared/simulation`; only the server folder is needed on Nexus. Run `npm run sync:engine` in the server folder after changing this engine and before packaging a release. Schema 3 / engine 2.0.0 use integer political measures, seeded random state, command journals, version pins, receipts, and full causal news records.

- `createWorld(config, content?, policy?)` creates a seeded country.
- `getDecisionPreview(state, command)` gives authority, costs, deadlines and directional forecasts without mutating the world.
- `dispatchCommand(state, command)` applies a legal order. A repeated client ID is idempotent; changed terms with the same ID are rejected.
- `stepSimulation(state, days)` advances needs, production, fiscal accounts, delivery, grievances, actor plans and political settlements.
- `replayCommands(checkpoint, commands, day)` is also the server's validation path.

Each province contains five population groups. The same taxation or subsidy change produces different reactions through income, employment, needs and expectations. Project capacity includes regional staff, administration, procurement losses and concurrent workloads. Maintenance can suspend a completed service. Debt service can trigger insolvency; restructuring trades relief for legitimacy and external financing costs.

Actors choose utility-scored plans using local conditions, faction interests, competence, ambition, loyalty and resources. Negotiations record accepted terms or time-limited counteroffers. Memories affect later relationships. The numerical policy changes bounded utility weights; it never supplies text or unrestricted decisions. Authored dialogue refers to current facts. There is no LLM endpoint or runtime dependency.

## Persistence and connectivity

New saves use checksummed, serialized two-phase writes. Interrupted writes can recover from the verified pending copy. Old schema 1/2 saves are left untouched and displayed as readable archives.

Cloud play is optional. Guest recovery codes restore an identity; revocable device tokens live in Android Keystore via Keychain. Sync submits commands and dates, never trusted treasury totals. Durable replay jobs return canonical SHA-256-checked checkpoints. Lost responses reuse the saved request key. Long histories synchronize in bounded chunks.

A stale cloud revision records a conflict. Restoring the cloud copy first saves different local progress as a separate playable local branch. Shared diplomacy stays attached to the accepted cloud history. Device management and restoration are available in Connected world.

International offers reserve verified funds exactly once. Settlement and refunds are receipts applied on synchronization, with real-server-time limits and expiry. Domestic simulation does not run on the server while away. There is no connected territorial-conquest order. Local AI neighbors remain available offline.

Signed content and numerical policy candidates are checked for compatibility, payload checksum and Ed25519 signature before caching. New careers can use cached updates offline. Existing careers retain their versions; adoption or rollback synchronizes and records a compatible paused checkpoint. Retired server versions remain available to pinned careers.

## Validation

Run `npm test -- --runInBand`, `npx tsc --noEmit`, and `npm run lint` in the app directory. `packages/simulation/harness.ts` evaluates legal player baselines and audits 100 seeds across 30 years with varied actions and starting roles. Audit output includes debt, transitions, promises, crises and save size rather than treating finite numbers alone as balance approval.

Run `npm test` in `../server` for isolated embedded PostgreSQL transaction tests. The older external-database integration suite runs only with a dedicated `PSS_TEST_DATABASE_URL`; never point it at a production database.

Artifacts under `artifacts/` record the latest local audit, numerical-policy evaluation and emulator inspections. These are development checks. Sustained human playtesting and profiling on the agreed physical reference device remain release gates; an emulator measurement does not establish a minimum FPS across Android devices.

The renderer uses the documented [Skia Atlas API](https://wcandillon.github.io/react-native-skia/v2/docs/shapes/atlas/). Reanimated 4.7.x supports React Native 0.88 in the [official compatibility table](https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/); the exact pinned versions also passed the Android build and native runtime checks recorded in [validation](VALIDATION-2.0.md).
