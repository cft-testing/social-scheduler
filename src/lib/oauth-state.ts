import { randomBytes, createHash } from "crypto";
import { getRedis } from "./redis";

const STATE_TTL_SECONDS = 600; // 10 minutes
const STATE_PREFIX = "oauth_state:";

interface OAuthStatePayload {
  workspaceId: string;
  provider: "META" | "LINKEDIN";
  nonce: string;
}

/**
 * Generate a secure OAuth state parameter and store it in Redis.
 * Returns the state string to include in the OAuth URL.
 */
export async function generateOAuthState(
  workspaceId: string,
  provider: "META" | "LINKEDIN"
): Promise<string> {
  const nonce = randomBytes(16).toString("hex");
  const payload: OAuthStatePayload = { workspaceId, provider, nonce };
  const payloadJson = JSON.stringify(payload);
  const state = Buffer.from(payloadJson).toString("base64url");

  // Store hash of state in Redis for validation
  const stateHash = createHash("sha256").update(state).digest("hex");
  const redis = getRedis();
  await redis.setex(`${STATE_PREFIX}${stateHash}`, STATE_TTL_SECONDS, payloadJson);

  return state;
}

/**
 * Validate an OAuth state parameter.
 * Returns the payload if valid, null if invalid or expired.
 */
export async function validateOAuthState(
  state: string
): Promise<OAuthStatePayload | null> {
  try {
    const stateHash = createHash("sha256").update(state).digest("hex");
    const redis = getRedis();
    const stored = await redis.get(`${STATE_PREFIX}${stateHash}`);

    if (!stored) {
      return null;
    }

    // Delete to prevent replay attacks
    await redis.del(`${STATE_PREFIX}${stateHash}`);

    const payload = JSON.parse(stored) as OAuthStatePayload;

    // Verify the state matches the stored payload
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    if (decoded.nonce !== payload.nonce) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
