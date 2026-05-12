import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import Github from "next-auth/providers/github";
import FortyTwo from "next-auth/providers/42-school";
import { getPrisma } from "@/lib/prisma";

function getOAuthAvatarUrl(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }

    if (value && typeof value === "object" && "link" in value) {
      const link = (value as { link?: unknown }).link;

      if (typeof link === "string" && link.length > 0) {
        return link;
      }
    }
  }

  return null;
}

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
    async signIn({ account, user, profile }) {
      const oauthProvider = account?.provider;
      const oauthProviderAccountId = account?.providerAccountId;
      const avatarUrl = getOAuthAvatarUrl(user.image, profile?.image);

      if (!user.email || !oauthProvider || !oauthProviderAccountId) {
        return false;
      }

      const prisma = getPrisma();

      try {
        await prisma.user.upsert({
          where: {
            oauthProvider_oauthProviderAccountId: {
              oauthProvider,
              oauthProviderAccountId,
            },
          },
          update: {
            email: user.email,
          },
          create: {
            email: user.email,
            displayName: user.name || user.email.split("@")[0],
            avatarUrl,
            oauthProvider,
            oauthProviderAccountId,
          },
        });
      } catch (error) {
        console.error("Failed to create/update user during OAuth sign in:", error);
        return false;
      }

      return true;
    },
    async jwt({ token, account }) {
      if (account?.provider) {
        token.oauthProvider = account.provider;
      }

      if (account?.providerAccountId) {
        token.oauthProviderAccountId = account.providerAccountId;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const user = session.user as Record<string, unknown>;

        user.oauthProvider =
          typeof token.oauthProvider === "string" ? token.oauthProvider : null;
        user.oauthProviderAccountId =
          typeof token.oauthProviderAccountId === "string"
            ? token.oauthProviderAccountId
            : null;
      }

      return session;
    },
  },
};
