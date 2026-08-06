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

async function listContractInterfaces(): Promise<Array<{ id: string; name: string }>> {
  const url = `${config.HOST}/api/v1/namespaces/${config.NAMESPACE}/contracts/interfaces`;
  const res = await fetch(url);
  if (!res.ok) {
    return [];
  }
  const body = (await res.json()) as unknown;
  return body as Array<{ id: string; name: string }>;
}

async function ensureContractInterface(firefly: FireFly): Promise<string> {
  const name = ffiName();

  try {
    const generatedFFI = await firefly.generateContractInterface({
      name,
      namespace: config.NAMESPACE,
      version: "1.0",
      description: "Deployed MovieRatings contract",
      input: {
        abi: movieRatings.abi,
      },
    });

    if (generatedFFI) {
      const created = await firefly.createContractInterface(generatedFFI, {
        confirm: true,
      });
      if (created?.id) {
        console.log(`Registered contract interface '${name}'.`);
        return created.id;
      }
    }
  } catch (error) {
    if (!isConflict(error)) {
      throw error;
    }
    console.log(`Contract interface '${name}' already exists in FireFly.`);
  }

  const interfaces = await listContractInterfaces();
  const existing = interfaces.find((entry) => entry.name === name);
  if (!existing?.id) {
    throw new Error(
      `Contract interface '${name}' is missing in FireFly. Restart the backend after bootstrap.`
    );
  }

  return existing.id;
}

async function ensureContractApi(firefly: FireFly, interfaceId: string): Promise<void> {
  const api = apiName();

  try {
    await firefly.createContractAPI(
      {
        interface: {
          id: interfaceId,
        },
        location: {
          address: config.MOVIE_RATINGS_ADDRESS,
        },
        name: api,
      },
      { confirm: true }
    );
    console.log(`Registered contract API '${api}' at ${config.MOVIE_RATINGS_ADDRESS}.`);
  } catch (error) {
    if (isConflict(error)) {
      console.log(`Contract API '${api}' already exists in FireFly.`);
      return;
    }
    throw error;
  }
}

export async function registerContract(firefly: FireFly): Promise<void> {
  const api = apiName();
  const interfaceId = await ensureContractInterface(firefly);
  await ensureContractApi(firefly, interfaceId);

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

function isFireflyNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("FF10109") || message.includes("Not found");
}

export function friendlyFireflyError(error: unknown): string {
  if (isFireflyNotFound(error)) {
    return (
      "FireFly contract API is not registered. This usually happens after " +
      "'firefly reset' or 'npm run bootstrap' while the backend was still running. " +
      "Restart the backend: cd backend && npm start"
    );
  }

  return error instanceof Error ? error.message : "Unknown error";
}
