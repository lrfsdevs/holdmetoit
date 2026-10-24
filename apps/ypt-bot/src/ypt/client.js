import { logger } from "../lib/logger.js";

const BASE_URL = "https://pi.tgclab.com";

const DEFAULT_HEADERS = {
   "Content-Type": "application/json",
   "Accept-Encoding": "gzip",
   "User-Agent": "Dart/3.11 (dart:io)",
};

/**
 * Format milliseconds into HH:MM:SS string
 */
export function formatMs(ms = 0) {
   if (!ms || ms < 0) return "00:00:00";
   const totalSeconds = Math.floor(ms / 1000);
   const hours = Math.floor(totalSeconds / 3600);
   const minutes = Math.floor((totalSeconds % 3600) / 60);
   const seconds = totalSeconds % 60;
   return [hours, minutes, seconds]
      .map((v) => String(v).padStart(2, "0"))
      .join(":");
}

/**
 * Authenticate with YPT using email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, user: object }>}
 */
export async function signIn(email, password) {
   const url = `${BASE_URL}/user/sign-in-jwt`;
   const response = await fetch(url, {
      method: "POST",
      headers: {
         ...DEFAULT_HEADERS,
         Authorization: "JWT",
      },
      body: JSON.stringify({
         email,
         password,
         loginProvider: "Email",
         new: true,
         getx: true,
         language: "en",
      }),
   });

   const data = await response.json();

   if (!response.ok || data.s !== true) {
      const code = data.c || `HTTP_${response.status}`;
      const errorMap = {
         112: "Incorrect password. Please verify your credentials.",
         113: "Email not registered on Yeolpumta.",
         114: "Account suspended or inactive.",
      };
      throw new Error(
         errorMap[code] ||
            data.m ||
            data.message ||
            `Login failed (Code: ${code})`
      );
   }

   const token = data.jwt;
   if (!token) {
      throw new Error(
         "Login succeeded but no JWT token was returned by the server."
      );
   }

   return {
      token,
      user: {
         id: data.id || data.ud,
         nickname: data.n || data.name || "Unknown",
         email: data.e || email,
         today: data.today,
      },
   };
}

/**
 * Perform splash session handshake
 * @param {string} token
 */
export async function splashLogin(token) {
   const url = `${BASE_URL}/user/v2/splash-login`;
   const response = await fetch(url, {
      method: "POST",
      headers: {
         ...DEFAULT_HEADERS,
         Authorization: `JWT ${token}`,
      },
      body: JSON.stringify({
         version: 810046,
         pushToken: "",
         timezone: "UTC",
         deviceType: "WIN",
         osVersion: 10,
         deviceModel: "Desktop",
         pv: 2,
         language: "en",
      }),
   });

   const data = await response.json();
   if (!response.ok || data.s !== true) {
      throw new Error("Splash session handshake failed.");
   }
   return data;
}

/**
 * Fetch real-time study status and study times of all members in a group
 *
 * @param {string} token
 * @param {number} groupId
 */
export async function getGroupMembers(token, groupId) {
   // Calling /logs/group/members/v2?groupID=${groupId} without countryID
   // because countryID causes YPT's backend to throw a 500 error.
   const url = `${BASE_URL}/logs/group/members/v2?groupID=${groupId}`;
   const response = await fetch(url, {
      method: "GET",
      headers: {
         ...DEFAULT_HEADERS,
         Authorization: `JWT ${token}`,
      },
   });

   const contentType = response.headers.get("content-type") || "";
   if (!response.ok) {
      const text = await response.text();
      throw new Error(
         `YPT server returned HTTP ${response.status}: ${text.slice(0, 120)}`
      );
   }

   if (!contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(
         `Expected JSON but received ${contentType}: ${text.slice(0, 120)}`
      );
   }

   const data = await response.json();
   if (data.s !== true) {
      throw new Error(
         `YPT API error for group ID ${groupId}: ${data.m || data.message || "Unknown error"}`
      );
   }

   const rawMembers = Array.isArray(data.ms) ? data.ms : [];
   const now = Date.now();

   const members = rawMembers.map((m) => {
      const dl = m.dl || {};
      const recordedStudyMs = Number(dl.sm ?? m.studyMs ?? 0);
      const isStudying = Boolean(dl.is ?? m.isStudying ?? false);
      const isPaused = Boolean(dl.ia ?? dl.ip ?? m.isPaused ?? false);

      // Parse start time (can be epoch ms in dl.ss or ISO string in dl.st)
      let sessionStartMs = null;
      if (dl.ss) {
         sessionStartMs = Number(dl.ss);
      } else if (dl.st && isStudying) {
         const parsed = Date.parse(dl.st);
         if (!isNaN(parsed)) sessionStartMs = parsed;
      }

      // Real-time calculation: If currently studying, add elapsed time since session started
      const sessionElapsedMs =
         isStudying && sessionStartMs && now > sessionStartMs
            ? now - sessionStartMs
            : 0;

      let liveStudyMs = recordedStudyMs;
      if (sessionElapsedMs > 0) {
         liveStudyMs = recordedStudyMs + sessionElapsedMs;
      }

      const studyDate = dl.dt || dl.dd || null;
      const lastActiveDate = dl.dd || null;

      return {
         userId: m.ud || m.userId || m.id,
         nickname: (m.n || m.name || m.nickname || "Unknown").trim(),
         category: m.ct || m.category || "",
         isStudying,
         isPaused,
         currentSubject: isStudying
            ? dl.sn || dl.sb || dl.tt || "Studying"
            : null,
         studyDate,
         lastActiveDate,
         todayStudyMs: recordedStudyMs,
         todayStudyTime: formatMs(recordedStudyMs),
         liveStudyMs,
         liveStudyTime: formatMs(liveStudyMs),
         sessionStartMs,
         sessionElapsedMs,
         studiconId: m.sd || m.si || -1,
         hasCustomAvatar: Boolean(m.hasCustomAvatar),
         avatarUrl: m.hasCustomAvatar
            ? `https://alicdn.tgclab.com/user/profile/${m.ud || m.userId || m.id}.jpg`
            : `https://alicdn.tgclab.com/sc.v2/${m.sd || m.si || -1}/normal1.png`,
      };
   });

   // Sort descending by study time
   members.sort((a, b) => b.liveStudyMs - a.liveStudyMs);

   return members;
}

/**
 * Fetch and aggregate members from multiple groups/channels, removing duplicates.
 * @param {string} token
 * @param {Array<object>} groups
 * @returns {Promise<{ members: Array<object>, totalRawCount: number, duplicatesRemoved: number, successfulGroups: number }>}
 */
export async function getAggregatedMembers(token, groups) {
   if (!groups || groups.length === 0) {
      return {
         members: [],
         totalRawCount: 0,
         duplicatesRemoved: 0,
         successfulGroups: 0,
      };
   }

   const results = await Promise.allSettled(
      groups.map(async (group) => {
         const members = await getGroupMembers(token, group.id);
         return { group, members };
      })
   );

   const memberMap = new Map();
   let totalRawCount = 0;
   let successfulGroups = 0;

   for (let i = 0; i < results.length; i++) {
      const res = results[i];
      if (res.status === "rejected") {
         logger.warn("Failed to fetch group members.", {
            groupId: groups[i]?.id,
            reason: res.reason?.message || String(res.reason),
         });
         continue;
      }

      successfulGroups++;
      const { group, members } = res.value;
      totalRawCount += members.length;

      for (const member of members) {
         if (!memberMap.has(member.userId)) {
            memberMap.set(member.userId, {
               ...member,
               groupNames: [group.name],
               groupIds: [group.id],
            });
         } else {
            const existing = memberMap.get(member.userId);
            if (!existing.groupIds.includes(group.id)) {
               existing.groupIds.push(group.id);
               existing.groupNames.push(group.name);
            }

            // Take highest study time
            if (member.liveStudyMs > existing.liveStudyMs) {
               existing.liveStudyMs = member.liveStudyMs;
               existing.liveStudyTime = member.liveStudyTime;
            }
            if (member.todayStudyMs > existing.todayStudyMs) {
               existing.todayStudyMs = member.todayStudyMs;
               existing.todayStudyTime = member.todayStudyTime;
               if (member.studyDate) existing.studyDate = member.studyDate;
            } else if (!existing.studyDate && member.studyDate) {
               existing.studyDate = member.studyDate;
            }
            if (!existing.lastActiveDate && member.lastActiveDate) {
               existing.lastActiveDate = member.lastActiveDate;
            }

            // Propagate session telemetry (highest session elapsed wins)
            if (
               (member.sessionElapsedMs || 0) > (existing.sessionElapsedMs || 0)
            ) {
               existing.sessionElapsedMs = member.sessionElapsedMs;
               existing.sessionStartMs = member.sessionStartMs;
            }

            // Active studying takes priority
            if (member.isStudying && !existing.isStudying) {
               existing.isStudying = true;
               existing.isPaused = member.isPaused;
               existing.currentSubject = member.currentSubject;
            } else if (member.isStudying && existing.isStudying) {
               // If both studying, prioritize unpaused state
               if (existing.isPaused && !member.isPaused) {
                  existing.isPaused = false;
                  existing.currentSubject =
                     member.currentSubject || existing.currentSubject;
               }
            }

            // Enrich missing metadata
            if (!existing.category && member.category) {
               existing.category = member.category;
            }
            if (member.hasCustomAvatar && !existing.hasCustomAvatar) {
               existing.hasCustomAvatar = true;
               existing.avatarUrl = member.avatarUrl;
            }
         }
      }
   }

   const consolidatedMembers = Array.from(memberMap.values());
   // Sort descending by liveStudyMs
   consolidatedMembers.sort((a, b) => b.liveStudyMs - a.liveStudyMs);

   return {
      members: consolidatedMembers,
      totalRawCount,
      duplicatesRemoved: totalRawCount - consolidatedMembers.length,
      successfulGroups,
   };
}
