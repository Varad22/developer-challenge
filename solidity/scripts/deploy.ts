import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";

async function main() {
  const configPath = path.join(__dirname, "..", "..", "backend", "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!config.ADMIN_ADDRESS) {
    throw new Error("ADMIN_ADDRESS missing from backend/config.json - run scripts/setup-raters.mjs first");
  }

  const MovieRatings = await ethers.getContractFactory("MovieRatings");
  const movieRatings = await MovieRatings.deploy(config.ADMIN_ADDRESS);
  await movieRatings.deployed();

  console.log(`MovieRatings deployed at: ${movieRatings.address}`);

  config.MOVIE_RATINGS_ADDRESS = movieRatings.address;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log("backend/config.json updated with the new address");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
