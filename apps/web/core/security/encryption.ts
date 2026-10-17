import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte key from the application secret.
 */
function getDerivedKey(): Buffer {
   const secret =
      process.env.YPT_SESSION_SECRET ||
      process.env.AUTH_SECRET ||
      "holdmetoit-default-secret-salt-32chars!";
   return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts sensitive text (e.g. YPT refresh tokens) using AES-256-GCM.
 * Output format: base64(iv + authTag + ciphertext)
 */
export function encryptSensitiveToken(plainText: string): string {
   if (!plainText) return "";
   const key = getDerivedKey();
   const iv = crypto.randomBytes(IV_LENGTH);
   const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

   const encrypted = Buffer.concat([
      cipher.update(plainText, "utf8"),
      cipher.final(),
   ]);
   const authTag = cipher.getAuthTag();

   // Pack iv (12 bytes) + authTag (16 bytes) + encrypted
   const combined = Buffer.concat([iv, authTag, encrypted]);
   return combined.toString("base64");
}

/**
 * Decrypts text previously encrypted with encryptSensitiveToken.
 */
export function decryptSensitiveToken(cipherText: string): string {
   if (!cipherText) return "";
   try {
      const combined = Buffer.from(cipherText, "base64");
      if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
         throw new Error("Invalid cipher buffer length");
      }

      const iv = combined.subarray(0, IV_LENGTH);
      const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

      const key = getDerivedKey();
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
         decipher.update(encrypted),
         decipher.final(),
      ]);
      return decrypted.toString("utf8");
   } catch {
      throw new Error(
         "Failed to decrypt secure token: invalid or corrupted data"
      );
   }
}
