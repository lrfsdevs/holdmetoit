import { env } from "../config/env.js";
import { signIn, splashLogin } from "./client.js";

let cachedToken = null;

/**
 * Resets cached auth token (used on 401 or auth failures and in tests)
 */
export function invalidateAuthToken() {
   cachedToken = null;
}

/**
 * Returns cached JWT session token or performs fresh signIn + splashLogin handshake
 */
export async function getOrRefreshAuthToken() {
   if (cachedToken) {
      return cachedToken;
   }
   const auth = await signIn(env.YPT_EMAIL, env.YPT_PASSWORD);
   await splashLogin(auth.token);
   cachedToken = auth.token;
   return cachedToken;
}
