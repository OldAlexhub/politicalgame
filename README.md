# Political Strategy 2.0

A continuous political career in a procedural fictional country: governing, organizing, negotiating, delivering promises, losing office, and returning to power. The country keeps its history through elections, constitutional changes, succession and coups.

The overhaul replaces the campaign menu with a landscape isometric world, original sprite atlases, a population and fiscal simulation, autonomous political actors, and optional asynchronous countries. Domestic play works offline. Opponents use utility rules and bounded numerical policies; no LLMs are used.

See [the gameplay and technical guide](docs/POLITICAL-WORLD-2.md), [executed validation and release gates](docs/VALIDATION-2.0.md), and [server operations](../server/LIVING-WORLD.md). Previous campaigns remain readable archives; [1.x documentation](docs/LEGACY-1X.md) describes their original behavior.

## Run on Android

Requirements: Node 22.18+, Android Studio/JBR, SDK/NDK versions declared in `android/`, and an emulator or device.

```powershell
npm ci
npm start
# A second shell, from this directory:
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
.\android\gradlew.bat -p android :app:assembleDebug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8081 tcp:8081
adb shell am start -n com.oldalexhub.politicalstrategysimulator.dev/com.oldalexhub.politicalstrategysimulator.MainActivity
```

The debug app uses a `.dev` package suffix to preserve an installed production app and its data. Its connected world uses `http://10.0.2.2:8787`. Run `npm run preview` in `../server` for an isolated local PostgreSQL-compatible preview, or configure a development Express/PostgreSQL service. Release builds use the existing HTTPS production endpoint; deploy `/api/v2` and its workers before enabling connected play there.

## Verify and package

```powershell
npx tsc --noEmit
npm test -- --runInBand
npm run lint
.\android\gradlew.bat -p android :app:assembleRelease :app:bundleRelease
```

Release signing uses the existing ignored `android/keystore.properties` and keystore. Keep these private. Version 2.0.0 uses Android version code 14. Building does not publish to Google Play or deploy the server.

Pinned native rendering dependencies: React Native 0.88.0, Skia 2.14.0, Reanimated 4.7.1, Worklets 0.13.0 and Keychain 10.0.0. Original art and frame metadata are in `assets/world/manifest.json`.

The app has optional consented analytics and separate numerical-opponent learning consent. Advertising remains on the home screen, separate from gameplay. Sound, reduced motion, account/device management, career restoration and version adoption are available in game.
