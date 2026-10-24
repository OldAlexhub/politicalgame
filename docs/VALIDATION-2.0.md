# Political Strategy 2.0 validation

Development validation on 23 October 2026. This records executed checks, not production release approval.

## Automated checks

- Mobile: **95 tests pass across 10 suites**, including the original engine tests, deterministic replay, role changes, promises and delivery, negotiation memory, local save recovery, legacy archives, clock behavior, signature checks, and cloud retry/conflict preservation.
- TypeScript: `npx tsc --noEmit` passes. ESLint reports no errors.
- Server: **16 tests pass**, covering isolated PostgreSQL-compatible behavior, repeated migrations, self-contained packaging, standalone Node/Python simulation replay, configuration validation and worker supervision. The legacy external PostgreSQL integration suite is skipped because no disposable `PSS_TEST_DATABASE_URL` was supplied. No production database was used.
- Nexus package: extracted outside the repository and installed with `npm ci --omit=dev`. Deployment preflight, fail-fast database validation, admin bootstrap/login, dashboard/health HTTP, guest creation and queued career replay passed using an embedded disposable database supplied by the test harness. Production dependencies report zero known vulnerabilities. This does not establish connectivity to the live Nexus database.
- Android: the original 2.0.0 debug build passed. The updated signed release APK and Play App Bundle build successfully with the pinned Skia/Reanimated/Worklets versions. Current release version 2.0.1, version code 15, four Android ABIs.
- Release APK signature verification and 16 KB ZIP page-alignment checks pass. Packaged output hashes are recorded in [`build-checksums.json`](../artifacts/build-checksums.json).

## Long-run simulation

[`100-seed-audit.json`](../artifacts/100-seed-audit.json) covers 100 seeds, three starting roles, two difficulty settings and 30 simulated years per country. The harness submitted 12,000 legal actions and checked invariants every 90 days, including an available movement action after cooldowns.

All 100 outcomes were distinct. No invalid states or unintended action dead ends occurred. The run observed 40 changes of office, 32 delivered and 602 broken commitments, and 1,916 critical developments. Maximum observed debt was 29,924 credits; maximum serialized save was 622,117 characters. A previous audit exposed unchecked debt accumulation; explicit restructuring and insolvency consequences now keep that failure from becoming an unbounded spiral.

These are varied scripted policies, not skilled human play. The high rate of broken promises needs human balance review rather than being presented as proof that the game is balanced.

## Numerical opponents

[`policy-evaluation.json`](../artifacts/policy-evaluation.json) records seeded utility-weight search and a separate 24-seed, ten-year hold-out evaluation. All six actor plan types were exercised and no invalid actions occurred. The candidate and bundled policy both left the baseline player in government in 17 of 24 countries. This validates the pipeline; it does **not** demonstrate a stronger opponent. The candidate remains unapproved and unpublished.

## Emulator checks

The original Android 16 x86_64 emulator retains its original app and saves. The development package uses a separate `.dev` application ID. Guest identity creation and career replay synchronization succeeded against the isolated local preview server. A 4x run reached an actual service strike, paused on its critical development, and reloaded its saved date and conditions after process restart.

Changing crowd sizes exposed a native Atlas array-length race. Crowd and vehicle batches now use fixed-capacity slots; a subsequent run through changing production and the service strike did not crash. Original architecture, citizen, vehicle and portrait atlases are packaged with the game. Atlas loading explicitly repaints while paused.

The original emulator lacked room for another APK update. A separate `PoliticalWorld_2_Test` emulator was created for clean packaged-build checks, without deleting the original emulator's apps or data.

The signed release APK installed and launched on that clean emulator. A funded clinic deducted 1,200 credits and produced visible construction. During a 38.26-second 4x run, Android `gfxinfo` counted 2,295 frames (59.98 frames/second), 0.22% janky frames and a 25 ms 95th-percentile frame latency. See [`emulator-performance.json`](../artifacts/emulator-performance.json). This is a short emulator sample, not sustained dense-crisis certification or a physical-device guarantee.

Backgrounding the running release app on 9 February, Year 1 and returning left it paused on the same date with the same 5,719-credit treasury. The final APK also installed successfully as an in-place update on the clean validation emulator.

## Fullscreen and text layout follow-up, version 2.0.1

The Assembly count was clipped by the smaller nested text's line-height span on Android. The large count and caption now use separate text elements with baseline alignment and an explicit metric line height. Shared label/value rows reserve room for numbers and wrap labels. Headers, time controls, the briefing strip and navigation use content-aware minimum heights rather than fixed text containers.

The Android activity now hides all system bars through `WindowInsetsControllerCompat`, and reapplies immersive mode on resume and focus return. This follows [Android's immersive-mode guidance](https://developer.android.com/develop/ui/views/layout/immersive). Edge swipes still reveal transient system controls, which hide again automatically; device cutout safe areas remain protected.

Validation used the current Android 16 development emulator:

- All 12 main panels were opened and visually inspected at the normal display settings.
- Assembly and Treasury values were inspected at 130% text scale and 480 dpi, corresponding to an 800-by-360-dp landscape viewport. Long financial labels and values remained readable after scrolling.
- Gesture navigation and three-button navigation were checked, including reverse landscape with the navigation area on the left. Android reported both status and navigation bars hidden while in the game.
- An edge swipe revealed system bars, the transient timeout hid them, and app background/foreground restored fullscreen. Dismissing the emulator's input-method/stylus popup also restored fullscreen.
- The update installed over the existing release without clearing saves. The Valara career reopened at Day 16, February, Year 1 with 5,719 credits and 52 coalition seats.
- The 95 tests still pass; TypeScript passes; ESLint has no errors (17 existing warnings). APK signing and 16 KB alignment checks pass. Screenshots, UI trees and system-bar records are under `artifacts/ui-2.0.1/`.

The emulator's font scale, density, gesture navigation and orientation were restored after the checks. These are development checks on the agreed emulator, not a guarantee across every phone configuration.

## Remaining release gates

- Sustained human playtests of governing, losing office, succession and long careers; tune difficulty and promise-delivery rates from those results.
- Continue sustained dense-crisis performance and accessibility checks on the agreed development emulator. Emulator frame timing cannot establish a 30 FPS minimum across Android devices; physical-device coverage remains a separate release check.
- Deploy the self-contained `server/deploy/PoliticalStrategyServer-2.0.0-Nexus.zip` using [the Nexus guide](../../server/DEPLOY-NEXUS.md). `npm start` supervises the API and required durable workers. Configure backups; signing and Python are needed only for optional content publication/numerical training.
- Validate the old external-database integration suite against a disposable PostgreSQL instance during deployment testing.

No server deployment, artifact promotion, or store publication was performed.
