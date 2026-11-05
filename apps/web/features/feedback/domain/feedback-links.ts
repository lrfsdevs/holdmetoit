const LOGROCKET_SESSION_HOST = "app.logrocket.com";
const DEFAULT_APP_ORIGIN = "https://holdmetoit.com";
const ZERO_WIDTH_SPACE = "\u200b";

// Root-relative paths only: no scheme, no host, and none of the characters
// that start a Markdown link or HTML tag.
const INTERNAL_PAGE_PATH = new RegExp(
   "^/(?!/)[\\p{L}\\p{N}\\-._~!$&'*+,;=:%/?#]*$",
   "u"
);

// A scheme or "www." inside a path is auto-linked by GitHub and Discord, so
// `/~https://evil.example` would show a clickable foreign link as an app page.
const EMBEDDED_LINK = new RegExp("://|(?:^|[^\\p{L}\\p{N}])www\\.", "iu");

/**
 * Whether the value is a root-relative page path such as `/challenge/abc`.
 * Rejects absolute URLs, protocol-relative `//host` URLs, link syntax, and
 * links embedded in the path such as `/~https://evil.example`.
 */
export function isInternalPagePath(value: string): boolean {
   return INTERNAL_PAGE_PATH.test(value) && !EMBEDDED_LINK.test(value);
}

function resolveAppOrigin(): string | null {
   try {
      return new URL(process.env.AUTH_URL || DEFAULT_APP_ORIGIN).origin;
   } catch {
      return null;
   }
}

/**
 * Whether the value is a page on this app: either a root-relative path, or an
 * absolute URL on the app's own origin (`AUTH_URL`). Pass `appOrigin` to
 * override the configured origin.
 *
 * The raw text is validated, not the parsed URL, because the URL parser
 * silently drops newlines and tabs and would hide them from the checks.
 */
export function isInternalPageUrl(
   value: string,
   appOrigin: string | null = resolveAppOrigin()
): boolean {
   if (isInternalPagePath(value)) return true;
   if (!appOrigin || !value.startsWith(appOrigin)) return false;

   const suffix = value.slice(appOrigin.length);
   if (suffix && !/^[/?#]/.test(suffix)) return false;

   // Treat the part after the origin as a path so it gets the same
   // character rules as a relative URL.
   return isInternalPagePath(suffix.startsWith("/") ? suffix : `/${suffix}`);
}

/**
 * Returns the page URL when it is a page on this app, otherwise `/`, so
 * a stored value can never place foreign URLs or extra lines in feedback.
 */
export function toSafePageUrl(value: string): string {
   return isInternalPageUrl(value) ? value : "/";
}

/**
 * Returns a link-safe LogRocket session URL, or null when the value is not an
 * https URL on the LogRocket app host. Brackets and parentheses are
 * percent-encoded so the URL cannot break out of a Markdown link.
 */
export function toSafeLogRocketUrl(
   value: string | null | undefined
): string | null {
   if (!value) return null;

   let parsed: URL;
   try {
      parsed = new URL(value.trim());
   } catch {
      return null;
   }

   if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== LOGROCKET_SESSION_HOST ||
      parsed.port ||
      parsed.username ||
      parsed.password
   ) {
      return null;
   }

   return parsed.href.replace(
      /[()[\]]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
   );
}

/**
 * Breaks @mentions, `#123` cross-references, and `GH-123` references in text
 * that GitHub renders as live Markdown, so they cannot notify or cross-link.
 */
export function neutralizeMentions(text: string): string {
   return text
      .replace(/@/g, `@${ZERO_WIDTH_SPACE}`)
      .replace(/#(?=\d)/g, `#${ZERO_WIDTH_SPACE}`)
      .replace(/\bGH-(?=\d)/gi, (match) => `${match}${ZERO_WIDTH_SPACE}`);
}

/**
 * Wraps text in a Markdown code fence that user content cannot close, since
 * the fence is always longer than the longest backtick run inside the text.
 */
export function fenceCodeBlock(text: string): string {
   const longestRun = Math.max(
      0,
      ...(text.match(/`+/g) ?? []).map((run) => run.length)
   );
   const fence = "`".repeat(Math.max(3, longestRun + 1));
   return `${fence}\n${text}\n${fence}`;
}
