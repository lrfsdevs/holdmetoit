import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";

vi.mock("../src/lib/summarizer.js", async (importOriginal) => {
   const actual =
      await importOriginal<typeof import("../src/lib/summarizer.js")>();
   return {
      ...actual,
      resolveApiKeys: vi.fn(actual.resolveApiKeys),
   };
});

import yapperizeCommand from "../src/commands/yapperize.js";
import {
   fetchAndSanitizeMessages,
   isEligibleMessage,
   parseTimeframeToSnowflake,
   sanitizeMessage,
} from "../src/lib/message-fetcher.js";
import {
   DEFAULT_MODEL_CHAIN,
   SummaryZodSchema,
   formatSummaryEmbed,
   getSummaryJsonSchema,
   isHighDemandError,
   isRateLimitError,
   resolveApiKeys,
   resolveModelChain,
   withFallback,
} from "../src/lib/summarizer.js";
import * as summarizer from "../src/lib/summarizer.js";

const resolveApiKeysMock = summarizer.resolveApiKeys as unknown as ReturnType<
   typeof vi.fn
>;

afterEach(() => {
   vi.unstubAllGlobals();
   resolveApiKeysMock.mockReset();
});

describe("Yapperize Slash Command Definition", () => {
   it("exports valid metadata and the expected options", () => {
      expect(yapperizeCommand.name).toBe("yapperize");
      expect(yapperizeCommand.description).toContain("channel chatter");

      const json = yapperizeCommand.data!.toJSON() as any;
      expect(json.name).toBe("yapperize");
      expect(json.options).toHaveLength(4);

      const channelOpt = json.options.find((o: any) => o.name === "channel");
      expect(channelOpt).toMatchObject({ required: false, autocomplete: true });

      expect(
         json.options.find((o: any) => o.name === "timeframe")?.required
      ).toBe(false);
      expect(
         json.options.find((o: any) => o.name === "message_id")?.required
      ).toBe(false);

      const limitOpt = json.options.find((o: any) => o.name === "limit");
      expect(limitOpt?.min_value).toBe(1);
      expect(limitOpt?.max_value).toBe(500);
   });
});

describe("Channel Autocomplete Handler", () => {
   it("suggests matching text channels where user and bot can view", async () => {
      const respond = vi.fn();

      const channels = new Map([
         [
            "111",
            {
               id: "111",
               name: "general",
               isTextBased: () => true,
               permissionsFor: () => ({ has: () => true }),
            },
         ],
         [
            "222",
            {
               id: "222",
               name: "secret-ops",
               isTextBased: () => true,
               permissionsFor: () => ({ has: () => false }),
            },
         ],
         [
            "333",
            {
               id: "333",
               name: "general-discussion",
               isTextBased: () => true,
               permissionsFor: () => ({ has: () => true }),
            },
         ],
      ]);

      await yapperizeCommand.autocomplete({
         guild: { channels: { cache: channels } },
         client: { user: { id: "bot-123" } },
         user: { id: "user-456" },
         options: {
            getFocused: () => ({ name: "channel", value: "gen" }),
         },
         respond,
      } as any);

      expect(respond).toHaveBeenCalledTimes(1);
      const choices = respond.mock.calls[0]![0] as any[];
      expect(choices).toHaveLength(2);
      expect(choices[0]).toEqual({ name: "#general", value: "111" });
      expect(choices[1]).toEqual({ name: "#general-discussion", value: "333" });
   });

   it("returns an empty list outside a guild", async () => {
      const respond = vi.fn();

      await yapperizeCommand.autocomplete({
         guild: null,
         options: { getFocused: () => ({ name: "channel", value: "" }) },
         respond,
      } as any);

      expect(respond).toHaveBeenCalledWith([]);
   });
});

describe("Temporal Parsing and Snowflake Generation", () => {
   it('parses relative time strings like "2 hours ago"', () => {
      const now = new Date("2026-09-05T12:00:00.000Z");
      const result = parseTimeframeToSnowflake("2 hours ago", now);

      expect(result).not.toBeNull();
      expect(result!.date.getTime()).toBeLessThan(now.getTime());
      const diffHours =
         (now.getTime() - result!.date.getTime()) / (1000 * 60 * 60);
      expect(Math.round(diffHours)).toBe(2);
      expect(typeof result!.snowflake).toBe("string");
      expect(result!.snowflake.length).toBeGreaterThan(10);
   });

   it("returns null for unparseable or empty strings", () => {
      expect(parseTimeframeToSnowflake("supercalifragilistic")).toBeNull();
      expect(parseTimeframeToSnowflake("")).toBeNull();
      expect(parseTimeframeToSnowflake("   ")).toBeNull();
   });
});

describe("Message Eligibility and Sanitization", () => {
   it("filters bots, system messages and empty payloads", () => {
      expect(
         isEligibleMessage({
            author: { bot: true, username: "BotUser" },
            type: 0,
            cleanContent: "Hello from bot",
         })
      ).toBe(false);

      expect(
         isEligibleMessage({
            author: { bot: false, username: "RegularUser" },
            type: 6,
            cleanContent: "Pinned a message.",
         })
      ).toBe(false);

      expect(
         isEligibleMessage({
            author: { bot: false, username: "RegularUser" },
            type: 0,
            cleanContent: "",
            attachments: new Map(),
         })
      ).toBe(false);
   });

   it("accepts default messages and replies", () => {
      expect(
         isEligibleMessage({
            author: { bot: false, username: "Alice" },
            type: 0,
            cleanContent: "Let us build this feature!",
         })
      ).toBe(true);
      expect(
         isEligibleMessage({
            author: { bot: false, username: "Bob" },
            type: 19,
            cleanContent: "Sounds like a great plan.",
         })
      ).toBe(true);
   });

   it("resolves display names and preserves timestamps", async () => {
      const sanitized = await sanitizeMessage({
         id: "123456789012345678",
         author: { username: "alice_discord" },
         member: { displayName: "Alice In Tech" },
         createdAt: new Date("2026-09-05T10:00:00.000Z"),
         cleanContent: "Hey @Bob, check this out",
         type: 0,
      });

      expect(sanitized).toEqual({
         id: "123456789012345678",
         author: "Alice In Tech",
         content: "Hey @Bob, check this out",
         timestamp: "2026-09-05T10:00:00.000Z",
      });
   });

   it("downloads and appends .txt attachment content", async () => {
      vi.stubGlobal(
         "fetch",
         vi.fn(async () => ({
            ok: true,
            text: async () => "Notes from our meeting: Ship v1 tomorrow.",
         }))
      );

      const sanitized = await sanitizeMessage({
         id: "987654321098765432",
         author: { username: "charlie" },
         cleanContent: "Attached the notes.",
         type: 0,
         attachments: [
            {
               name: "notes.txt",
               contentType: "text/plain",
               url: "https://cdn.discordapp.com/attachments/123/notes.txt",
            },
         ],
      });

      expect(sanitized.content).toContain("Attached the notes.");
      expect(sanitized.content).toContain("[Attachment: notes.txt]");
      expect(sanitized.content).toContain(
         "Notes from our meeting: Ship v1 tomorrow."
      );
   });
});

describe("Batch Pagination and Message Fetching", () => {
   it("fetches and filters messages backwards without a boundary", async () => {
      const channel = {
         messages: {
            fetch: vi.fn(
               async () =>
                  new Map([
                     [
                        "1002",
                        {
                           id: "1002",
                           type: 0,
                           author: { bot: false, username: "Bob" },
                           cleanContent: "Second message",
                           createdAt: new Date("2026-09-05T11:00:00Z"),
                        },
                     ],
                     [
                        "1001",
                        {
                           id: "1001",
                           type: 0,
                           author: { bot: true, username: "SpamBot" },
                           cleanContent: "Bot message",
                           createdAt: new Date("2026-09-05T10:59:00Z"),
                        },
                     ],
                     [
                        "1000",
                        {
                           id: "1000",
                           type: 0,
                           author: { bot: false, username: "Alice" },
                           cleanContent: "First message",
                           createdAt: new Date("2026-09-05T10:58:00Z"),
                        },
                     ],
                  ])
            ),
         },
      };

      const result = await fetchAndSanitizeMessages(channel, { limit: 10 });
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]!.content).toBe("First message");
      expect(result.messages[1]!.content).toBe("Second message");
   });

   it("fetches forward using `after` when a timeframe is provided", async () => {
      const fetchMock = vi.fn(async (options: any) => {
         expect(options.after).toBeDefined();
         return new Map([
            [
               "2001",
               {
                  id: "2001",
                  type: 0,
                  author: { bot: false, username: "Dave" },
                  cleanContent: "Message after timeframe",
                  createdAt: new Date("2026-09-05T11:30:00Z"),
               },
            ],
         ]);
      });

      const result = await fetchAndSanitizeMessages(
         { messages: { fetch: fetchMock } },
         { timeframe: "1 hour ago" }
      );

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]!.content).toBe("Message after timeframe");
      expect(result.boundaryDate).toBeDefined();
   });
});

describe("Gemini Schema and Structured Output Validation", () => {
   it("validates structured output with SummaryZodSchema", () => {
      const validData = {
         summary:
            "The team discussed the upcoming Q4 product launch and deployment deadlines.",
         conclusion:
            "Final consensus reached to cut release branch on Friday and freeze features.",
         topics_covered: ["Deployment Timeline", "Bug Fixes", "QA Signoff"],
         flow_of_topics: [
            "Discussion started on deadlines",
            "Evaluated open blockers",
            "Agreed on Friday freeze",
         ],
      };

      const parsed = SummaryZodSchema.parse(validData);
      expect(parsed.summary).toBe(validData.summary);
      expect(parsed.topics_covered).toHaveLength(3);
   });

   it("generates a clean JSON schema for Gemini responseSchema", () => {
      const schema = getSummaryJsonSchema() as any;
      expect(schema.type).toBe("object");
      expect(schema.properties.summary).toBeDefined();
      expect(schema.properties.conclusion).toBeDefined();
      expect(schema.properties.topics_covered).toBeDefined();
      expect(schema.properties.flow_of_topics).toBeDefined();
      expect(schema.$schema).toBeUndefined();
   });
});

describe("Discord Embed Presentation", () => {
   it("builds an embed with summary, conclusion, topics and flow", () => {
      const json = formatSummaryEmbed(
         {
            summary: "Discussion about the database migration plan.",
            conclusion: "Migration scheduled for 2 AM UTC Sunday.",
            topics_covered: ["Database Backup", "Zero-downtime strategy"],
            flow_of_topics: [
               "Identified migration risks",
               "Outlined failover steps",
            ],
         },
         42,
         "dev-discussion"
      ).toJSON();

      expect(json.title).toBe("🗣️ Yapperize: #dev-discussion");
      expect(json.description).toContain(
         "Discussion about the database migration plan."
      );
      expect(json.description).toContain(
         "Migration scheduled for 2 AM UTC Sunday."
      );
      expect(json.fields).toHaveLength(2);

      const topicsField = json.fields?.find((f) =>
         f.name.includes("Topics Covered")
      );
      expect(topicsField?.value).toContain("• Database Backup");
      expect(topicsField?.value).toContain("• Zero-downtime strategy");

      const flowField = json.fields?.find((f) =>
         f.name.includes("Flow of Topics")
      );
      expect(flowField?.value).toContain("1. Identified migration risks");
      expect(flowField?.value).toContain("2. Outlined failover steps");

      expect(json.footer?.text).toContain("42 messages");
   });

   it("truncates oversized descriptions and field values", () => {
      const longText = "A".repeat(5000);
      const json = formatSummaryEmbed(
         {
            summary: longText,
            conclusion: longText,
            topics_covered: [longText],
            flow_of_topics: [longText],
         },
         10
      ).toJSON();

      expect(json.description!.length).toBeLessThanOrEqual(4000);
      for (const field of json.fields ?? []) {
         expect(field.value.length).toBeLessThanOrEqual(1024);
      }
   });
});

describe("Slash Command Interaction Execution & Channel Resolution", () => {
   it("defers publicly and exits safely when no API key is configured", async () => {
      resolveApiKeysMock.mockReturnValue([]);
      const deferReply = vi.fn(async () => {});
      const editReply = vi.fn(async () => {});

      await yapperizeCommand.executeSlash({
         deferReply,
         editReply,
         options: {
            getString: () => null,
            getInteger: () => 50,
         },
         channel: { messages: { fetch: vi.fn(async () => new Map()) } },
      } as any);

      expect(deferReply).toHaveBeenCalledTimes(1);
      expect((deferReply.mock.calls[0] as any[])[0]?.flags).not.toBe(
         MessageFlags.Ephemeral
      );
      expect(editReply).toHaveBeenCalledWith(
         expect.objectContaining({
            content: expect.stringContaining("GEMINI_API_KEY"),
         })
      );
   });

   it("fetches from the specified channel when provided", async () => {
      resolveApiKeysMock.mockReturnValue(["test_key"]);
      const editReply = vi.fn(async () => {});

      const targetFetch = vi.fn(async () => new Map());
      const targetChannel = {
         id: "999888",
         name: "announcements",
         isTextBased: () => true,
         permissionsFor: () => ({ has: () => true }),
         messages: { fetch: targetFetch },
      };
      const defaultChannel = {
         id: "111222",
         name: "bot-commands",
         isTextBased: () => true,
         messages: { fetch: vi.fn(async () => new Map()) },
      };

      await yapperizeCommand.executeSlash({
         deferReply: vi.fn(async () => {}),
         editReply,
         channel: defaultChannel,
         guild: {
            channels: {
               cache: new Map([["999888", targetChannel]]),
               fetch: vi.fn(async () => targetChannel),
            },
         },
         client: { user: { id: "bot-1" } },
         user: { id: "user-1" },
         options: {
            getString: (name: string) =>
               name === "channel" ? "<#999888>" : null,
            getInteger: () => 50,
         },
      } as any);

      expect(targetFetch).toHaveBeenCalled();
      expect(editReply).toHaveBeenCalledWith(
         expect.objectContaining({
            content: expect.stringContaining("#announcements"),
         })
      );
   });

   it("alerts the user on Missing Access (50001)", async () => {
      resolveApiKeysMock.mockReturnValue(["test_key"]);
      const editReply = vi.fn(async () => {});
      const missingAccess: any = new Error("Missing Access");
      missingAccess.code = 50001;

      await yapperizeCommand.executeSlash({
         deferred: true,
         deferReply: vi.fn(async () => {}),
         editReply,
         options: { getString: () => null, getInteger: () => 50 },
         channel: {
            messages: {
               fetch: vi.fn(async () => {
                  throw missingAccess;
               }),
            },
         },
      } as any);

      expect(editReply).toHaveBeenCalledWith(
         expect.objectContaining({
            content: expect.stringContaining("Missing Access (50001)"),
         })
      );
   });

   it("silently ignores transient unknown interaction errors (10062)", async () => {
      resolveApiKeysMock.mockReturnValue(["test_key"]);
      const unknownInteraction: any = new Error("Unknown interaction");
      unknownInteraction.code = 10062;

      await expect(
         yapperizeCommand.executeSlash({
            deferred: true,
            deferReply: vi.fn(async () => {}),
            editReply: vi.fn(async () => {
               throw unknownInteraction;
            }),
            options: { getString: () => null, getInteger: () => 50 },
            channel: {
               messages: {
                  fetch: vi.fn(async () => {
                     throw unknownInteraction;
                  }),
               },
            },
         } as any)
      ).resolves.toBeUndefined();
   });
});

describe("Gemini Model and API Key Fallback", () => {
   const spikeError = () =>
      Object.assign(
         new Error(
            JSON.stringify({
               error: {
                  code: 503,
                  message:
                     "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
                  status: "UNAVAILABLE",
               },
            })
         ),
         { status: 503 }
      );

   const rateLimitError = () =>
      Object.assign(
         new Error(
            JSON.stringify({
               error: {
                  code: 429,
                  message:
                     'Quota exceeded for quota metric "Generate Content API requests per minute".',
                  status: "RESOURCE_EXHAUSTED",
               },
            })
         ),
         { status: 429 }
      );

   it("resolveModelChain returns the default chain when no override is set", () => {
      expect(resolveModelChain()).toEqual([
         "gemini-3.5-flash-lite",
         "gemini-3.6-flash",
         "gemini-3.5-flash",
      ]);
      expect(resolveModelChain("   ")).toEqual([...DEFAULT_MODEL_CHAIN]);
   });

   it("resolveModelChain prepends an override and de-duplicates it", () => {
      expect(resolveModelChain("gemini-custom")).toEqual([
         "gemini-custom",
         "gemini-3.5-flash-lite",
         "gemini-3.6-flash",
         "gemini-3.5-flash",
      ]);
      expect(resolveModelChain("gemini-3.6-flash")).toEqual([
         "gemini-3.6-flash",
         "gemini-3.5-flash-lite",
         "gemini-3.5-flash",
      ]);
   });

   it("isHighDemandError detects only 503 / UNAVAILABLE failures", () => {
      expect(isHighDemandError(spikeError())).toBe(true);
      expect(isHighDemandError({ status: 503 })).toBe(true);
      expect(isHighDemandError(new Error('{"error":{"code":503}}'))).toBe(true);
      expect(isHighDemandError(new Error("boom"))).toBe(false);
      expect(
         isHighDemandError(
            Object.assign(new Error("bad request"), { status: 400 })
         )
      ).toBe(false);
      expect(isHighDemandError(null)).toBe(false);
   });

   it("isRateLimitError detects only 429 / RESOURCE_EXHAUSTED failures", () => {
      expect(isRateLimitError(rateLimitError())).toBe(true);
      expect(isRateLimitError({ status: 429 })).toBe(true);
      expect(isRateLimitError(new Error('{"error":{"code":429}}'))).toBe(true);
      expect(isRateLimitError(spikeError())).toBe(false);
      expect(
         isRateLimitError(
            Object.assign(new Error("bad request"), { status: 400 })
         )
      ).toBe(false);
      expect(isRateLimitError(null)).toBe(false);
   });

   it("resolveApiKeys collects configured keys in order and de-duplicates", () => {
      expect(
         resolveApiKeys({
            GEMINI_API_KEY: "k1",
            GEMINI_API_KEY_2: "k2",
            GEMINI_API_KEY_3: "k3",
         })
      ).toEqual(["k1", "k2", "k3"]);

      expect(
         resolveApiKeys({ GEMINI_API_KEY: "k1", GEMINI_API_KEY_3: "k1" })
      ).toEqual(["k1"]);

      expect(
         resolveApiKeys({ GEMINI_API_KEY: "  k1  ", GEMINI_API_KEY_2: "   " })
      ).toEqual(["k1"]);

      expect(resolveApiKeys({})).toEqual([]);
   });

   it("withFallback returns the first model and key on success", async () => {
      const attempted: string[] = [];
      const { result, model, keyIndex } = await withFallback(
         ["a", "b"],
         ["k1", "k2"],
         async (m, k) => {
            attempted.push(`${m}:${k}`);
            return "ok";
         }
      );

      expect(attempted).toEqual(["a:k1"]);
      expect(model).toBe("a");
      expect(keyIndex).toBe(0);
      expect(result).toBe("ok");
   });

   it("withFallback rotates to the next API key on 429", async () => {
      const attempted: string[] = [];
      const { result, keyIndex } = await withFallback(
         ["a"],
         ["k1", "k2", "k3"],
         async (_m, k) => {
            attempted.push(k);
            if (k === "k1") throw rateLimitError();
            return "summary";
         }
      );

      expect(attempted).toEqual(["k1", "k2"]);
      expect(keyIndex).toBe(1);
      expect(result).toBe("summary");
   });

   it("withFallback advances models on 503 while reusing the key", async () => {
      const attempted: string[] = [];
      const { model, keyIndex } = await withFallback(
         ["a", "b", "c"],
         ["k1"],
         async (m, k) => {
            attempted.push(`${m}:${k}`);
            if (m !== "c") throw spikeError();
            return "summary";
         }
      );

      expect(attempted).toEqual(["a:k1", "b:k1", "c:k1"]);
      expect(model).toBe("c");
      expect(keyIndex).toBe(0);
   });

   it("withFallback exhausts rate-limited keys across models", async () => {
      const attempted: string[] = [];
      const { model, keyIndex } = await withFallback(
         ["a", "b"],
         ["k1", "k2"],
         async (m, k) => {
            attempted.push(`${m}:${k}`);
            if (k === "k1") throw rateLimitError();
            if (m === "a") throw spikeError();
            return "summary";
         }
      );

      expect(attempted).toEqual(["a:k1", "a:k2", "b:k2"]);
      expect(model).toBe("b");
      expect(keyIndex).toBe(1);
   });

   it("withFallback rejects immediately on a non-retryable error", async () => {
      const attempted: string[] = [];
      const error = Object.assign(new Error("bad request"), { status: 400 });

      await expect(
         withFallback(["a", "b", "c"], ["k1", "k2"], async (m, k) => {
            attempted.push(`${m}:${k}`);
            throw error;
         })
      ).rejects.toBe(error);

      expect(attempted).toEqual(["a:k1"]);
   });

   it("reports rate limiting when every key is exhausted", async () => {
      await expect(
         withFallback(["a", "b"], ["k1", "k2"], async () => {
            throw rateLimitError();
         })
      ).rejects.toThrow(/rate limited/i);
   });

   it("reports high demand when every model is overloaded", async () => {
      await expect(
         withFallback(["a", "b", "c"], ["k1"], async () => {
            throw spikeError();
         })
      ).rejects.toThrow(/high demand/i);
   });

   it("throws when no API keys are configured", async () => {
      await expect(withFallback(["a"], [], async () => "ok")).rejects.toThrow(
         /No Gemini API keys/i
      );
   });
});
