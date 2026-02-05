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
        return this.publishToFacebookPage(post, accessToken);
      }

      if (post.channelType === "IG_BUSINESS") {
        return this.publishToInstagram(post, accessToken);
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

  private async publishToFacebookPage(post: AdapterPost, accessToken: string): Promise<PublishResult> {
    const pageId = post.channelExternalId;

    if (post.mediaUrls.length === 0) {
      // Text-only post
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/feed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: post.text,
            access_token: accessToken,
          }),
        }
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return { success: true, externalPostId: data.id };
    }

    if (post.mediaUrls.length === 1) {
      // Single photo post
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}/photos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: post.mediaUrls[0],
            caption: post.text,
            access_token: accessToken,
          }),
        }
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return { success: true, externalPostId: data.post_id || data.id };
    }

    // Multiple photos - create unpublished photos, then post with attached_media
    const photoIds = await Promise.all(
      post.mediaUrls.map(async (url) => {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${pageId}/photos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url,
              published: false,
              access_token: accessToken,
            }),
          }
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.id;
      })
    );

    const attachedMedia = photoIds.map((id) => ({ media_fbid: id }));
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: post.text,
          attached_media: attachedMedia,
          access_token: accessToken,
        }),
      }
    );
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return { success: true, externalPostId: data.id };
  }

  private async publishToInstagram(post: AdapterPost, accessToken: string): Promise<PublishResult> {
    const igUserId = post.channelExternalId;

    // Instagram requires at least one image
    if (post.mediaUrls.length === 0) {
      return {
        success: false,
        error: "Instagram requer pelo menos uma imagem",
        errorCategory: "validation",
      };
    }

    if (post.mediaUrls.length === 1) {
      // Single image container
      const containerRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: post.mediaUrls[0],
            caption: post.text,
            access_token: accessToken,
          }),
        }
      );
      const containerData = await containerRes.json();
      if (containerData.error) throw new Error(containerData.error.message);

      // Publish the container
      const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: containerData.id,
            access_token: accessToken,
          }),
        }
      );
      const publishData = await publishRes.json();
      if (publishData.error) throw new Error(publishData.error.message);
      return { success: true, externalPostId: publishData.id };
    }

    // Carousel (multiple images)
    // Step 1: Create individual containers
    const childContainers = await Promise.all(
      post.mediaUrls.map(async (url) => {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${igUserId}/media`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url: url,
              is_carousel_item: true,
              access_token: accessToken,
            }),
          }
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        return data.id;
      })
    );

    // Step 2: Create carousel container
    const carouselRes = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          children: childContainers,
          caption: post.text,
          access_token: accessToken,
        }),
      }
    );
    const carouselData = await carouselRes.json();
    if (carouselData.error) throw new Error(carouselData.error.message);

    // Step 3: Publish carousel
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: carouselData.id,
          access_token: accessToken,
        }),
      }
    );
    const publishData = await publishRes.json();
    if (publishData.error) throw new Error(publishData.error.message);
    return { success: true, externalPostId: publishData.id };
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
