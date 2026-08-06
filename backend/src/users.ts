import { createHash, randomBytes, timingSafeEqual } from "crypto";
import FireFly from "@hyperledger/firefly-sdk";
import { config } from "./config";
import { userRegistryApiName } from "./user-registry-setup";

export interface ChainUser {
  username: string;
  address: string;
  passwordHash: string;
  salt: string;
}

function normalizeUsername(username: string): string {
  return username.toLowerCase();
}

export function validateUsername(username: string): string | null {
  const normalized = normalizeUsername(username);
  if (normalized.length < 3 || normalized.length > 32) {
    return "Username must be 3-32 characters";
  }

  if (!/^[a-z0-9_]+$/.test(normalized)) {
    return "Username may only contain letters, numbers, and underscores";
  }

  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) {
    return "Password must be at least 6 characters";
  }

  return null;
}

function hashPassword(password: string, saltHex: string): Buffer {
  const salt = Buffer.from(saltHex.replace(/^0x/, ""), "hex");
  return createHash("sha256").update(Buffer.concat([salt, Buffer.from(password)])).digest();
}

function randomSaltHex(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

function toHex(value: string): string {
  return value.startsWith("0x") ? value : `0x${value}`;
}

export function verifyPassword(password: string, user: ChainUser): boolean {
  const hash = hashPassword(password, user.salt);
  const expected = Buffer.from(user.passwordHash.replace(/^0x/, ""), "hex");

  if (hash.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(hash, expected);
}

export async function findUser(
  firefly: FireFly,
  username: string
): Promise<ChainUser | undefined> {
  try {
    const res: any = await firefly.queryContractAPI(
      userRegistryApiName(),
      "getAccount",
      { input: { username: normalizeUsername(username) } }
    );

    return {
      username: normalizeUsername(username),
      address: res.wallet,
      passwordHash: toHex(res.passwordHash),
      salt: toHex(res.salt),
    };
  } catch {
    return undefined;
  }
}

export async function countUsers(firefly: FireFly): Promise<number> {
  try {
    const res: any = await firefly.queryContractAPI(
      userRegistryApiName(),
      "userCount",
      { input: {} }
    );
    return Number(res.output ?? res);
  } catch {
    return 0;
  }
}

export async function registerUser(
  firefly: FireFly,
  username: string,
  password: string,
  walletAddress: string
): Promise<ChainUser> {
  const normalized = normalizeUsername(username);
  const salt = randomSaltHex();
  const passwordHash = `0x${hashPassword(password, salt).toString("hex")}`;

  await firefly.invokeContractAPI(
    userRegistryApiName(),
    "register",
    {
      input: {
        username: normalized,
        passwordHash,
        salt,
      },
      key: walletAddress,
    },
    { confirm: true }
  );

  return {
    username: normalized,
    address: walletAddress,
    passwordHash,
    salt,
  };
}

export async function updateUserWallet(
  firefly: FireFly,
  username: string,
  newWallet: string
): Promise<void> {
  await firefly.invokeContractAPI(
    userRegistryApiName(),
    "adminUpdateWallet",
    {
      input: {
        username: normalizeUsername(username),
        newWallet,
      },
      key: config.ADMIN_ADDRESS,
    },
    { confirm: true }
  );
}
