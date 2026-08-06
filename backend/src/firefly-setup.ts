import FireFly from "@hyperledger/firefly-sdk";
import movieRatings from "../../solidity/artifacts/contracts/MovieRatings.sol/MovieRatings.json";
import { config } from "./config";

export function ffiName(): string {
  return `movieRatingsFFI-${config.VERSION}`;
}

export function apiName(): string {
  return `movieRatingsApi-${config.VERSION}`;
}

function isConflict(error: unknown): boolean {
  const err = JSON.parse(JSON.stringify((error as { originalError?: unknown }).originalError));
  return err?.status === 409;
}

export async function registerContract(firefly: FireFly): Promise<void> {
  const name = ffiName();
  const api = apiName();

  await firefly
    .generateContractInterface({
      name,
      namespace: config.NAMESPACE,
      version: "1.0",
      description: "Deployed MovieRatings contract",
      input: {
        abi: movieRatings.abi,
      },
    })
    .then(async (generatedFFI) => {
      if (!generatedFFI) {
        return;
      }
      return await firefly.createContractInterface(generatedFFI, {
        confirm: true,
      });
    })
    .then(async (contractInterface) => {
      if (!contractInterface) {
        return;
      }
      return await firefly.createContractAPI(
        {
          interface: {
            id: contractInterface.id,
          },
          location: {
            address: config.MOVIE_RATINGS_ADDRESS,
          },
          name: api,
        },
        { confirm: true }
      );
    })
    .catch((error) => {
      if (isConflict(error)) {
        console.log(`'${name}' already exists in FireFly. Ignoring.`);
        return;
      }
      throw error;
    });

  for (const eventName of ["MovieAdded", "MovieRated"]) {
    await firefly
      .createContractAPIListener(api, eventName, {
        topic: eventName.toLowerCase(),
      })
      .catch((error) => {
        if (isConflict(error)) {
          console.log(
            `'${eventName}' event listener already exists in FireFly. Ignoring.`
          );
          return;
        }
        const err = JSON.parse(JSON.stringify((error as { originalError?: unknown }).originalError));
        console.log(`Error creating listener for '${eventName}' event: ${err.message}`);
      });
  }
}

export function validateConfig(): string[] {
  const issues: string[] = [];
  if (!config.MOVIE_RATINGS_ADDRESS) {
    issues.push("MOVIE_RATINGS_ADDRESS is not set");
  }
  if (!config.ADMIN_ADDRESS) {
    issues.push("ADMIN_ADDRESS is not set");
  }
  return issues;
}
