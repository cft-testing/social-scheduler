import { z } from "zod";
import { ChannelType } from "@prisma/client";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Password deve ter pelo menos 6 caracteres"),
});

export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Password deve ter pelo menos 6 caracteres"),
  name: z.string().min(1, "Nome é obrigatório").max(100),
});

export const createPostSchema = z.object({
  text: z.string().min(1, "Texto é obrigatório"),
  channelIds: z.array(z.string()).min(1, "Selecione pelo menos um canal"),
  scheduledAtUtc: z.string().datetime().optional(),
  mediaIds: z.array(z.string()).optional(),
});

export const schedulePostSchema = z.object({
  scheduledAtUtc: z.string().datetime("Data/hora inválida"),
});

// Character limits per channel type
export const CHANNEL_LIMITS: Record<ChannelType, { maxChars: number; maxImages: number }> = {
  FB_PAGE: { maxChars: 63206, maxImages: 10 },
  IG_BUSINESS: { maxChars: 2200, maxImages: 10 },
  LI_ORG: { maxChars: 3000, maxImages: 9 },
  LI_PROFILE: { maxChars: 3000, maxImages: 9 },
};
