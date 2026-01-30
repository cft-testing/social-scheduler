import { SocialAdapter, AdapterPost, PublishResult } from "./types";
import { CHANNEL_LIMITS } from "../validation";
import { ChannelType } from "@prisma/client";

const PUBLISH_MODE = process.env.PUBLISH_MODE || "dryrun";

export class MetaAdapter implements SocialAdapter {
  async validate(post: AdapterPost): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const limits = CHANNEL_LIMITS[post.channelType as ChannelType];

    if (limits) {
      if (post.text.length > limits.maxChars) {
        errors.push(`Texto excede o limite de ${limits.maxChars} caracteres (tem ${post.text.length})`);
      }
      if (post.mediaUrls.length > limits.maxImages) {
        errors.push(`Máximo de ${limits.maxImages} imagens permitidas (tem ${post.mediaUrls.length})`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async publish(post: AdapterPost, accessToken: string): Promise<PublishResult> {
    if (PUBLISH_MODE === "dryrun") {
      return this.dryRunPublish(post);
    }
    return this.livePublish(post, accessToken);
  }

  private async dryRunPublish(post: AdapterPost): Promise<PublishResult> {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));

    // 10% simulated failure rate
    if (Math.random() < 0.1) {
      return {
        success: false,
        error: "[DRYRUN] Simulated failure for testing",
        errorCategory: "network",
      };
    }

    const fakeId = `dryrun_meta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[DRYRUN] Meta publish: ${post.channelType} - "${post.text.slice(0, 50)}..." -> ${fakeId}`);

    return {
      success: true,
      externalPostId: fakeId,
    };
  }

  private async livePublish(post: AdapterPost, accessToken: string): Promise<PublishResult> {
    try {
      if (post.channelType === "FB_PAGE") {
        // Facebook Page API skeleton
        // const response = await fetch(
        //   `https://graph.facebook.com/v19.0/${post.channelExternalId}/feed`,
        //   {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify({ message: post.text, access_token: accessToken }),
        //   }
        // );
        // const data = await response.json();
        // if (data.error) throw new Error(data.error.message);
        // return { success: true, externalPostId: data.id };
        void accessToken;
        return { success: false, error: "Live Facebook publishing not yet implemented", errorCategory: "unknown" };
      }

      if (post.channelType === "IG_BUSINESS") {
        // Instagram Business API skeleton (Container + Publish flow)
        // Step 1: Create media container
        // Step 2: Publish container
        void accessToken;
        return { success: false, error: "Live Instagram publishing not yet implemented", errorCategory: "unknown" };
      }

      return { success: false, error: `Unknown channel type: ${post.channelType}`, errorCategory: "validation" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
        errorCategory: this.categorizeError(message),
      };
    }
  }

  private categorizeError(message: string): PublishResult["errorCategory"] {
    const lower = message.toLowerCase();
    if (lower.includes("oauth") || lower.includes("token") || lower.includes("expired")) return "auth";
    if (lower.includes("rate") || lower.includes("throttl") || lower.includes("limit")) return "rate_limit";
    if (lower.includes("invalid") || lower.includes("validation")) return "validation";
    if (lower.includes("network") || lower.includes("timeout") || lower.includes("econnrefused")) return "network";
    return "unknown";
  }
}
