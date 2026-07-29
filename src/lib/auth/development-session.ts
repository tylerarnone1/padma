import "server-only";

import type { AuthSession } from "@/lib/auth/auth";
import { database } from "@/lib/db/client";
import { developmentAccount } from "@/mock-data/development-account";

const fixtureTimestamp = new Date("2026-01-01T00:00:00.000Z");
const fixtureExpiry = new Date("2999-01-01T00:00:00.000Z");

export async function getDevelopmentSession(): Promise<AuthSession> {
  const user = await database.user.findUnique({
    where: { id: developmentAccount.id },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      email: true,
      emailVerified: true,
      name: true,
      image: true,
      twoFactorEnabled: true,
    },
  });

  if (!user) {
    throw new Error(
      "The development account is missing. Run `npm run db:seed` and restart the development server.",
    );
  }

  return {
    session: {
      id: "development-session",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp,
      userId: user.id,
      expiresAt: fixtureExpiry,
      token: "development-session-not-a-credential",
      ipAddress: null,
      userAgent: "Padma development authentication",
      mfaVerifiedAt: null,
    },
    user,
  };
}
