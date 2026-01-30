import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const publishQueue = new Queue("publish", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export async function enqueuePublishJob(postChannelId: string, delayMs?: number) {
  const jobId = `publish-${postChannelId}`;
  await publishQueue.add(
    "publish-post",
    { postChannelId },
    {
      jobId,
      delay: delayMs && delayMs > 0 ? delayMs : undefined,
    }
  );
  return jobId;
}

export async function cancelPublishJob(postChannelId: string) {
  const jobId = `publish-${postChannelId}`;
  const job = await publishQueue.getJob(jobId);
  if (job) {
    const state = await job.getState();
    if (state === "delayed" || state === "waiting") {
      await job.remove();
      return true;
    }
  }
  return false;
}
