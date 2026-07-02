// Flavourly OS — NextAuth configuration (credentials provider + JWT sessions)
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days
  pages: {
    // We use overlay-based auth (no separate login page), but NextAuth
    // needs a fallback. Points to "/" which renders the app shell.
    signIn: "/",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const email = credentials?.email?.toLowerCase().trim();
          const password = credentials?.password;
          if (!email || !password) return null;

          const user = await db.user.findUnique({
            where: { email },
            include: { profiles: true },
          });
          if (!user) {
            console.error("[auth] No user found for:", email);
            return null;
          }

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) {
            console.error("[auth] Password mismatch for:", email);
            return null;
          }

          const profile = user.profiles[0];
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? profile?.fullName ?? undefined,
          };
        } catch (err) {
          console.error("[auth] Authorize error:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        // Fetch profile for role + tenantId
        const profile = await db.profile.findUnique({
          where: { userId: user.id },
        });
        if (profile) {
          token.role = profile.role;
          token.tenantId = profile.tenantId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as Record<string, unknown>).id = token.userId;
        (session.user as Record<string, unknown>).role = token.role ?? "owner";
        (session.user as Record<string, unknown>).tenantId = token.tenantId ?? null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
