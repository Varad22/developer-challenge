#!/usr/bin/env node
// Backwards-compatible alias for setup-admin.mjs
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const script = join(dirname(fileURLToPath(import.meta.url)), "setup-admin.mjs");
const result = spawnSync(process.execPath, [script], { stdio: "inherit" });
process.exit(result.status ?? 1);
