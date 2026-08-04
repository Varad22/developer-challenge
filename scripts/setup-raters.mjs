#!/usr/bin/env node
// Creates demo blockchain accounts on the FireFly stack (if needed) and
// writes them into backend/config.json: one admin account (the only one
// allowed to add movies) plus named rater personas.
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const STACK = process.env.FF_STACK || "dev-challenge";
const RATER_NAMES = ["alice", "bob", "carol"];

function detectCli() {
  for (const cli of ["ff", "firefly"]) {
    try {
      execSync(`${cli} version`, { stdio: "ignore" });
      return cli;
    } catch {
      // try next
    }
  }
  throw new Error("FireFly CLI not found. Install it and retry.");
}

const cli = detectCli();

function listAccounts() {
  return JSON.parse(execSync(`${cli} accounts list ${STACK}`, { encoding: "utf8" }));
}

const totalNeeded = RATER_NAMES.length + 1; // +1 for the admin account
let accounts = listAccounts();
while (accounts.length < totalNeeded) {
  console.log(`Creating account ${accounts.length + 1} of ${totalNeeded}...`);
  execSync(`${cli} accounts create ${STACK}`, { stdio: "inherit" });
  accounts = listAccounts();
}

const configPath = join(dirname(fileURLToPath(import.meta.url)), "..", "backend", "config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
config.ADMIN_ADDRESS = accounts[0].address;
config.RATERS = Object.fromEntries(
  RATER_NAMES.map((name, i) => [name, accounts[i + 1].address])
);
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

console.log("backend/config.json updated with admin and raters:");
console.log({ admin: config.ADMIN_ADDRESS, ...config.RATERS });
