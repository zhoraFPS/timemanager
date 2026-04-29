import crypto from "crypto";

/**
 * Generates a cryptographically random initial password.
 * 12 characters from a pool that excludes ambiguous glyphs (0/O, 1/l/I).
 */
export function generateInitialPassword(length = 12): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
