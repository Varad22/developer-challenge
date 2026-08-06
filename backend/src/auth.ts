import { randomUUID } from "crypto";

export type SessionKind = "admin" | "rater";

export interface Session {
  kind: SessionKind;
  rater?: string;
  address: string;
  expiresAt: number;
}

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const sessions = new Map<string, Session>();

export function createAdminSession(adminAddress: string): string {
  const token = randomUUID();
  sessions.set(token, {
    kind: "admin",
    address: adminAddress,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
  return token;
}

export function createRaterSession(rater: string, address: string): string {
  const token = randomUUID();
  sessions.set(token, {
    kind: "rater",
    rater,
    address,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
  return token;
}

export function getSession(token: string | undefined): Session | undefined {
  if (!token) {
    return undefined;
  }

  const session = sessions.get(token);
  if (!session) {
    return undefined;
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return undefined;
  }

  return session;
}

export function bearerToken(req: { headers: { authorization?: string } }): string | undefined {
  return req.headers.authorization?.replace(/^Bearer /, "");
}

export function isAdmin(session: Session | undefined): boolean {
  return session?.kind === "admin";
}

export function isRater(session: Session | undefined): boolean {
  return session?.kind === "rater";
}
