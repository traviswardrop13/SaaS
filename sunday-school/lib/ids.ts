import { randomBytes, randomInt } from "crypto";

// Unambiguous alphabet (no 0/O/1/I/L) for join codes people read aloud/type.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function genCode(len = 4): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

export function genId(): string {
  return randomBytes(9).toString("base64url");
}
