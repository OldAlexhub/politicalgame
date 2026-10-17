# Simulation mathematics and political actors

Political quantities use integer basis points from 0 to 10,000 in the mobile engine. This avoids platform-dependent accumulation from UI floating-point calculations. Training observations normalize the same ordered values only at the learning boundary.

The 16-feature observation contract is versioned in `server/shared/simulation-schema-v1.json`: turn progress, treasury, influence, legitimacy, sentiment, momentum, corruption, five economic indicators, average faction support/cohesion, institution confidence, and regional support. Cross-language initial-state fixtures live in `server/shared/golden-initial-states-v1.json` and are asserted by TypeScript and Python tests.

## Seeded probability

The mobile engine uses an explicit-state Mulberry32 generator. `randomState` is saved after every draw. Event selection, opponent uncertainty, and election volatility reproduce from the same engine version, seed, and ordered actions. Timestamps advance deterministically from campaign creation for replay state.

## Actors, factions, and institutions

Actors have role, faction, loyalty, trust, ambition, risk tolerance, age where relevant, and bounded memories. An action updates each actor's memory, with stronger sentiment when it targets that actor or faction. Factions track influence, support, cohesion, and priorities. Institutions track authority, confidence, and alignment. AI logic uses live support/confidence/resource values, not a generic difficulty roll.

## Economy and events

Growth, employment, inflation, inequality, and resilience influence public sentiment, legitimacy, revenue, and shock resistance. Low reserves add price pressure. Productive investment can create direct costs and delayed gains. Events have conditions, once-per-campaign IDs, severity, choices, direct effects, and optional scheduled effects. Event responses are normal validated turn actions.

## Endings

Collapse can occur early when legitimacy, sentiment, or organized support reaches an extreme. Otherwise mode-specific checks use multiple systems. Presidential results resolve state electors; the Republic checks survival or a credible managed transition; the Crown checks succession preparation or charter reform; the Transition requires a charter plus coalition and institutional confidence.
