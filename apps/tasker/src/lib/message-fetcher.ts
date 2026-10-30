import * as chrono from "chrono-node";
import { SnowflakeUtil } from "discord.js";

export interface SanitizedMessage {
   id: string;
   author: string;
   timestamp: string;
   content: string;
}

export interface FetchOptions {
   timeframe?: string;
   messageId?: string;
   limit?: number;
}

/**
 * Parses a natural language timeframe into a past Date, and converts it to a
 * Discord Snowflake. Uses chrono-node with forwardDate: false.
 */
export function parseTimeframeToSnowflake(
   timeframe: string,
   referenceDate: Date = new Date()
): { date: Date; snowflake: string } | null {
   if (!timeframe || !timeframe.trim()) return null;

   const parsedDate = chrono.parseDate(timeframe.trim(), referenceDate, {
      forwardDate: false,
   });
   if (!parsedDate) return null;

   const discordEpoch = new Date("2015-01-01T00:00:00.000Z");
   const validDate = parsedDate < discordEpoch ? discordEpoch : parsedDate;

   const snowflake = SnowflakeUtil.generate({
      timestamp: validDate,
   }).toString();
   return { date: validDate, snowflake };
}

/**
 * Only user-created messages (type 0 Default / 19 Reply) with content or
 * attachments are eligible for summarization.
 */
export function isEligibleMessage(message: any): boolean {
   if (!message) return false;
   if (message.author?.bot) return false;
   if (message.type !== 0 && message.type !== 19) return false;

   const hasText = Boolean(
      message.cleanContent && message.cleanContent.trim().length > 0
   );
   const hasAttachments = Boolean(
      message.attachments &&
      (message.attachments.size > 0 || message.attachments.length > 0)
   );
   if (!hasText && !hasAttachments) return false;

   return true;
}

export async function sanitizeMessage(message: any): Promise<SanitizedMessage> {
   const author =
      message.member?.displayName || message.author?.username || "Unknown User";
   const timestamp = message.createdAt
      ? new Date(message.createdAt).toISOString()
      : new Date().toISOString();
   let content = message.cleanContent?.trim() || "";

   if (message.attachments) {
      const attachments = message.attachments.values
         ? Array.from(message.attachments.values())
         : message.attachments;
      for (const att of attachments as any[]) {
         const isTxt =
            att.name?.toLowerCase().endsWith(".txt") ||
            att.contentType?.startsWith("text/plain");
         if (isTxt && att.url) {
            try {
               const res = await fetch(att.url);
               if (res.ok) {
                  const rawText = await res.text();
                  const safeText =
                     rawText.length > 20000
                        ? `${rawText.slice(0, 20000)}... [truncated]`
                        : rawText;
                  content += `\n[Attachment: ${att.name || "document.txt"}]\n${safeText}`;
               }
            } catch (err) {
               console.warn(
                  `[yapperize] Failed to fetch .txt attachment ${att.name}:`,
                  err
               );
            }
         }
      }
   }

   return {
      id: message.id,
      author,
      timestamp,
      content: content.trim(),
   };
}

/**
 * Fetches batches of messages from a channel up to the specified limit, using
 * either `after` (temporal snowflake / message id) or `before` (from present).
 */
export async function fetchAndSanitizeMessages(
   channel: any,
   options: FetchOptions = {}
): Promise<{
   messages: SanitizedMessage[];
   totalScanned: number;
   boundaryDate?: Date;
}> {
   const maxLimit = Math.min(Math.max(options.limit ?? 100, 1), 500);
   let afterSnowflake: string | undefined;
   let boundaryDate: Date | undefined;

   if (options.timeframe) {
      const temporal = parseTimeframeToSnowflake(options.timeframe);
      if (!temporal) {
         throw new Error(
            `Could not parse timeframe: "${options.timeframe}". Try "2 hours ago", "yesterday", or "30 minutes ago".`
         );
      }
      afterSnowflake = temporal.snowflake;
      boundaryDate = temporal.date;
   } else if (options.messageId) {
      afterSnowflake = options.messageId.trim();
   }

   const rawMessages: any[] = [];
   let totalScanned = 0;

   if (afterSnowflake) {
      let cursor = afterSnowflake;
      while (rawMessages.length < maxLimit) {
         const fetchBatchSize = Math.min(100, maxLimit - rawMessages.length);
         const batch: any = await channel.messages.fetch({
            limit: fetchBatchSize,
            after: cursor,
         });

         if (!batch || batch.size === 0) break;
         totalScanned += batch.size;

         const sortedBatch = Array.from(batch.values() as any[]).sort(
            (a: any, b: any) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1)
         );

         for (const msg of sortedBatch) {
            if (isEligibleMessage(msg)) {
               rawMessages.push(msg);
               if (rawMessages.length >= maxLimit) break;
            }
         }

         const highestMsg = sortedBatch[sortedBatch.length - 1];
         if (!highestMsg || highestMsg.id === cursor) break;
         cursor = highestMsg.id;

         if (batch.size < fetchBatchSize) break;
      }
   } else {
      let cursor: string | undefined = undefined;
      while (rawMessages.length < maxLimit) {
         const fetchBatchSize = Math.min(100, maxLimit - rawMessages.length);
         const fetchOptions: any = { limit: fetchBatchSize };
         if (cursor) fetchOptions.before = cursor;

         const batch: any = await channel.messages.fetch(fetchOptions);
         if (!batch || batch.size === 0) break;
         totalScanned += batch.size;

         const sortedBatch = Array.from(batch.values() as any[]).sort(
            (a: any, b: any) => (BigInt(a.id) > BigInt(b.id) ? -1 : 1)
         );

         for (const msg of sortedBatch) {
            if (isEligibleMessage(msg)) {
               rawMessages.push(msg);
               if (rawMessages.length >= maxLimit) break;
            }
         }

         const lowestMsg = sortedBatch[sortedBatch.length - 1];
         if (!lowestMsg || lowestMsg.id === cursor) break;
         cursor = lowestMsg.id;

         if (batch.size < fetchBatchSize) break;
      }

      rawMessages.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
   }

   const sanitized = await Promise.all(
      rawMessages.map((msg) => sanitizeMessage(msg))
   );

   const validMessages = sanitized.filter((m) => m.content.length > 0);

   return {
      messages: validMessages,
      totalScanned,
      boundaryDate,
   };
}
