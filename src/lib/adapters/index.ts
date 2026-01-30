import { Provider } from "@prisma/client";
import { SocialAdapter } from "./types";
import { MetaAdapter } from "./meta-adapter";
import { LinkedInAdapter } from "./linkedin-adapter";

const adapters: Record<Provider, SocialAdapter> = {
  META: new MetaAdapter(),
  LINKEDIN: new LinkedInAdapter(),
};

export function getAdapter(provider: Provider): SocialAdapter {
  const adapter = adapters[provider];
  if (!adapter) throw new Error(`No adapter for provider: ${provider}`);
  return adapter;
}
