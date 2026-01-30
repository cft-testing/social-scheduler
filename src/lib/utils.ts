import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { PostStatus, Provider, ChannelType } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_LABELS: Record<PostStatus, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  PUBLISHING: "A publicar",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
};

export const STATUS_COLORS: Record<PostStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  PUBLISHING: "bg-yellow-100 text-yellow-700",
  PUBLISHED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-orange-100 text-orange-700",
};

export function statusLabel(status: PostStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function statusColor(status: PostStatus): string {
  return STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700";
}

export const PROVIDER_LABELS: Record<Provider, string> = {
  META: "Meta",
  LINKEDIN: "LinkedIn",
};

export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  FB_PAGE: "Página Facebook",
  IG_BUSINESS: "Instagram Business",
  LI_ORG: "Organização LinkedIn",
  LI_PROFILE: "Perfil LinkedIn",
};

export function providerLabel(provider: Provider): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export function channelTypeLabel(type: ChannelType): string {
  return CHANNEL_TYPE_LABELS[type] ?? type;
}
