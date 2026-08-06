#!/usr/bin/env node
// Ensures the admin FireFly account exists and writes ADMIN_ADDRESS to config.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { detectFireflyCli, execFirefly } from "./firefly-cli.mjs";

const STACK = process.env.FF_STACK || "dev-challenge";
const cli = detectFireflyCli();

function listAccounts() {
  return JSON.parse(
    execFirefly(`accounts list ${STACK}`, { encoding: "utf8" })
  );
}

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(rootDir, "backend", "config.json");
const examplePath = join(rootDir, "backend", "config.example.json");

if (!existsSync(configPath)) {
  copyFileSync(examplePath, configPath);
  console.log("Created backend/config.json from config.example.json");
}

let accounts = listAccounts();
if (accounts.length === 0) {
  console.log(`Creating admin account via '${cli}'...`);
  execFirefly(`accounts create ${STACK}`, { stdio: "inherit" });
  accounts = listAccounts();
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
config.ADMIN_ADDRESS = accounts[0].address;
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

console.log("backend/config.json updated with admin account:");
console.log({ admin: config.ADMIN_ADDRESS });
console.log("Raters register through the app and receive their own FireFly wallet.");
