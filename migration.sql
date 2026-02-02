-- Social Scheduler - Migration SQL
-- Colar no Supabase SQL Editor e clicar "Run"

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');
CREATE TYPE "Provider" AS ENUM ('META', 'LINKEDIN');
CREATE TYPE "ChannelType" AS ENUM ('FB_PAGE', 'IG_BUSINESS', 'LI_ORG', 'LI_PROFILE');
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED');
CREATE TYPE "MediaType" AS ENUM ('IMAGE');
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EDITOR',
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "type" "ChannelType" NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "tokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "expiresAt" TIMESTAMP(3),
    "metadataJson" TEXT,
    "connected" BOOLEAN NOT NULL DEFAULT true,
    "needsReconnect" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "lastEditorId" TEXT,
    "text" TEXT NOT NULL,
    "statusGlobal" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAtUtc" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostMedia" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "order" INTEGER NOT NULL DEFAULT 0,
    "filename" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostChannel" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "externalPostId" TEXT,
    "lastError" TEXT,
    "publishedAtUtc" TIMESTAMP(3),
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PostChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "postId" TEXT,
    "channelId" TEXT,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detailsJson" TEXT,
    "userId" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "PostChannel_postId_channelId_key" ON "PostChannel"("postId", "channelId");
CREATE INDEX "EventLog_workspaceId_createdAt_idx" ON "EventLog"("workspaceId", "createdAt");
CREATE INDEX "EventLog_postId_idx" ON "EventLog"("postId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_lastEditorId_fkey" FOREIGN KEY ("lastEditorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostChannel" ADD CONSTRAINT "PostChannel_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostChannel" ADD CONSTRAINT "PostChannel_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostChannel" ADD CONSTRAINT "PostChannel_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed data: workspace, admin user, demo channels
INSERT INTO "Workspace" ("id", "name", "createdAt", "updatedAt")
VALUES ('seed-workspace-001', 'Workspace Principal', NOW(), NOW());

-- Password: admin123 (bcrypt hash)
INSERT INTO "User" ("id", "email", "passwordHash", "name", "role", "workspaceId", "createdAt", "updatedAt")
VALUES ('seed-admin-001', 'admin@example.com', '$2a$12$bHAuCK0vv5TaJi1tTU4Kh.LNt2CaQuqUKbxRRTjF8MyR45.kB5N6y', 'Administrador', 'ADMIN', 'seed-workspace-001', NOW(), NOW());

INSERT INTO "Channel" ("id", "workspaceId", "provider", "type", "name", "externalId", "connected", "createdAt", "updatedAt") VALUES
('seed-ch-fb', 'seed-workspace-001', 'META', 'FB_PAGE', 'Página Facebook Demo', 'mock-fb-page-123', true, NOW(), NOW()),
('seed-ch-ig', 'seed-workspace-001', 'META', 'IG_BUSINESS', 'Instagram Business Demo', 'mock-ig-biz-456', true, NOW(), NOW()),
('seed-ch-li', 'seed-workspace-001', 'LINKEDIN', 'LI_ORG', 'LinkedIn Organização Demo', 'mock-li-org-789', true, NOW(), NOW());
