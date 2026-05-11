import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import Github from "next-auth/providers/github";
import FortyTwo from "next-auth/providers/42-school";

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
};