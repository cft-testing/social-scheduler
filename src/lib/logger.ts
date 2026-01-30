import { prisma } from "./db";
import { LogLevel } from "@prisma/client";

interface LogParams {
  workspaceId: string;
  postId?: string;
  channelId?: string;
  level?: LogLevel;
  action: string;
  message: string;
  details?: Record<string, unknown>;
  userId?: string;
  requestId?: string;
}

export async function logEvent(params: LogParams) {
  try {
    await prisma.eventLog.create({
      data: {
        workspaceId: params.workspaceId,
        postId: params.postId,
        channelId: params.channelId,
        level: params.level ?? LogLevel.INFO,
        action: params.action,
        message: params.message,
        detailsJson: params.details ? JSON.stringify(params.details) : null,
        userId: params.userId,
        requestId: params.requestId,
      },
    });
  } catch (err) {
    console.error("Failed to write event log:", err);
  }
}

export function createLogger(workspaceId: string, userId?: string) {
  return {
    info: (action: string, message: string, extra?: Partial<LogParams>) =>
      logEvent({ workspaceId, userId, action, message, level: LogLevel.INFO, ...extra }),
    warn: (action: string, message: string, extra?: Partial<LogParams>) =>
      logEvent({ workspaceId, userId, action, message, level: LogLevel.WARN, ...extra }),
    error: (action: string, message: string, extra?: Partial<LogParams>) =>
      logEvent({ workspaceId, userId, action, message, level: LogLevel.ERROR, ...extra }),
  };
}
