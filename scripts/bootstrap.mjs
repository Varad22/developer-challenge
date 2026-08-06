#!/usr/bin/env node
// One-shot bootstrap for local FireFly development:
// 1. Ensure backend/config.json exists
// 2. Create stack accounts and write addresses
// 3. Compile, test, and deploy MovieRatings
// 4. Print next steps for backend + frontend
import { execSync, spawnSync } from "child_process";
import { copyFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const STACK = process.env.FF_STACK || "dev-challenge";
const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, options = {}) {
  console.log(`\n> ${command}`);
  execSync(command, { stdio: "inherit", cwd: rootDir, ...options });
}

function detectCli() {
  for (const cli of ["ff", "firefly"]) {
    const result = spawnSync(cli, ["version"], { stdio: "ignore" });
    if (result.status === 0) {
      return cli;
    }
  }
  throw new Error("FireFly CLI not found. Install it and retry.");
}

function ensureConfig() {
  const configPath = join(rootDir, "backend", "config.json");
  const examplePath = join(rootDir, "backend", "config.example.json");
  if (!existsSync(configPath)) {
    copyFileSync(examplePath, configPath);
    console.log("Created backend/config.json from config.example.json");
  }
}

function ensureStackRunning(cli) {
  const info = spawnSync(cli, ["info", STACK], { encoding: "utf8" });
  if (info.status !== 0) {
    throw new Error(
      `FireFly stack '${STACK}' is not available. Start it first:\n` +
        `  ff init ${STACK} 1 --block-period 2 --multiparty=false -t none --sandbox-enabled=false --firefly-base-port 8000 -m scripts/firefly-manifest-v1.3.2.json\n` +
        `  ff start ${STACK}`
    );
  }
  console.log(`FireFly stack '${STACK}' is available.`);
}

console.log("Blockbuster bootstrap");
console.log("=====================");

ensureConfig();
const cli = detectCli();
ensureStackRunning(cli);

run("node scripts/setup-raters.mjs");
run("npm install", { cwd: join(rootDir, "solidity") });
run("npm test", { cwd: join(rootDir, "solidity") });
run("npx hardhat run scripts/deploy.ts --network firefly", {
  cwd: join(rootDir, "solidity"),
});

console.log("\nBootstrap complete.");
console.log("\nNext steps:");
console.log("  cd backend && npm install && npm start");
console.log("  cd frontend && npm install && npm start");
console.log("\nOpen http://localhost:4000");
console.log("Admin password: blockbuster (or ADMIN_PASSWORD env var)");
console.log("Rater passwords: alice, bob, carol");
