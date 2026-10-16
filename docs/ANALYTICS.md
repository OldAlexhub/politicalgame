# Analytics definitions

- **Daily/weekly/monthly active installation:** distinct keyed-hash installation with at least one opted-in event in the last 1/7/30 rolling days.
- **Session:** an opted-in `session_start`; foreground duration is reported with `session_end` when the app leaves the foreground. Average duration remains blank until duration values exist.
- **Campaign start/completion:** explicit opted-in lifecycle events.
- **Retention:** D1/D7/D30 return activity calculated only for eligible real first-seen cohorts and never populated with a fabricated default.
- **Victory rate:** terminal accepted experiences with `victory` or `transitioned`, divided by terminal accepted experiences for that group.
- **Ad opportunity:** reported impressions and failures. Revenue is not inferred. A future eCPM calculator must be labeled hypothetical or use authenticated official reporting.
- **Training experience:** one validated, consented state/action/next-state transition.

Advertising consent and gameplay analytics consent are independent. No advertising identifier enters learning tables. New event types require schema, privacy, retention, dashboard-definition, and Play Data safety review.
