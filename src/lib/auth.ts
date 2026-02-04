import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./db";
import { loginSchema } from "./validation";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
      workspaceId: string;
    };
  }

  interface User {
    role: string;
    workspaceId: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
    workspaceId: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) {
          console.log("[AUTH] No credentials provided");
          return null;
        }

        const parsed = loginSchema.safeParse({
          email: String(credentials.email ?? ""),
          password: String(credentials.password ?? ""),
        });
        if (!parsed.success) {
          console.log("[AUTH] Validation failed:", parsed.error.errors);
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: parsed.data.email },
          });
          if (!user) {
            console.log("[AUTH] User not found:", parsed.data.email);
            return null;
          }

          const valid = await compare(parsed.data.password, user.passwordHash);
          if (!valid) {
            console.log("[AUTH] Invalid password for:", parsed.data.email);
            return null;
          }

          console.log("[AUTH] Login successful for:", parsed.data.email);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            workspaceId: user.workspaceId,
          };
        } catch (err) {
          console.error("[AUTH] Database error during login:", err);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.workspaceId = user.workspaceId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.workspaceId = token.workspaceId as string;
      return session;
    },
  },
});
