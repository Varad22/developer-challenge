import { execSync } from "child_process";
import { config } from "./config";

const STACK = process.env.FF_STACK || "dev-challenge";
const CLI_CANDIDATES = ["firefly", "ff"];

interface StackAccount {
  address: string;
}

function detectCli(): string {
  const override = process.env.FF_CLI?.trim();
  if (override) {
    execSync(`${override} version`, { stdio: "ignore" });
    return override;
  }

  for (const cli of CLI_CANDIDATES) {
    try {
      execSync(`${cli} version`, { stdio: "ignore" });
      return cli;
    } catch {
      // try next
    }
  }

  throw new Error(
    "FireFly CLI not found. Install it (command is usually 'firefly' or 'ff') and ensure the stack is running."
  );
}

function listAccounts(cli: string): StackAccount[] {
  return JSON.parse(
    execSync(`${cli} accounts list ${STACK}`, { encoding: "utf8" })
  );
}

export function createStackAccount(): StackAccount {
  const cli = detectCli();
  const before = listAccounts(cli);
  execSync(`${cli} accounts create ${STACK}`, { stdio: "pipe" });
  const after = listAccounts(cli);

  const created = after.find(
    (account) => !before.some((existing) => existing.address === account.address)
  );

  if (!created?.address) {
    throw new Error("Failed to create a new FireFly account");
  }

  return created;
}

export function ensureAdminAccount(): string {
  const cli = detectCli();
  let accounts = listAccounts(cli);

  if (accounts.length === 0) {
    execSync(`${cli} accounts create ${STACK}`, { stdio: "inherit" });
    accounts = listAccounts(cli);
  }

  if (!accounts[0]?.address) {
    throw new Error("No admin account available on the FireFly stack");
  }

  return accounts[0].address;
}
