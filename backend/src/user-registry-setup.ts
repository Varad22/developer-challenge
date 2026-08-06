import FireFly from "@hyperledger/firefly-sdk";
import userRegistry from "../../solidity/artifacts/contracts/UserRegistry.sol/UserRegistry.json";
import { config } from "./config";

export function userRegistryFfiName(): string {
  return `userRegistryFFI-${config.VERSION}`;
}

export function userRegistryApiName(): string {
  return `userRegistryApi-${config.VERSION}`;
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
  const name = userRegistryFfiName();

  try {
    const generatedFFI = await firefly.generateContractInterface({
      name,
      namespace: config.NAMESPACE,
      version: "1.0",
      description: "Deployed UserRegistry contract",
      input: {
        abi: userRegistry.abi,
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
  const api = userRegistryApiName();

  try {
    await firefly.createContractAPI(
      {
        interface: {
          id: interfaceId,
        },
        location: {
          address: config.USER_REGISTRY_ADDRESS,
        },
        name: api,
      },
      { confirm: true }
    );
    console.log(
      `Registered contract API '${api}' at ${config.USER_REGISTRY_ADDRESS}.`
    );
  } catch (error) {
    if (isConflict(error)) {
      console.log(`Contract API '${api}' already exists in FireFly.`);
      return;
    }
    throw error;
  }
}

export async function registerUserRegistry(firefly: FireFly): Promise<void> {
  const interfaceId = await ensureContractInterface(firefly);
  await ensureContractApi(firefly, interfaceId);
}

export function validateUserRegistryConfig(): string[] {
  const issues: string[] = [];
  if (!config.USER_REGISTRY_ADDRESS) {
    issues.push("USER_REGISTRY_ADDRESS is not set");
  }
  return issues;
}
