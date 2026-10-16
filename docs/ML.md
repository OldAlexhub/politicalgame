# Collective reinforcement learning

Only a player who enables both gameplay analytics and collective learning contributes transitions. The app queues typed records locally, uploads bounded batches over configured HTTPS, and excludes names, precise location, real beliefs, advertising IDs, and fingerprints. The API validates records, rejects prohibited keys, hashes the installation token, deduplicates transitions, and stores indexed columns.

An administrator creates an immutable JSONL dataset with a SHA-256 checksum. A restricted worker starts one of a fixed set of commands. Training outputs remain candidates until deterministic benchmarks meet thresholds and an administrator signs approval.

## Implemented algorithms

- **Reward-weighted behavior cloning:** seeded train/validation split and bounded reward weighting over observed legal actions.
- **Discrete Conservative Q-Learning:** a static-dataset offline RL objective combining Bellman error with `logsumexp(Q) - Q(data action)` conservatism.
- **Self-play policy-gradient league:** training across modes/difficulties against randomly selected frozen historical snapshots.
- **Bootstrap generation:** a seeded explainable heuristic plus random exploration before player data exists.

The Gymnasium environment exposes the shared 16-value observation, eight abstract strategy families, legal-action mask, deterministic reset, mode rewards, and terminal outcomes. TypeScript remains authoritative for gameplay; shared contracts and golden fixtures detect feature drift.

## Run

```powershell
cd server
python -m pip install -r ml/requirements.txt
python ml/cli.py generate --episodes 200 --output data/bootstrap.jsonl
python ml/cli.py behavior-cloning --dataset data/bootstrap.jsonl --model-dir data/models
python ml/cli.py offline-rl --dataset data/bootstrap.jsonl --model-dir data/models
python ml/cli.py self-play --episodes 500 --model-dir data/models
python ml/cli.py evaluate --model data/models/policy-<version>.pt --seeds 120
```

## Evaluation

Evaluation spans all modes, three difficulties, fixed seeds, the scripted heuristic, a random legal-action agent, and optionally a previous checkpoint. It reports win rate, head-to-head result, diversity, invalid-action rate, mean scores, player fairness band, and p95 inference latency.

Default approval gates are invalid actions ≤1%, win rate versus baseline ≥50%, simulated player win rate from 30–70%, p95 latency ≤50 ms, and diversity ≥0.20. These gates do not prove a given model improved. Inspect actual evaluation output and repeat enough seeds before registration. Training never auto-promotes.

## Deployment

PyTorch checkpoints export to ONNX opset 18 and are compared numerically with ONNX Runtime. Registration requires an in-directory file and matching checksum. Approval requires passing evaluation and `PSS_MODEL_SIGNING_PRIVATE_KEY`.

The app verifies schema/engine compatibility, Ed25519 signature, and SHA-256 bytes before staging. It opens the staged model before atomic activation and retains the previous cache. Campaigns pin a policy version. Missing, rejected, corrupted, incompatible, or failing policies use the deterministic fallback without blocking play.
