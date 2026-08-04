# Blockbuster - On-chain Movie Ratings

A DApp built on [Hyperledger FireFly](https://hyperledger.github.io/firefly/latest/) for the Kaleido Developer Challenge.

## The use case

A blockchain-backed movie ratings system. Anyone can add a movie to the registry and rate it 1 to 5 stars. The trust properties come from the chain:

- Every movie and every rating is an on-chain transaction, signed by a wallet.
- The smart contract enforces **one rating per wallet per movie** - rating again replaces your previous vote instead of adding a new one, so no ballot stuffing.
- Rating totals are aggregated on-chain, so the average score can be verified by anyone without trusting the app operator.

The UI includes a persona switcher (three demo wallets: alice, bob, and carol) so you can see the per-wallet rules in action: rate a movie as alice, switch to bob and rate it again, then watch the average update live. Change your mind and re-rate as the same persona - the contract swaps out your old vote without inflating the rating count.

Because the chain runs with a 2-second block period, ratings are not instantaneous. The UI leans into this rather than hiding it: submitted ratings show a "waiting for block confirmation" spinner until the blockchain event arrives over a live event stream.

## Architecture

- **`solidity/`** - [`MovieRatings.sol`](solidity/contracts/MovieRatings.sol): the on-chain registry. Emits `MovieAdded` and `MovieRated` events. Unit-tested with Hardhat.
- **`backend/`** - a backend-for-the-frontend. On startup it registers the contract ABI with FireFly as a contract interface + API and creates event listeners. It exposes a small REST API and forwards confirmed blockchain events to browsers over Server-Sent Events.
- **`frontend/`** - React + Tailwind UI: movie grid, click-to-rate stars, persona switcher, and a live connection indicator.

All chain interaction goes through FireFly's API (via the [FireFly Node.js SDK](https://www.npmjs.com/package/@hyperledger/firefly-sdk)) - the backend never talks to the node directly.

## How to run it

### Prerequisites

- Docker (with Compose)
- Node.js 16+
- The [FireFly CLI](https://github.com/hyperledger/firefly-cli) - on macOS: `brew install firefly` (the binary may be named `firefly` instead of `ff`; the commands below work with either name)

### 1. Create and start the FireFly stack

```bash
ff init dev-challenge 1 --block-period 2 --multiparty=false -t none --sandbox-enabled=false --firefly-base-port 8000 -m scripts/firefly-manifest-v1.3.2.json
ff start dev-challenge
```

Notes:

- `--block-period 2` gives real-world-like block latency, per the challenge requirements.
- `--firefly-base-port 8000` avoids macOS's AirPlay Receiver, which occupies the default port 5000. If you use a different port, update `HOST` in [`backend/config.json`](backend/config.json).
- `--multiparty=false -t none --sandbox-enabled=false` runs a lean single-org gateway-mode stack - all this app needs.
- `-m scripts/firefly-manifest-v1.3.2.json` pins the stack to the FireFly v1.3.2 release. At the time of writing, the CLI's default "latest" manifest references Docker images that are no longer available on `ghcr.io/hyperledger`, so the pin makes the setup reproducible.

### 2. Create the demo rater wallets

```bash
node scripts/setup-raters.mjs
```

This creates three accounts on the stack (if needed) and writes them into `backend/config.json` as the alice/bob/carol personas.

### 3. Compile, test, and deploy the smart contract

```bash
cd solidity
npm install
npm test
npx hardhat run scripts/deploy.ts --network firefly
```

The deploy script writes the contract address into `backend/config.json` automatically.

### 4. Start the backend

```bash
cd backend
npm install
npm start
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm start
```

Open [http://localhost:4000](http://localhost:4000). Add a movie, rate it as different personas, and watch confirmations arrive live. You can also see every transaction in the FireFly Explorer at [http://localhost:8000/ui](http://localhost:8000/ui).

## Project layout

- [`solidity/`](solidity/) - contracts, Hardhat tests, deploy script
- [`backend/`](backend/) - Express BFF using the FireFly SDK
- [`frontend/`](frontend/) - React + Vite + Tailwind UI
- [`scripts/`](scripts/) - stack setup helpers
