import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

// Temporary route to fix admin password - DELETE AFTER USE
export async function GET() {
  try {
    const password = "admin123";
    const passwordHash = await hash(password, 12);

    // Update existing admin or create new one
    const admin = await prisma.user.upsert({
      where: { email: "admin@example.com" },
      update: { passwordHash },
      create: {
        email: "admin@example.com",
        passwordHash,
        name: "Administrador",
        role: "ADMIN",
        workspace: {
          connectOrCreate: {
            where: { id: "default-workspace" },
            create: { id: "default-workspace", name: "Workspace Principal" },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Admin password updated",
      email: admin.email,
      newHash: passwordHash,
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
