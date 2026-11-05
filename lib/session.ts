import "server-only";

import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "e_performance_session";

export type SessionPayload = {
  employeeId: string;
  credentialsRow: number;
  mustChangePassword: boolean;
  skippedPasswordChange?: boolean;
};

function getSessionKey() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSessionKey());
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionKey(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.employeeId !== "string" ||
      typeof payload.credentialsRow !== "number" ||
      typeof payload.mustChangePassword !== "boolean" ||
      (payload.skippedPasswordChange !== undefined &&
        typeof payload.skippedPasswordChange !== "boolean")
    ) {
      return null;
    }

    return {
      employeeId: payload.employeeId,
      credentialsRow: payload.credentialsRow,
      mustChangePassword: payload.mustChangePassword,
      skippedPasswordChange: payload.skippedPasswordChange,
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 8,
};
