import { DiscordAPIError, HTTPError, REST, Routes } from "discord.js";
import type {
   APIEmbed,
   APIEmbedField,
   RESTPostAPIChannelMessageJSONBody,
} from "discord.js";

export const DISCORD_API_VERSION = "10";
export const DISCORD_TOKEN_ENV = "DISCORD_BOT_TOKEN";
export const MISSING_TOKEN_ERROR =
   "DISCORD_BOT_TOKEN is not configured in environment.";

export type DiscordEmbed = APIEmbed;
export type DiscordEmbedField = APIEmbedField;
export type DiscordMessagePayload = RESTPostAPIChannelMessageJSONBody;

export interface DiscordSendResult {
   success: boolean;
   messageId?: string;
   channelId?: string;
   error?: string;
}

export interface DiscordUser {
   id: string;
   username: string;
   global_name?: string | null;
   avatar?: string | null;
   discriminator?: string;
}

export interface DiscordGuildMember {
   roles?: string[];
   nick?: string | null;
   user?: DiscordUser;
}

export type DiscordAuthMode = "bot" | "bearer" | "none";
export type DiscordRequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestDiscordOptions {
   method?: DiscordRequestMethod;
   body?: unknown;
   auth?: DiscordAuthMode;
   token?: string;
   passThroughBody?: boolean;
}

let sharedRest: REST | null = null;

export { DiscordAPIError, HTTPError } from "discord.js";

export function getDiscordToken(): string | null {
   return process.env[DISCORD_TOKEN_ENV]?.trim() || null;
}

export function createDiscordRest(token: string): REST {
   return new REST({ version: DISCORD_API_VERSION }).setToken(token);
}

/**
 * Lazily builds the process-wide REST client from `DISCORD_BOT_TOKEN`.
 * Rate limiting, retries and 429 `Retry-After` handling come from discord.js.
 */
export function getDiscordRest(): REST {
   if (!sharedRest) {
      const token = getDiscordToken();
      if (!token) throw new Error(MISSING_TOKEN_ERROR);
      sharedRest = createDiscordRest(token);
   }
   return sharedRest;
}

export function resetDiscordRest(): void {
   sharedRest = null;
}

export function formatDiscordError(error: unknown): string {
   if (error instanceof DiscordAPIError) {
      return `Discord API error (${error.status}): ${error.message}`;
   }
   if (error instanceof HTTPError) {
      return `Discord API error (${error.status}): ${error.message}`;
   }
   if (error instanceof Error) {
      return `Network exception dispatching to Discord: ${error.message}`;
   }
   return `Network exception dispatching to Discord: ${String(error)}`;
}

/**
 * Low-level escape hatch for endpoints without a dedicated helper (OAuth token
 * exchange, `@me`, etc.). Throws on failure so callers can subclass behaviour.
 */
export async function requestDiscord<T>(
   route: `/${string}`,
   options: RequestDiscordOptions = {}
): Promise<T> {
   const {
      method = "GET",
      body,
      auth = "bot",
      token,
      passThroughBody,
   } = options;

   const authMode: DiscordAuthMode = auth;
   const bearerToken =
      authMode === "bearer" ? token : (token ?? getDiscordToken() ?? undefined);

   if (authMode !== "none" && !bearerToken) {
      throw new Error(MISSING_TOKEN_ERROR);
   }

   const rest =
      token !== undefined
         ? createDiscordRest(token)
         : authMode === "bearer"
           ? createDiscordRest(bearerToken!)
           : authMode === "none"
             ? createDiscordRest(bearerToken ?? "no-auth")
             : getDiscordRest();

   const requestOptions = {
      body: body as any,
      passThroughBody,
      auth: authMode !== "none",
      authPrefix:
         authMode === "bearer" ? ("Bearer" as const) : ("Bot" as const),
   };

   switch (method) {
      case "GET":
         return (await rest.get(route, requestOptions)) as T;
      case "POST":
         return (await rest.post(route, requestOptions)) as T;
      case "PUT":
         return (await rest.put(route, requestOptions)) as T;
      case "PATCH":
         return (await rest.patch(route, requestOptions)) as T;
      case "DELETE":
         return (await rest.delete(route, requestOptions)) as T;
   }
}

export interface SendChannelMessageInput {
   channelId: string;
   embeds?: DiscordEmbed[];
   content?: string;
   components?: DiscordMessagePayload["components"];
}

export async function sendChannelMessage(
   input: SendChannelMessageInput
): Promise<DiscordSendResult> {
   const { channelId, embeds, content, components } = input;

   if (!getDiscordToken()) {
      return { success: false, error: MISSING_TOKEN_ERROR };
   }

   const body: DiscordMessagePayload = {};
   if (content !== undefined) body.content = content;
   if (embeds !== undefined) body.embeds = embeds;
   if (components !== undefined) body.components = components;

   try {
      const message = await requestDiscord<{ id: string }>(
         Routes.channelMessages(channelId) as `/${string}`,
         { method: "POST", body }
      );
      return { success: true, messageId: message.id, channelId };
   } catch (error) {
      return { success: false, channelId, error: formatDiscordError(error) };
   }
}

export interface EditChannelMessageInput {
   channelId: string;
   messageId: string;
   embeds?: DiscordEmbed[];
   content?: string;
   components?: DiscordMessagePayload["components"];
}

export async function editChannelMessage(
   input: EditChannelMessageInput
): Promise<DiscordSendResult> {
   const { channelId, messageId, embeds, content, components } = input;

   if (!getDiscordToken()) {
      return { success: false, error: MISSING_TOKEN_ERROR };
   }

   const body: DiscordMessagePayload = {};
   if (content !== undefined) body.content = content;
   if (embeds !== undefined) body.embeds = embeds;
   if (components !== undefined) body.components = components;

   try {
      await requestDiscord(
         Routes.channelMessage(channelId, messageId) as `/${string}`,
         { method: "PATCH", body }
      );
      return { success: true, messageId, channelId };
   } catch (error) {
      return { success: false, channelId, error: formatDiscordError(error) };
   }
}

export async function fetchDiscordUser(
   userId: string
): Promise<DiscordUser | null> {
   if (!getDiscordToken()) return null;

   try {
      return await requestDiscord<DiscordUser>(
         Routes.user(userId) as `/${string}`
      );
   } catch {
      return null;
   }
}

export interface FetchGuildMemberInput {
   guildId: string;
   userId: string;
}

export async function fetchGuildMember(
   input: FetchGuildMemberInput
): Promise<DiscordGuildMember | null> {
   if (!getDiscordToken()) return null;

   try {
      return await requestDiscord<DiscordGuildMember>(
         Routes.guildMember(input.guildId, input.userId) as `/${string}`
      );
   } catch {
      return null;
   }
}
