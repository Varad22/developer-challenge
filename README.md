# Blockbuster - On-chain Movie Ratings

A DApp built on [Hyperledger FireFly](https://hyperledger.github.io/firefly/latest/) for the Kaleido Developer Challenge.

## The use case

A blockchain-backed movie ratings system. Anyone can add a movie to the registry and rate it 1 to 5 stars. The trust properties come from the chain:

- Every movie and every rating is an on-chain transaction, signed by a wallet.
- The smart contract enforces **one rating per wallet per movie** - rating again replaces your previous vote instead of adding a new one, so no ballot stuffing.
- Rating totals are aggregated on-chain, so the average score can be verified by anyone without trusting the app operator.

The UI has separate login flows for admins and raters. Raters register to receive their own FireFly wallet, then rate movies on-chain. Each wallet gets **one vote per movie** — rating again replaces your previous score. Switch accounts by logging out and signing in as another user to see per-wallet rules in action.

Because the chain runs with a 2-second block period, ratings are not instantaneous. The UI leans into this rather than hiding it: submitted ratings show a "waiting for block confirmation" spinner until the blockchain event arrives over a live event stream.

## Architecture

- **`solidity/`** - [`MovieRatings.sol`](solidity/contracts/MovieRatings.sol): the on-chain registry. Emits `MovieAdded` and `MovieRated` events. Unit-tested with Hardhat.
- **`backend/`** - a backend-for-the-frontend. On startup it registers the contract ABI with FireFly as a contract interface + API and creates event listeners. It exposes a REST API (including health checks and operation status), gates signing behind admin/rater sessions, and forwards confirmed blockchain events to browsers over Server-Sent Events.
- **`frontend/`** - React + Tailwind UI: movie grid, click-to-rate stars, persona switcher with rater login, and a live connection indicator.
- **`scripts/`** - bootstrap helpers: account setup, one-shot deploy orchestration.
- **`docs/BLOCKCHAIN-INFRA.md`** - deeper notes on bootstrap, key management, and production deployment considerations.

All chain interaction goes through FireFly's API (via the [FireFly Node.js SDK](https://www.npmjs.com/package/@hyperledger/firefly-sdk)) - the backend never talks to the node directly. Private keys stay in FireFly's signer; the app stores addresses and authenticates who the backend may sign for.

## How to run it

### Prerequisites

- Docker (with Compose)
- Node.js 16+
- The [FireFly CLI](https://github.com/hyperledger/firefly-cli) - on macOS: `brew install firefly`. The binary is usually named `firefly` (some installs also provide `ff` as an alias).

### 1. Create and start the FireFly stack

```bash
firefly init dev-challenge 1 --block-period 2 --multiparty=false -t none --sandbox-enabled=false --firefly-base-port 8000 -m scripts/firefly-manifest-v1.3.2.json
firefly start dev-challenge
```

Notes:

- `--block-period 2` gives real-world-like block latency, per the challenge requirements.
- `--firefly-base-port 8000` avoids macOS's AirPlay Receiver, which occupies the default port 5000. If you use a different port, update `HOST` in [`backend/config.json`](backend/config.json).
- `--multiparty=false -t none --sandbox-enabled=false` runs a lean single-org gateway-mode stack - all this app needs.
- `-m scripts/firefly-manifest-v1.3.2.json` pins the stack to the FireFly v1.3.2 release. At the time of writing, the CLI's default "latest" manifest references Docker images that are no longer available on `ghcr.io/hyperledger`, so the pin makes the setup reproducible.

### 2. Bootstrap accounts, deploy contract, and write config

```bash
npm run bootstrap
```

This creates the admin account, deploys `MovieRatings`, updates `backend/config.json`, and writes a deployment artifact to `deployments/dev-challenge.json`. Raters are **not** pre-created — they register through the app.

You can still run the individual steps manually if you prefer:

```bash
node scripts/setup-admin.mjs
cd solidity && npm install && npm test
npx hardhat run scripts/deploy.ts --network firefly
```

### 3. Start the backend

```bash
cd backend
npm install
npm start
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm start
```

Open [http://localhost:4000](http://localhost:4000). Register as a rater or sign in as admin, add movies, rate them, and watch confirmations arrive live. You can also see every transaction in the FireFly Explorer at [http://localhost:8000/ui](http://localhost:8000/ui).

**Demo credentials**

- Admin password: `blockbuster` (override with `ADMIN_PASSWORD` env var)
- Raters: register in the app with any username (3+ chars) and password (6+ chars)

Optional env overrides are documented in [`.env.example`](.env.example).

## Project layout

- [`solidity/`](solidity/) - contracts, Hardhat tests, deploy script
- [`backend/`](backend/) - Express BFF using the FireFly SDK
- [`frontend/`](frontend/) - React + Vite + Tailwind UI
- [`scripts/`](scripts/) - bootstrap and account setup helpers
- [`docs/BLOCKCHAIN-INFRA.md`](docs/BLOCKCHAIN-INFRA.md) - blockchain bootstrap, keys, and production notes
