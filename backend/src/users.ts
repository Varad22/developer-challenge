import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";

export interface StoredUser {
  username: string;
  passwordHash: string;
  salt: string;
  address: string;
  createdAt: string;
}

const dataDir = path.join(__dirname, "..", "data");
const usersPath = path.join(dataDir, "users.json");

function ensureDataDir(): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadUsers(): StoredUser[] {
  ensureDataDir();
  if (!fs.existsSync(usersPath)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(usersPath, "utf8")) as StoredUser[];
}

function saveUsers(users: StoredUser[]): void {
  ensureDataDir();
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2) + "\n");
}

export function validateUsername(username: string): string | null {
  if (username.length < 3 || username.length > 32) {
    return "Username must be 3-32 characters";
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
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

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

export function findUser(username: string): StoredUser | undefined {
  const normalized = username.toLowerCase();
  return loadUsers().find((user) => user.username === normalized);
}

export function countUsers(): number {
  return loadUsers().length;
}

export function verifyPassword(password: string, user: StoredUser): boolean {
  const hash = hashPassword(password, user.salt);
  const left = Buffer.from(hash, "hex");
  const right = Buffer.from(user.passwordHash, "hex");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function createUser(
  username: string,
  password: string,
  address: string
): StoredUser {
  const normalized = username.toLowerCase();
  const users = loadUsers();

  if (users.some((user) => user.username === normalized)) {
    throw new Error("Username is already taken");
  }

  const salt = randomBytes(16).toString("hex");
  const user: StoredUser = {
    username: normalized,
    passwordHash: hashPassword(password, salt),
    salt,
    address,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  saveUsers(users);
  return user;
}

export function updateUserAddress(username: string, address: string): StoredUser {
  const normalized = username.toLowerCase();
  const users = loadUsers();
  const index = users.findIndex((user) => user.username === normalized);

  if (index === -1) {
    throw new Error(`User '${username}' not found`);
  }

  users[index] = { ...users[index], address };
  saveUsers(users);
  return users[index];
}
