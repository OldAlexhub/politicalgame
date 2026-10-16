# Privacy Policy — Political Strategy Simulator

**Developer:** Old Alex Hub  
**Effective date:** October 15, 2026

Political Strategy Simulator is a fictional, free-with-ads Android game. This policy explains the information processed when you use the game, the choices available to you, and how optional collective AI learning works.

## Core gameplay and local storage

No account or login is required for ordinary play. Campaign state, save slots, settings, achievements, advertising frequency-cap timestamps, queued telemetry, and cached approved AI policy files may be stored locally on your device. Core gameplay is available offline. Local data remains until you delete it in the app, clear the app's storage, or uninstall the app.

## Advertising

The game uses Google AdMob as its only direct monetization source. Google and its partners may process device information, IP address, approximate location derived from IP, ad interaction data, consent signals, and other advertising data as described by Google's policies. The game uses Google's User Messaging Platform where required and provides access to advertising privacy options when available.

Advertising consent is separate from optional gameplay analytics. The app does not use an AdMob advertising identifier to join advertising activity to collective-learning records. Debug builds use Google's test ad units; release builds use the developer's production units.

For information about Google's processing, see [How Google uses information from sites or apps that use its services](https://policies.google.com/technologies/partner-sites) and [Google's advertising policies](https://policies.google.com/technologies/ads).

## Optional gameplay analytics

The app asks before sending optional gameplay analytics. If you agree, the service may receive minimized events such as session start/duration, campaign mode and difficulty, campaign completion, turns, broad game outcomes, and ad load/impression/failure events. These are used to understand stability, balancing, retention, and advertising frequency. The private dashboard displays actual collected aggregates and does not fabricate revenue.

You can decline or later turn off gameplay analytics without losing access to any campaign or feature.

## Optional collective AI learning

Collective learning requires both gameplay-analytics consent and the separate collective-learning choice. When enabled, the app may send pseudonymous simulation transitions containing the game mode, engine/policy versions, anonymous game ID, turn, normalized fictional state features, legal in-game actions, selected action, AI response, next state, reward signals, and terminal outcome.

The learning dataset is designed not to contain your name, email, contacts, precise location, real political affiliation, real voting preference or intention, advertising identifier, or device fingerprint. Fictional in-game choices are treated only as game behavior and not as evidence of real political beliefs.

Accepted records from participating players may be combined with simulated self-play and used in batch behavior-cloning, offline reinforcement-learning, self-play, evaluation, and balancing processes. A trained model contains learned parameters rather than a list of individual game records. A deletion request removes linked raw records when still retained, but cannot reliably reverse already aggregated statistics or parameters in models trained before deletion; this policy does not promise machine unlearning.

## Pseudonymous identifiers and server processing

If optional data sharing is enabled, the app creates a random installation token. The server stores a keyed cryptographic hash of that token rather than the raw token. The token exists only to support batching, deduplication, rate limiting, retention measurement, and deletion. It is not joined to advertising identifiers.

Production transmission must use HTTPS. The server validates request schemas, rejects prohibited fields, limits batch/request size, rate-limits ingestion, and restricts administrative access. Raw gameplay and analytics data are intended to be retained only for the documented operating/training period and then deleted or aggregated. The initial recommended raw-retention limit is 180 days; production operations must configure and enforce the adopted period.

## Data deletion and choices

In **Settings → Privacy controls**, you can turn optional analytics and collective learning on/off, open Google advertising privacy options where available, and delete local plus server-linked raw gameplay records.

If the server cannot be reached, local deletion still completes and the server request must be retried when connectivity is available. Previously aggregated statistics and trained parameters cannot reliably be reversed.

## Sharing and service providers

Information may be processed by Google and its advertising partners, the developer's hosting/database/security providers, and authorities when required by law. The developer does not sell gameplay telemetry or use it for targeted political advertising.

## Children

This complex strategy title is intended for a general/teen audience and is not directed to young children. The final Play target-audience selection and ad treatment must match the released content and applicable law.

## Security, international processing, and changes

Reasonable safeguards are used, but no system is perfectly secure. Data may be processed in countries where providers operate, subject to applicable safeguards. Material policy changes will be presented as required and the effective date updated.

## Contact

**Old Alex Hub**  
Email: **privacy@oldalexhub.example**

The address above is a release-blocking placeholder and must be replaced with a monitored contact before publication.
