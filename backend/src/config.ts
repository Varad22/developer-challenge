import fs from "fs";
import path from "path";

interface FileConfig {
  HOST?: string;
  NAMESPACE?: string;
  VERSION?: string;
  PORT?: number;
  MOVIE_RATINGS_ADDRESS?: string;
  USER_REGISTRY_ADDRESS?: string;
  ADMIN_ADDRESS?: string;
  ADMIN_PASSWORD?: string;
}

function loadFileConfig(): FileConfig {
  const configPath = path.join(__dirname, "..", "config.json");
  if (!fs.existsSync(configPath)) {
    console.warn(
      `Warning: ${configPath} not found. Copy backend/config.example.json or run: node scripts/bootstrap.mjs`
    );
    return {};
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

const file = loadFileConfig();

export const config = {
  HOST: process.env.FIREFLY_HOST ?? file.HOST ?? "http://localhost:8000",
  NAMESPACE: process.env.FIREFLY_NAMESPACE ?? file.NAMESPACE ?? "default",
  VERSION: process.env.CONTRACT_VERSION ?? file.VERSION ?? "1.2",
  PORT: Number(process.env.PORT ?? file.PORT ?? 4001),
  MOVIE_RATINGS_ADDRESS:
    process.env.MOVIE_RATINGS_ADDRESS ?? file.MOVIE_RATINGS_ADDRESS ?? "",
  USER_REGISTRY_ADDRESS:
    process.env.USER_REGISTRY_ADDRESS ?? file.USER_REGISTRY_ADDRESS ?? "",
  ADMIN_ADDRESS: process.env.ADMIN_ADDRESS ?? file.ADMIN_ADDRESS ?? "",
  ADMIN_PASSWORD:
    process.env.ADMIN_PASSWORD ?? file.ADMIN_PASSWORD ?? "blockbuster",
};
