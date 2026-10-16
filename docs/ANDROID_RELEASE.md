# Android release

The package is `com.oldalexhub.politicalstrategysimulator`, version code `1`, and target API `36`. The minimum API is 24. Release shrinking is enabled and the release build uses a dedicated ignored signing configuration; it never falls back to the debug key.

## Automated build

From the outer workspace root:

```powershell
python release.py --check-env
python release.py --generate-key-only
python release.py --skip-screenshots
```

Other forms are `python release.py`, `--skip-build`, `--screenshots-only`, `--clean`, and `--no-clean`.

The script detects `JAVA_HOME`, Android Studio JBR/JDK, SDK environment variables, the standard Windows SDK path, `adb`, Gradle, and API 36. It preserves unrelated `local.properties` values and writes `sdk.dir` before Gradle runs.

If signing files are missing, it creates a 4096-bit RSA upload key with random credentials. Back up `android/app/political-strategy-release.keystore` and `android/keystore.properties` together in encrypted storage. They are ignored and never copied into `releases/`.

Outputs include signed APK/AAB under `releases/builds/`, release docs, branding, Play listing copy, safe signing backup instructions, and optionally verified device screenshots. The AAB is the primary Play artifact.

## Device verification

Test gesture and three-button navigation, cutouts, small/large screens, keyboard resize, map interaction, offline launch, save recovery, consent changes, test ads, production-ID selection, model failure fallback, app lifecycle, and one full campaign per mode. Upload first to an internal Play track and inspect pre-launch reports.

Google requires a certified consent platform such as UMP for applicable EEA/UK advertising consent; see [AdMob ad serving modes](https://developers.google.com/admob/android/privacy/ad-serving-modes). Recheck Play policy and SDK versions immediately before submission.
