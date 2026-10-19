/** Extracts the originating client IP from proxy headers. */
export function getClientIp(headers: Headers): string {
   return (
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headers.get("x-real-ip")?.trim() ||
      "anonymous"
   );
}
