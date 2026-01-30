import { SocialAdapter, AdapterPost, PublishResult } from "./types";
import { CHANNEL_LIMITS } from "../validation";
import { ChannelType } from "@prisma/client";

const PUBLISH_MODE = process.env.PUBLISH_MODE || "dryrun";

export class LinkedInAdapter implements SocialAdapter {
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
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 1000));

    if (Math.random() < 0.1) {
      return {
        success: false,
        error: "[DRYRUN] Simulated LinkedIn failure for testing",
        errorCategory: "network",
      };
    }

    const fakeId = `dryrun_li_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[DRYRUN] LinkedIn publish: ${post.channelType} - "${post.text.slice(0, 50)}..." -> ${fakeId}`);

    return {
      success: true,
      externalPostId: fakeId,
    };
  }

  private async livePublish(post: AdapterPost, accessToken: string): Promise<PublishResult> {
    try {
      // LinkedIn UGC Post API skeleton
      // const author = post.channelType === "LI_ORG"
      //   ? `urn:li:organization:${post.channelExternalId}`
      //   : `urn:li:person:${post.channelExternalId}`;
      //
      // const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      //   method: "POST",
      //   headers: {
      //     Authorization: `Bearer ${accessToken}`,
      //     "Content-Type": "application/json",
      //     "X-Restli-Protocol-Version": "2.0.0",
      //   },
      //   body: JSON.stringify({
      //     author,
      //     lifecycleState: "PUBLISHED",
      //     specificContent: {
      //       "com.linkedin.ugc.ShareContent": {
      //         shareCommentary: { text: post.text },
      //         shareMediaCategory: "NONE",
      //       },
      //     },
      //     visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      //   }),
      // });
      // const data = await response.json();
      // return { success: true, externalPostId: data.id };

      void accessToken;
      return { success: false, error: "Live LinkedIn publishing not yet implemented", errorCategory: "unknown" };
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
    if (lower.includes("rate") || lower.includes("throttl")) return "rate_limit";
    if (lower.includes("invalid") || lower.includes("validation")) return "validation";
    if (lower.includes("network") || lower.includes("timeout")) return "network";
    return "unknown";
  }
}
