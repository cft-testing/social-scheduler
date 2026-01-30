export interface PublishResult {
  success: boolean;
  externalPostId?: string;
  error?: string;
  errorCategory?: "auth" | "rate_limit" | "validation" | "network" | "unknown";
}

export interface AdapterPost {
  text: string;
  mediaUrls: string[];
  channelExternalId: string;
  channelType: string;
}

export interface SocialAdapter {
  validate(post: AdapterPost): Promise<{ valid: boolean; errors: string[] }>;
  publish(post: AdapterPost, accessToken: string): Promise<PublishResult>;
}
