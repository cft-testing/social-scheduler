import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { PostStatus } from "@prisma/client";
import { getAdapter } from "@/lib/adapters";
import { decrypt } from "@/lib/crypto";
import { logEvent } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { refreshChannelToken } from "@/lib/token-refresh";
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

async function processPublishJob(job: Job<{ postChannelId: string }>) {
  const { postChannelId } = job.data;

  const postChannel = await prisma.postChannel.findUnique({
    where: { id: postChannelId },
    include: {
      post: { include: { media: { orderBy: { order: "asc" } } } },
      channel: true,
    },
  });

  if (!postChannel) {
    console.log(`PostChannel ${postChannelId} not found, skipping`);
    return;
  }

  // Idempotency: skip if already published or cancelled
  if (postChannel.status === PostStatus.PUBLISHED || postChannel.status === PostStatus.CANCELLED) {
    console.log(`PostChannel ${postChannelId} already ${postChannel.status}, skipping`);
    return;
  }

  // Mark as publishing
  await prisma.postChannel.update({
    where: { id: postChannelId },
    data: { status: PostStatus.PUBLISHING },
  });
  await prisma.post.update({
    where: { id: postChannel.postId },
    data: { statusGlobal: PostStatus.PUBLISHING },
  });

  await logEvent({
    workspaceId: postChannel.channel.workspaceId,
    postId: postChannel.postId,
    channelId: postChannel.channelId,
    action: "publish.start",
    message: `A iniciar publicação no canal ${postChannel.channel.name}`,
  });

  const adapter = getAdapter(postChannel.channel.provider);

  // Validate
  const validation = await adapter.validate({
    text: postChannel.post.text,
    mediaUrls: postChannel.post.media.map((m) => m.url),
    channelExternalId: postChannel.channel.externalId || "",
    channelType: postChannel.channel.type,
  });

  if (!validation.valid) {
    await prisma.postChannel.update({
      where: { id: postChannelId },
      data: {
        status: PostStatus.FAILED,
        lastError: `Validação falhou: ${validation.errors.join("; ")}`,
      },
    });
    await logEvent({
      workspaceId: postChannel.channel.workspaceId,
      postId: postChannel.postId,
      channelId: postChannel.channelId,
      level: "ERROR",
      action: "publish.validation_failed",
      message: validation.errors.join("; "),
    });
    await updateGlobalStatus(postChannel.postId);
    return;
  }

  // Check token expiry and refresh if needed
  let channel = postChannel.channel;
  if (channel.expiresAt) {
    const hoursUntilExpiry = (channel.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilExpiry < 24) {
      console.log(`Token for channel ${channel.id} expires in ${hoursUntilExpiry.toFixed(1)} hours, attempting refresh...`);
      const refreshResult = await refreshChannelToken(channel);

      if (refreshResult.success) {
        // Refetch channel with updated token
        const updatedChannel = await prisma.channel.findUnique({
          where: { id: channel.id },
        });
        if (updatedChannel) {
          channel = updatedChannel;
        }
        await logEvent({
          workspaceId: channel.workspaceId,
          channelId: channel.id,
          action: "token.refreshed",
          message: "Token renovado automaticamente antes da publicação",
        });
      } else if (hoursUntilExpiry <= 0) {
        // Token expired and refresh failed
        await prisma.postChannel.update({
          where: { id: postChannelId },
          data: {
            status: PostStatus.FAILED,
            lastError: "Token expirado e renovação falhou. Reconecte o canal.",
          },
        });
        await prisma.channel.update({
          where: { id: channel.id },
          data: { needsReconnect: true },
        });
        await logEvent({
          workspaceId: channel.workspaceId,
          postId: postChannel.postId,
          channelId: channel.id,
          level: "ERROR",
          action: "token.expired",
          message: `Token expirado e renovação falhou: ${refreshResult.error}`,
        });
        await updateGlobalStatus(postChannel.postId);
        return;
      } else {
        // Refresh failed but token not yet expired - proceed with warning
        console.warn(`Token refresh failed for channel ${channel.id}: ${refreshResult.error}`);
        await logEvent({
          workspaceId: channel.workspaceId,
          channelId: channel.id,
          level: "WARN",
          action: "token.refresh_failed",
          message: `Renovação de token falhou: ${refreshResult.error}`,
        });
      }
    }
  }

  // Decrypt access token
  let accessToken = "";
  if (channel.tokenEncrypted) {
    try {
      accessToken = decrypt(channel.tokenEncrypted);
    } catch (err) {
      console.error(`Failed to decrypt token for channel ${channel.id}:`, err);
      await prisma.postChannel.update({
        where: { id: postChannelId },
        data: {
          status: PostStatus.FAILED,
          lastError: "Falha ao desencriptar token do canal. Reconecte o canal.",
        },
      });
      await prisma.channel.update({
        where: { id: channel.id },
        data: { needsReconnect: true },
      });
      await logEvent({
        workspaceId: channel.workspaceId,
        postId: postChannel.postId,
        channelId: channel.id,
        level: "ERROR",
        action: "publish.decrypt_failed",
        message: "Falha ao desencriptar token de acesso do canal",
      });
      await updateGlobalStatus(postChannel.postId);
      return;
    }
  }

  // Publish
  const result = await adapter.publish(
    {
      text: postChannel.post.text,
      mediaUrls: postChannel.post.media.map((m) => m.url),
      channelExternalId: channel.externalId || "",
      channelType: channel.type,
    },
    accessToken
  );

  if (result.success) {
    await prisma.postChannel.update({
      where: { id: postChannelId },
      data: {
        status: PostStatus.PUBLISHED,
        externalPostId: result.externalPostId,
        publishedAtUtc: new Date(),
      },
    });
    await logEvent({
      workspaceId: postChannel.channel.workspaceId,
      postId: postChannel.postId,
      channelId: postChannel.channelId,
      action: "publish.success",
      message: `Publicado com sucesso: ${result.externalPostId || "N/A"}`,
    });
  } else {
    await prisma.postChannel.update({
      where: { id: postChannelId },
      data: {
        status: PostStatus.FAILED,
        lastError: result.error || "Erro desconhecido",
      },
    });
    await logEvent({
      workspaceId: postChannel.channel.workspaceId,
      postId: postChannel.postId,
      channelId: postChannel.channelId,
      level: "ERROR",
      action: "publish.failed",
      message: result.error || "Erro desconhecido",
      details: { errorCategory: result.errorCategory },
    });

    // Mark channel as needing reconnect if auth error
    if (result.errorCategory === "auth") {
      await prisma.channel.update({
        where: { id: postChannel.channelId },
        data: { needsReconnect: true },
      });
    }

    // Throw to trigger retry if retryable
    if (result.errorCategory === "network" || result.errorCategory === "rate_limit") {
      throw new Error(result.error || "Retryable error");
    }
  }

  await updateGlobalStatus(postChannel.postId);
}

async function updateGlobalStatus(postId: string) {
  const channels = await prisma.postChannel.findMany({
    where: { postId },
    select: { status: true },
  });

  const statuses = channels.map((c) => c.status);

  let globalStatus: PostStatus;
  if (statuses.every((s) => s === PostStatus.PUBLISHED)) {
    globalStatus = PostStatus.PUBLISHED;
  } else if (statuses.every((s) => s === PostStatus.CANCELLED)) {
    globalStatus = PostStatus.CANCELLED;
  } else if (statuses.some((s) => s === PostStatus.PUBLISHING)) {
    globalStatus = PostStatus.PUBLISHING;
  } else if (statuses.some((s) => s === PostStatus.FAILED)) {
    globalStatus = PostStatus.FAILED;
  } else if (statuses.some((s) => s === PostStatus.SCHEDULED)) {
    globalStatus = PostStatus.SCHEDULED;
  } else {
    globalStatus = PostStatus.DRAFT;
  }

  await prisma.post.update({
    where: { id: postId },
    data: { statusGlobal: globalStatus },
  });
}

const worker = new Worker("publish", processPublishJob, {
  connection,
  concurrency: 5,
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down worker...");
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("Publish worker started. Waiting for jobs...");
