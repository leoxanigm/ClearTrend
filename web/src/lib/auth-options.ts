import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import Github from "next-auth/providers/github";
import FortyTwo from "next-auth/providers/42-school";
import { getPrisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),

    Github({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),

    FortyTwo({
      clientId: process.env.AUTH_42_SCHOOL_ID!,
      clientSecret: process.env.AUTH_42_SCHOOL_SECRET!,
    }),

  ],
  callbacks: {
    async signIn({ user, profile }) {
      if (!user.email) {
        return false;
      }

      const prisma = getPrisma();

      try {
        await prisma.user.upsert({
          where: { email: user.email },
          update: {
            avatarUrl: user.image || profile?.image || null,
          },
          create: {
            email: user.email,
            displayName: user.name || user.email.split("@")[0],
            avatarUrl: user.image || profile?.image || null,
          },
        });
      } catch (error) {
        console.error("Failed to create/update user during OAuth sign in:", error);
        return false;
      }

      return true;
    },
  },
};