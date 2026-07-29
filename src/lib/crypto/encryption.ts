import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { getServerEnvironment } from "@/lib/env/server";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function getEncryptionKey(): Buffer {
  const environment = getServerEnvironment();
  if (!environment.INTEGRATION_ENCRYPTION_KEY) {
    // The environment schema already requires this key in production. Repeating
    // the check here means the fallback cannot become live through a code path
    // that bypasses environment validation: the key below is published in this
    // repository and is worthless as a secret.
    if (environment.NODE_ENV === "production") {
      throw new Error(
        "INTEGRATION_ENCRYPTION_KEY is required in production. Refusing to use the published development key.",
      );
    }

    return createHash("sha256")
      .update("development-only-integration-encryption-key")
      .digest();
  }

  const key = Buffer.from(environment.INTEGRATION_ENCRYPTION_KEY, "base64url");
  if (key.length !== 32) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY must be a base64url-encoded 32-byte key.",
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authenticationTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(value: string): string {
  const [version, encodedIv, encodedTag, encodedCiphertext] = value.split(".");
  if (
    version !== "v1" ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext
  ) {
    throw new Error("The encrypted value has an unsupported format.");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
