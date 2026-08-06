# Blockchain infrastructure

This document describes how the app bootstraps chain infrastructure locally, how keys and signing work, and what would change for a production deployment.

## Local architecture

```mermaid
flowchart TB
    Bootstrap["scripts/bootstrap.mjs"]
    Setup["setup-admin.mjs"]
    Deploy["hardhat deploy.ts"]
    Backend["backend startup"]
    FireFly["FireFly stack + signer"]
    Chain["EVM (2s blocks)"]

    Bootstrap --> Setup --> Deploy
    Deploy --> Backend
    Backend -->|"FFI / API / listeners"| FireFly
    Backend -->|"invokeContractAPI(key=address)"| FireFly
    FireFly --> Chain
```

### One-time bootstrap

After starting the FireFly stack, run:

```bash
npm run bootstrap
```

This script:

1. Creates `backend/config.json` from `config.example.json` if needed
2. Creates the admin FireFly account and writes its address to config
3. Compiles, tests, and deploys `MovieRatings`
4. Writes a deployment artifact to `deployments/<stack>.json`

Raters register at runtime through the app; each registration creates a new FireFly wallet.

Manual steps are still required once per machine:

```bash
firefly init dev-challenge 1 --block-period 2 --multiparty=false -t none --sandbox-enabled=false --firefly-base-port 8000 -m scripts/firefly-manifest-v1.3.2.json
firefly start dev-challenge
```

### Runtime startup

When the backend starts it:

1. Loads config from `backend/config.json`, with env var overrides (see `.env.example`)
2. Validates required addresses are present
3. Registers the contract FFI, API, and event listeners with FireFly (idempotent on restart)
4. Subscribes to confirmed blockchain events and forwards them over SSE
5. Exposes REST endpoints including `/api/health` and `/api/operations/:id`

Deploy and account creation are **not** repeated on every backend boot — those are bootstrap concerns.

## Key management

### Current model (custodial, gated)

Private keys live in FireFly's signer. The app only stores **addresses** in config.

| Role | Key location | How the backend signs |
|------|--------------|----------------------|
| Admin | FireFly account 0 (bootstrap) | After password login → session token → `key: ADMIN_ADDRESS` |
| Rater | FireFly account created on register | After login/register → session token → `key: session.address` |

**Registration flow:**

1. User picks a username/password in the app
2. Backend creates a new FireFly wallet via `firefly accounts create`
3. Backend submits `UserRegistry.register(...)` on-chain (username, password hash, salt)
4. User receives a session token and can immediately rate movies

Rater accounts live in the **`UserRegistry` smart contract**, not a local JSON file. After `firefly reset`, the admin rebinds a rater to a freshly provisioned wallet via `adminUpdateWallet`.

**Improvements over the original demo:**

- Raters are not hardcoded — anyone can register
- Usernames and wallet bindings are stored on-chain in `UserRegistry`
- Password hashes are stored on-chain (demo only — visible to anyone reading the contract)
- Rater endpoints require a session token bound to the registered wallet
- Admin password can be set via `ADMIN_PASSWORD` env var instead of config file
- Sessions expire after 24 hours
- `/api/health` reports config and FireFly connectivity issues at startup

**Demo credentials:**

- Admin password: `blockbuster` (or `ADMIN_PASSWORD`)
- Raters: self-register in the app (username 3–32 chars, password 6+ chars)

### Production path

For a real network deployment, typical next steps:

1. **User-owned keys** — MetaMask / WalletConnect for raters; backend returns unsigned payloads or uses external signing
2. **Secrets** — admin credentials in a secret manager, not config files
3. **Key separation** — deployer key ≠ admin key; consider multisig for admin
4. **Network config** — chain ID, RPC URL, gas policies, confirmation depth
5. **Deploy pipeline** — CI deploy with verified bytecode; address registry instead of local JSON

The smart contract already enforces `msg.sender` for ratings and admin-only movie adds, so moving to browser-wallet signing for raters would not require contract changes.

## Configuration

| Source | Purpose |
|--------|---------|
| `backend/config.json` | Admin address, contract addresses, FireFly host (gitignored) |
| `.env` / env vars | Secrets and environment overrides |
| `deployments/<stack>.json` | Deploy artifact: contract address, admin, timestamp |

Env vars (see `.env.example`):

- `FIREFLY_HOST`, `FIREFLY_NAMESPACE`, `CONTRACT_VERSION`, `PORT`
- `ADMIN_PASSWORD`
- `MOVIE_RATINGS_ADDRESS`, `ADMIN_ADDRESS` (optional overrides)

## API additions

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | FireFly reachability + config validation |
| `GET /api/operations/:id` | Poll FireFly operation status for a submitted tx |
| `POST /api/rater/register` | Create account + FireFly wallet; returns session token |
| `POST /api/rater/login` | Authenticate a registered rater; returns session token |

Rating submission (`POST /api/movies/:id/ratings`) now requires `Authorization: Bearer <rater-token>` and signs with the authenticated wallet only.

## Testnet considerations

To target a public testnet instead of the local FireFly stack:

1. Add a Hardhat network entry (e.g. Sepolia) with RPC URL and deployer key from env
2. Deploy with `npx hardhat run scripts/deploy.ts --network sepolia`
3. Point `FIREFLY_HOST` at a FireFly instance connected to that network, or replace FireFly signing with direct RPC + wallet connect
4. Fund deployer and admin accounts from a faucet
5. Wait for appropriate confirmation depth before treating ratings as final

The bootstrap script and deployment artifact pattern stay the same; only the network target and key custody model change.
