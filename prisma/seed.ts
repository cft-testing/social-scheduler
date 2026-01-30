import { PrismaClient, Role, Provider, ChannelType } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: "Workspace Principal",
    },
  });
  console.log(`Created workspace: ${workspace.name}`);

  // Create admin user
  const passwordHash = await hash("admin123", 12);
  const admin = await prisma.user.create({
    data: {
      email: "admin@example.com",
      passwordHash,
      name: "Administrador",
      role: Role.ADMIN,
      workspaceId: workspace.id,
    },
  });
  console.log(`Created admin user: ${admin.email}`);

  // Create mock channels
  const fbPage = await prisma.channel.create({
    data: {
      workspaceId: workspace.id,
      provider: Provider.META,
      type: ChannelType.FB_PAGE,
      name: "Página Facebook Demo",
      externalId: "mock-fb-page-123",
      connected: true,
    },
  });

  const igBusiness = await prisma.channel.create({
    data: {
      workspaceId: workspace.id,
      provider: Provider.META,
      type: ChannelType.IG_BUSINESS,
      name: "Instagram Business Demo",
      externalId: "mock-ig-biz-456",
      connected: true,
    },
  });

  const liOrg = await prisma.channel.create({
    data: {
      workspaceId: workspace.id,
      provider: Provider.LINKEDIN,
      type: ChannelType.LI_ORG,
      name: "LinkedIn Organização Demo",
      externalId: "mock-li-org-789",
      connected: true,
    },
  });

  console.log(`Created channels: ${fbPage.name}, ${igBusiness.name}, ${liOrg.name}`);
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
