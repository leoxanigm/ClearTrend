import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import Google from "next-auth/providers/google";
import Github from "next-auth/providers/github";
import FortyTwo from "next-auth/providers/42-school";
import { getPrisma } from "@/lib/prisma";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

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

    Credentials({
      name: "credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials, req) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";

        if (!email || !password) {
          return null;
        }

        const ip = getClientIp(req ?? { headers: new Headers() });
        const loginRateLimit = isRateLimited(`auth:login:${ip}`, {
          limit: 5,
          windowMs: 60_000,
        });

        if (!loginRateLimit.allowed) {
          throw new Error("RATE_LIMITED");
        }

        const prisma = getPrisma();
        const user = await prisma.user.findFirst({
          where: {
            email,
            passwordHash: {
              not: null,
            },
          },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);

        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, user, profile }) {
      const oauthProvider = account?.provider;
      const oauthProviderAccountId = account?.providerAccountId;

      if (oauthProvider === "credentials") {
        return true;
      }

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
    async jwt({ token, account, user }) {
      if (user?.id) {
        token.userId = user.id;
      }

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

        user.id = typeof token.userId === "string" ? token.userId : null;

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
