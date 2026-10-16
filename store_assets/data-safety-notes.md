# Play Console Data safety working notes

These notes are not a substitute for answering the current Play Console form from the final deployed SDK behavior.

## Advertising

The app uses Google Mobile Ads/AdMob and UMP. Google and partners may collect/share device or other identifiers, approximate location, app interactions, diagnostics, and advertising data depending on consent, region, SDK configuration, and Google's documented behavior. Declare advertising and third-party sharing accurately. Link the privacy policy.

## Optional analytics

Opted-in analytics may collect app interactions (session/campaign events, mode, difficulty, completion, duration, and ad event outcome). Data is associated with a pseudonymous installation token that is HMAC-hashed server-side. It is optional in the product and can be disabled.

## Optional collective learning

With separate opt-in, game state/action transitions and outcomes are uploaded. They are app interactions/gameplay data. The dataset excludes account name, email, contacts, precise location, real political views, voting intent, advertising IDs, and fingerprints.

## Data handling

- Encrypted in transit: yes in production; configure HTTPS before release.
- Deletion: local deletion plus a token-linked server deletion endpoint exists.
- Account deletion: ordinary users have no account.
- Ephemeral processing: no; accepted records may be retained for batch training under the published period.
- Required versus optional: advertising processing depends on consent/legal mode; gameplay analytics and learning are optional.
- Security review: validate server TLS, access controls, backups, retention job, SDK declarations, and current Google documentation before filing.
