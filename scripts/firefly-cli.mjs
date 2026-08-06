import { execSync, spawnSync } from "child_process";

const CANDIDATES = ["firefly", "ff"];

export function detectFireflyCli() {
  const override = process.env.FF_CLI?.trim();
  if (override) {
    const result = spawnSync(override, ["version"], { stdio: "ignore" });
    if (result.status === 0) {
      return override;
    }
    throw new Error(`FF_CLI is set to '${override}' but it is not available`);
  }

  for (const cli of CANDIDATES) {
    const result = spawnSync(cli, ["version"], { stdio: "ignore" });
    if (result.status === 0) {
      return cli;
    }
  }

  throw new Error(
    "FireFly CLI not found. Install it (command is usually 'firefly' or 'ff') and retry."
  );
}

export function fireflyCommand(subcommand) {
  const cli = detectFireflyCli();
  return `${cli} ${subcommand}`;
}

export function execFirefly(args, options = {}) {
  const cli = detectFireflyCli();
  return execSync(`${cli} ${args}`, options);
}
