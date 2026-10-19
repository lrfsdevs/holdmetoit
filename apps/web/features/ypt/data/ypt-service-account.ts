import { YptJs, type GroupMember, type UnifiedMember } from "ypt-js";
import { createLogger, logEvents } from "@/core/observability/logger";
import {
   getYptAllJoinedMembers,
   getYptGroupMembers,
} from "./ypt-client.service";

const logger = createLogger("ypt.service-account");

const ROSTER_TTL_MS = 60_000;

export interface YptRosterMember {
   yptUserId: string;
   nickname: string;
   avatarUrl: string | null;
   todayStudySeconds: number;
   isStudying: boolean;
   currentSubject: string | null;
   studyDate: string | null;
   groupIds: string[];
}

let cachedClient: YptJs | null = null;
let inflightClient: Promise<YptJs> | null = null;

let rosterCache: { data: YptRosterMember[]; at: number } | null = null;
let inflightRoster: Promise<YptRosterMember[]> | null = null;

function getServiceCredentials(): { email: string; password: string } {
   const email = process.env.YPT_EMAIL?.trim();
   const password = process.env.YPT_PASSWORD?.trim();

   if (!email || !password) {
      throw new Error(
         "YPT service account is not configured. Set YPT_EMAIL and YPT_PASSWORD."
      );
   }

   return { email, password };
}

export function getConfiguredYptGroupIds(): string[] {
   return (process.env.YPT_GROUP_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
}

async function buildServiceClient(): Promise<YptJs> {
   const credentials = getServiceCredentials();
   const client = new YptJs({ credentials });

   // Authenticate eagerly so misconfigured or suspended accounts fail here
   // rather than on the first roster request.
   await client.auth.signIn(credentials);

   return client;
}

/**
 * Returns a cached, authenticated ypt-js client for the shared service account.
 * The in-memory cache is per server instance; a cold start re-authenticates.
 */
export async function getYptServiceClient(): Promise<YptJs> {
   if (cachedClient) return cachedClient;
   if (inflightClient) return inflightClient;

   inflightClient = buildServiceClient()
      .then((client) => {
         cachedClient = client;
         return client;
      })
      .finally(() => {
         inflightClient = null;
      });

   return inflightClient;
}

export function resetYptServiceClient(): void {
   cachedClient = null;
}

export function resetYptServiceRoster(): void {
   rosterCache = null;
}

function normalizeMember(
   member: GroupMember | UnifiedMember,
   groupIds: string[]
): YptRosterMember {
   const memberGroupIds =
      "groupIds" in member ? member.groupIds.map((id) => String(id)) : groupIds;

   return {
      yptUserId: String(member.userId),
      nickname: member.nickname,
      avatarUrl: member.avatarUrl ?? null,
      todayStudySeconds: Math.max(0, Math.floor(member.todayStudyMs / 1000)),
      isStudying: member.isStudying,
      currentSubject: member.currentSubject,
      studyDate: member.studyDate,
      groupIds: Array.from(new Set([...memberGroupIds, ...groupIds])),
   };
}

function mergeMembers(
   map: Map<string, YptRosterMember>,
   member: YptRosterMember
): void {
   const existing = map.get(member.yptUserId);

   if (!existing) {
      map.set(member.yptUserId, member);
      return;
   }

   map.set(member.yptUserId, {
      ...existing,
      groupIds: Array.from(new Set([...existing.groupIds, ...member.groupIds])),
      todayStudySeconds: Math.max(
         existing.todayStudySeconds,
         member.todayStudySeconds
      ),
      isStudying: existing.isStudying || member.isStudying,
      currentSubject: existing.currentSubject ?? member.currentSubject,
      studyDate: existing.studyDate ?? member.studyDate,
      avatarUrl: existing.avatarUrl ?? member.avatarUrl,
   });
}

async function loadRoster(): Promise<YptRosterMember[]> {
   const client = await getYptServiceClient();
   const configuredGroupIds = getConfiguredYptGroupIds();

   if (configuredGroupIds.length > 0) {
      const results = await Promise.allSettled(
         configuredGroupIds.map((groupId) =>
            getYptGroupMembers(client, groupId)
         )
      );

      const merged = new Map<string, YptRosterMember>();
      let failures = 0;

      results.forEach((result, index) => {
         if (result.status === "rejected") {
            failures += 1;
            logger.warn(logEvents.appError, {
               context: {
                  action: "getYptServiceRoster",
                  groupId: configuredGroupIds[index],
                  reason: "Failed to fetch group members",
               },
            });
            return;
         }

         for (const member of result.value) {
            mergeMembers(
               merged,
               normalizeMember(member, [configuredGroupIds[index]])
            );
         }
      });

      if (merged.size === 0 && failures === results.length) {
         throw new Error(
            "Unable to load any YPT group members from the configured groups."
         );
      }

      return Array.from(merged.values());
   }

   const members = await getYptAllJoinedMembers(client);
   return members.map((member) => normalizeMember(member, []));
}

/**
 * Returns every member visible to the service account, scoped to
 * YPT_GROUP_IDS when configured. Cached briefly with in-flight de-duplication.
 */
export async function getYptServiceRoster(options?: {
   fresh?: boolean;
}): Promise<YptRosterMember[]> {
   const now = Date.now();

   if (!options?.fresh && rosterCache && now - rosterCache.at < ROSTER_TTL_MS) {
      return rosterCache.data;
   }

   if (!options?.fresh && inflightRoster) {
      return inflightRoster;
   }

   inflightRoster = loadRoster()
      .then((data) => {
         rosterCache = { data, at: Date.now() };
         return data;
      })
      .catch((error) => {
         // Drop the cached client so the next call re-authenticates.
         resetYptServiceClient();
         throw error;
      })
      .finally(() => {
         inflightRoster = null;
      });

   return inflightRoster;
}

/**
 * Looks up a single roster entry by numeric YPT id (freshly fetched).
 */
export async function findYptServiceMember(
   yptId: string
): Promise<YptRosterMember | null> {
   const roster = await getYptServiceRoster({ fresh: true });
   const target = String(yptId);
   return roster.find((member) => member.yptUserId === target) ?? null;
}
