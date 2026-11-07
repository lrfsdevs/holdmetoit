import type { User, UserRole } from "@prisma/client";

import { prisma } from "@/core/db";
import {
   mapDiscordProfileToUserFields,
   type DiscordProfileInput,
} from "@/features/auth/data/discord-profile.mapper";

import {
   isDiscordAdmin,
   isDiscordDev,
} from "@/features/auth/data/discord-guild.service";

import {
   formatUsername,
   generateSuffixedUsername,
   sanitizeDiscordUsername,
   validateUsername,
} from "@/features/auth/domain/username";

export class UsernameTakenError extends Error {
   constructor(username: string) {
      super(`Username "${username}" is already taken.`);
      this.name = "UsernameTakenError";
   }
}

export class InvalidUsernameError extends Error {
   constructor(message: string) {
      super(message);
      this.name = "InvalidUsernameError";
   }
}

export async function findUserById(userId: string): Promise<User | null> {
   return prisma.user.findUnique({ where: { id: userId } });
}

export async function findUserByDiscordId(
   discordId: string
): Promise<User | null> {
   return prisma.user.findUnique({ where: { discordId } });
}

/**
 * Finds a user by their platform username using exact case-normalized comparison.
 * Compares LOWER("username") = ${canonical} so underscores and percent signs
 * are treated literally rather than as pattern-matching wildcards.
 */
export async function findUserByUsername(
   username: string
): Promise<User | null> {
   const canonical = username.trim().toLowerCase();
   const rows = await prisma.$queryRaw<User[]>`
      SELECT * FROM "User"
      WHERE LOWER("username") = ${canonical}
      LIMIT 1
   `;
   return rows[0] ?? null;
}

/**
 * Checks whether a candidate username is available, optionally excluding a specific user ID.
 * Compares LOWER("username") = ${canonical} literally to avoid wildcard false positives.
 */
export async function isUsernameAvailable(
   candidate: string,
   excludeUserId?: string
): Promise<boolean> {
   const canonical = candidate.trim().toLowerCase();
   if (excludeUserId) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
         SELECT "id" FROM "User"
         WHERE LOWER("username") = ${canonical}
           AND "id" != ${excludeUserId}
         LIMIT 1
      `;
      return rows.length === 0;
   }
   const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "User"
      WHERE LOWER("username") = ${canonical}
      LIMIT 1
   `;
   return rows.length === 0;
}

/**
 * Provisions a unique platform username candidate for a new user,
 * resolving collisions by appending numeric suffixes.
 */
export async function provisionInitialUsername(
   userId: string,
   preferredCandidate: string
): Promise<string> {
   const sanitizedBase = sanitizeDiscordUsername(preferredCandidate);
   let candidate = sanitizedBase;
   let attempt = 1;

   while (!(await isUsernameAvailable(candidate, userId))) {
      candidate = generateSuffixedUsername(sanitizedBase, attempt);
      attempt++;
      if (attempt > 100) {
         candidate = `scholar_${Date.now().toString().slice(-6)}`;
         break;
      }
   }

   return candidate;
}

/**
 * Updates a user's platform username, preserving casing and updating usernameChangedAt.
 */
export async function updateUsername(
   userId: string,
   newUsername: string
): Promise<User> {
   const validation = validateUsername(newUsername);
   if (!validation.ok) {
      throw new InvalidUsernameError(validation.message);
   }

   const available = await isUsernameAvailable(validation.canonical, userId);
   if (!available) {
      throw new UsernameTakenError(validation.formatted);
   }

   try {
      return await prisma.user.update({
         where: { id: userId },
         data: {
            username: validation.formatted,
            usernameChangedAt: new Date(),
         },
      });
   } catch (error: any) {
      // Catch Prisma P2002 Unique Constraint Violation in case of concurrent writes
      if (error?.code === "P2002") {
         throw new UsernameTakenError(validation.formatted);
      }
      throw error;
   }
}

/**
 * Synchronizes user data from Discord OAuth.
 * Non-destructive: preserves existing platform username if already assigned.
 */
export async function syncUserFromDiscordProfile(
   userId: string,
   profile: DiscordProfileInput
): Promise<User> {
   const fields = mapDiscordProfileToUserFields(profile);

   const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
   });

   // Only provision initial platform username if the user currently lacks one
   let assignedUsername = existingUser?.username ?? null;
   if (!assignedUsername && fields.username) {
      assignedUsername = await provisionInitialUsername(
         userId,
         fields.username
      );
   }

   return prisma.user.update({
      where: { id: userId },
      data: {
         discordId: fields.discordId,
         ...(assignedUsername ? { username: assignedUsername } : {}),
         displayName: fields.displayName,
         image: fields.image,
         name: fields.displayName,
      },
   });
}

export async function syncUserRoleFromDiscord(
   userId: string,
   discordId: string
): Promise<UserRole> {
   let role: UserRole = "PARTICIPANT";

   if (isDiscordDev(discordId)) {
      role = "DEV";
   } else {
      const shouldBeAdmin = await isDiscordAdmin(discordId);
      role = shouldBeAdmin ? "ADMIN" : "PARTICIPANT";
   }

   const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
   });

   return updated.role;
}

export async function listAllUsersForAdmin() {
   return prisma.user.findMany({
      select: {
         id: true,
         displayName: true,
         username: true,
         image: true,
         discordId: true,
         role: true,
      },
      orderBy: { createdAt: "desc" },
   });
}
