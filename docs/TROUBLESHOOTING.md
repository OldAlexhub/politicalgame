# Troubleshooting

## Android environment is missing

Run `python release.py --check-env`. Install Android Studio, SDK Platform 36, platform-tools, and build tools. The script finds Android Studio's bundled JBR even if `JAVA_HOME` is unset.

## Gradle cannot find the SDK

Run a release command after installing the SDK. It rewrites only `sdk.dir` in `strategy/android/local.properties`.

## Ads do not appear

Core play intentionally continues. Check network, UMP status, AdMob configuration, device support, and logcat. Debug builds use Google test IDs. Interstitials require a qualifying completed transition, a loaded ad, ten minutes since the previous one, and fewer than three that day.

## Telemetry is not uploaded

Both analytics and learning toggles must be on and `APP.apiBaseUrl` must be reachable over HTTPS. Offline records remain in a bounded queue. A blank API URL deliberately disables upload.

## A model is ignored

Confirm approval, correct signing key, engine `1.0.0`, schema `1`, and checksum. Any failure retains/restores the fallback. Never bypass signature checks.

## Training does not start

Training is disabled unless `PSS_TRAINING_ENABLED=true`. Check Python dependencies, paths, worker permissions, disk, and resource limits. Arbitrary commands are deliberately rejected.

## A save will not load

The integrity check rejected corruption or an unsupported schema. The two-phase writer can recover a pending committed value. Preserve raw storage for diagnosis before clearing it.
