import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";

async function main() {
  const configPath = path.join(__dirname, "..", "..", "backend", "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!config.ADMIN_ADDRESS) {
    throw new Error(
      "ADMIN_ADDRESS missing from backend/config.json - run scripts/setup-admin.mjs first"
    );
  }

  const UserRegistry = await ethers.getContractFactory("UserRegistry");
  const userRegistry = await UserRegistry.deploy(config.ADMIN_ADDRESS);
  await userRegistry.deployed();
  console.log(`UserRegistry deployed at: ${userRegistry.address}`);

  const MovieRatings = await ethers.getContractFactory("MovieRatings");
  const movieRatings = await MovieRatings.deploy(config.ADMIN_ADDRESS);
  await movieRatings.deployed();
  console.log(`MovieRatings deployed at: ${movieRatings.address}`);

  config.USER_REGISTRY_ADDRESS = userRegistry.address;
  config.MOVIE_RATINGS_ADDRESS = movieRatings.address;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log("backend/config.json updated with contract addresses");

  const stack = process.env.FF_STACK || "dev-challenge";
  const deployment = {
    network: "firefly",
    stack,
    contracts: {
      UserRegistry: userRegistry.address,
      MovieRatings: movieRatings.address,
    },
    admin: config.ADMIN_ADDRESS,
    version: config.VERSION || "1.2",
    deployedAt: new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "..", "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const deploymentPath = path.join(deploymentsDir, `${stack}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2) + "\n");
  console.log(`Deployment artifact written to ${deploymentPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
