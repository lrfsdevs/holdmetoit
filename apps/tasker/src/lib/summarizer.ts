import { GoogleGenAI } from "@google/genai";
import { EmbedBuilder } from "discord.js";
import { z } from "zod";
import { env } from "../config/env.js";
import type { SanitizedMessage } from "./message-fetcher.js";

export const SummaryZodSchema = z.object({
   summary: z
      .string()
      .describe(
         "A concise, comprehensive overview of what was discussed in the channel chatter."
      ),
   conclusion: z
      .string()
      .describe(
         "Key conclusions, decisions reached, action items, or final outcomes."
      ),
   topics_covered: z
      .array(z.string())
      .describe("Distinct key topics, themes, or issues addressed."),
   flow_of_topics: z
      .array(z.string())
      .describe(
         "Chronological narrative progression of how the conversation transitioned from topic to topic."
      ),
});

export type SummaryResult = z.infer<typeof SummaryZodSchema>;

/**
 * JSON Schema handed to Gemini's `responseJsonSchema`. Written explicitly so the
 * bot's Gemini contract does not depend on the Zod schema representation.
 */
export function getSummaryJsonSchema() {
   return {
      type: "object",
      properties: {
         summary: {
            type: "string",
            description:
               "A concise, comprehensive overview of what was discussed in the channel chatter.",
         },
         conclusion: {
            type: "string",
            description:
               "Key conclusions, decisions reached, action items, or final outcomes.",
         },
         topics_covered: {
            type: "array",
            items: { type: "string" },
            description: "Distinct key topics, themes, or issues addressed.",
         },
         flow_of_topics: {
            type: "array",
            items: { type: "string" },
            description:
               "Chronological narrative progression of how the conversation transitioned from topic to topic.",
         },
      },
      required: ["summary", "conclusion", "topics_covered", "flow_of_topics"],
      additionalProperties: false,
   };
}

export const DEFAULT_MODEL_CHAIN = [
   "gemini-3.5-flash-lite",
   "gemini-3.6-flash",
   "gemini-3.5-flash",
] as const;

export function resolveModelChain(envModel?: string): string[] {
   const chain = [...DEFAULT_MODEL_CHAIN];
   const override = envModel?.trim();
   if (!override) return chain;
   return [override, ...chain.filter((m) => m !== override)];
}

export const DEFAULT_KEY_VARS = [
   "GEMINI_API_KEY",
   "GEMINI_API_KEY_2",
   "GEMINI_API_KEY_3",
] as const;

export type ApiKeySource = {
   GEMINI_API_KEY?: string;
   GEMINI_API_KEY_2?: string;
   GEMINI_API_KEY_3?: string;
};

/**
 * Resolves the ordered, de-duplicated list of configured Gemini API keys.
 * Accepts a source object for testability.
 */
export function resolveApiKeys(source: ApiKeySource = env): string[] {
   const keys = DEFAULT_KEY_VARS.map((v) => source[v]?.trim()).filter(
      (k): k is string => Boolean(k)
   );
   return [...new Set(keys)];
}

export function isHighDemandError(err: unknown): boolean {
   if (!err) return false;
   const status =
      (err as { status?: number }).status ?? (err as { code?: number }).code;
   if (status === 503) return true;
   const message = err instanceof Error ? err.message : String(err);
   return /"code"\s*:\s*503/.test(message) || /UNAVAILABLE/.test(message);
}

export function isRateLimitError(err: unknown): boolean {
   if (!err) return false;
   const status =
      (err as { status?: number }).status ?? (err as { code?: number }).code;
   if (status === 429) return true;
   const message = err instanceof Error ? err.message : String(err);
   return (
      /"code"\s*:\s*429/.test(message) || /RESOURCE_EXHAUSTED/.test(message)
   );
}

export interface FallbackOutcome<T> {
   result: T;
   model: string;
   keyIndex: number;
}

/**
 * Runs `attempt` across the model chain and API keys. Rate-limited (429) keys
 * are exhausted for the rest of the request and the next key is tried;
 * high-demand (503) models advance to the next model. Any other error is
 * rethrown immediately.
 */
export async function withFallback<T>(
   models: string[],
   apiKeys: string[],
   attempt: (model: string, apiKey: string) => Promise<T>
): Promise<FallbackOutcome<T>> {
   if (apiKeys.length === 0) {
      throw new Error("No Gemini API keys are configured in the environment.");
   }

   const exhaustedKeys = new Set<number>();
   let lastErr: unknown;

   for (const model of models) {
      for (let k = 0; k < apiKeys.length; k++) {
         if (exhaustedKeys.has(k)) continue;
         try {
            const result = await attempt(model, apiKeys[k]!);
            return { result, model, keyIndex: k };
         } catch (err) {
            lastErr = err;

            if (isRateLimitError(err)) {
               exhaustedKeys.add(k);
               if (exhaustedKeys.size < apiKeys.length) {
                  console.warn(
                     `[yapperize] API key #${k + 1} rate limited (429). Trying next key...`
                  );
               }
               continue;
            }

            if (isHighDemandError(err)) {
               console.warn(
                  `[yapperize] Model "${model}" is overloaded (503). Falling back to next model...`
               );
               break;
            }

            throw err;
         }
      }
      if (exhaustedKeys.size >= apiKeys.length) break;
   }

   throw friendlyFallbackError(lastErr);
}

function friendlyFallbackError(err: unknown): Error {
   if (isRateLimitError(err)) {
      return new Error(
         "All Gemini API keys are currently rate limited. Please try again in a moment."
      );
   }
   if (isHighDemandError(err)) {
      return new Error(
         "All Gemini models are currently experiencing high demand. Please try again in a moment."
      );
   }
   return new Error("Gemini summarization failed. Please try again later.");
}

function parseSummaryResponse(responseText: string | undefined): SummaryResult {
   if (!responseText) {
      throw new Error("Received an empty response from Gemini API.");
   }

   try {
      const parsed = JSON.parse(responseText);
      return SummaryZodSchema.parse(parsed);
   } catch (err) {
      console.error(
         "[yapperize] Failed to parse Gemini response as JSON:",
         responseText,
         err
      );
      throw new Error(
         "Failed to parse the AI summary into the expected structured format."
      );
   }
}

export async function generateSummary(
   messages: SanitizedMessage[],
   apiKeys: string[] = resolveApiKeys(),
   modelOverride: string | undefined = env.GEMINI_MODEL
): Promise<SummaryResult> {
   if (apiKeys.length === 0) {
      throw new Error("GEMINI_API_KEY is not configured in the environment.");
   }

   if (messages.length === 0) {
      throw new Error("No eligible messages found to summarize.");
   }

   const schema = getSummaryJsonSchema();

   const transcript = messages
      .map((m) => `[${m.timestamp}] ${m.author}: ${m.content}`)
      .join("\n");

   const prompt = `Here is the transcript of recent messages from a Discord channel:\n\n${transcript}\n\nPlease analyze the discussion and provide a structured summary adhering strictly to the JSON schema.`;

   const models = resolveModelChain(modelOverride);

   const { result } = await withFallback(
      models,
      apiKeys,
      async (model, apiKey) => {
         const ai = new GoogleGenAI({ apiKey });

         const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
               systemInstruction:
                  "You are a senior discord message summarizer. Analyze the provided Discord chat transcripts and produce a structured, high-signal summary of the discussion. Focus on key decisions, important discussions, topics covered, and the natural flow of conversation. Be objective, accurate, and concise.",
               responseMimeType: "application/json",
               responseJsonSchema: schema,
            },
         });

         return parseSummaryResponse(response.text);
      }
   );

   return result;
}

function safeTruncate(text: string, maxLength: number): string {
   if (text.length <= maxLength) return text;
   return text.slice(0, maxLength - 3) + "...";
}

export function formatSummaryEmbed(
   data: SummaryResult,
   messageCount: number,
   channelName?: string
): EmbedBuilder {
   const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle(`🗣️ Yapperize${channelName ? `: #${channelName}` : ""}`)
      .setTimestamp();

   const descriptionContent =
      `### 📝 Summary\n${data.summary}\n\n` +
      `### 🎯 Conclusion\n${data.conclusion}`;

   embed.setDescription(safeTruncate(descriptionContent, 4000));

   if (data.topics_covered && data.topics_covered.length > 0) {
      const topicsFormatted = data.topics_covered
         .map((t) => `• ${t}`)
         .join("\n");
      embed.addFields({
         name: "📌 Topics Covered",
         value: safeTruncate(topicsFormatted, 1020),
      });
   }

   if (data.flow_of_topics && data.flow_of_topics.length > 0) {
      const flowFormatted = data.flow_of_topics
         .map((f, i) => `${i + 1}. ${f}`)
         .join("\n");
      embed.addFields({
         name: "🔄 Flow of Topics",
         value: safeTruncate(flowFormatted, 1020),
      });
   }

   embed.setFooter({
      text: `Analyzed ${messageCount} message${messageCount === 1 ? "" : "s"}`,
   });

   return embed;
}
