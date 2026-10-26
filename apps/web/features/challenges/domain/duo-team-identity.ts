/** Maximum length for a participant-authored duo team name. */
export const DUO_TEAM_NAME_MAX_LENGTH = 40;

/** Safety cap for the raw emoji input (UTF-16 units); one grapheme is the real rule. */
export const DUO_TEAM_EMOJI_MAX_INPUT_LENGTH = 32;

export type DuoTeamIdentityErrorCode =
   | "INVALID_NAME"
   | "INVALID_EMOJI"
   | "DUPLICATE_NAME"
   | "INVALID_FORMAT"
   | "CHALLENGE_COMPLETED"
   | "RESULTS_LOCKED"
   | "NOT_IN_TEAM";

export class DuoTeamIdentityError extends Error {
   readonly code: DuoTeamIdentityErrorCode;

   constructor(code: DuoTeamIdentityErrorCode, message: string) {
      super(message);
      this.name = "DuoTeamIdentityError";
      this.code = code;
   }
}

export type DuoTeamNameValidationResult =
   | { ok: true; name: string }
   | { ok: false; code: "INVALID_NAME"; message: string };

export type DuoTeamEmojiValidationResult =
   | { ok: true; emoji: string | null }
   | { ok: false; code: "INVALID_EMOJI"; message: string };

const GRAPHEME_SEGMENTER = new Intl.Segmenter("en", {
   granularity: "grapheme",
});

const EXTENDED_PICTOGRAPHIC = new RegExp("\\p{Extended_Pictographic}", "u");
const REGIONAL_INDICATOR_PAIR = new RegExp("^\\p{Regional_Indicator}{2}$", "u");
const KEYCAP = new RegExp("^[0-9#*]\\uFE0F?\\u20E3$", "u");

function isEmojiGrapheme(grapheme: string): boolean {
   return (
      EXTENDED_PICTOGRAPHIC.test(grapheme) ||
      REGIONAL_INDICATOR_PAIR.test(grapheme) ||
      KEYCAP.test(grapheme)
   );
}

/**
 * Normalizes and validates a participant-submitted duo team name.
 * Pure boundary validation so the same rules apply in the UI and repository.
 */
export function validateDuoTeamName(raw: string): DuoTeamNameValidationResult {
   const name = raw.trim();

   if (!name) {
      return {
         ok: false,
         code: "INVALID_NAME",
         message: "Duo name cannot be empty.",
      };
   }

   if (name.length > DUO_TEAM_NAME_MAX_LENGTH) {
      return {
         ok: false,
         code: "INVALID_NAME",
         message: `Duo name cannot exceed ${DUO_TEAM_NAME_MAX_LENGTH} characters.`,
      };
   }

   return { ok: true, name };
}

/**
 * Validates a single-emoji team icon. Blank input is allowed and clears the
 * icon (stored as null). Grapheme segmentation keeps ZWJ families, flags,
 * skin-tone modifiers, and keycaps intact.
 */
export function validateDuoTeamEmoji(
   raw: string | null | undefined
): DuoTeamEmojiValidationResult {
   const trimmed = (raw ?? "").trim();

   if (!trimmed) {
      return { ok: true, emoji: null };
   }

   if (trimmed.length > DUO_TEAM_EMOJI_MAX_INPUT_LENGTH) {
      return {
         ok: false,
         code: "INVALID_EMOJI",
         message: "Please pick a single emoji.",
      };
   }

   const graphemes = Array.from(
      GRAPHEME_SEGMENTER.segment(trimmed),
      (entry) => entry.segment
   );

   if (graphemes.length !== 1 || !isEmojiGrapheme(graphemes[0]!)) {
      return {
         ok: false,
         code: "INVALID_EMOJI",
         message: "Please pick a single emoji.",
      };
   }

   return { ok: true, emoji: graphemes[0]! };
}

export interface DuoTeamIdentityWindow {
   status: "UPCOMING" | "ACTIVE" | "COMPLETED";
   resultsLockedAt?: Date | string | null;
}

/**
 * Duo identities stay editable through the active battle and become read-only
 * once the host locks results (or the challenge has already completed).
 */
export function canEditDuoTeamIdentity({
   status,
   resultsLockedAt,
}: DuoTeamIdentityWindow): boolean {
   return status !== "COMPLETED" && resultsLockedAt == null;
}
