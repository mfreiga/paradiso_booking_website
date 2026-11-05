import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

// Two ways in:
//  1. The shared owner login from env (ADMIN_EMAILS + ADMIN_PASSWORD) — the
//     owner's master key, always works, even before any account exists.
//  2. Personal staff accounts from the DB (username or email + scrypt hash),
//     created by the owner under "Team". Barbers only see their own bookings.
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const adminPassword = process.env.ADMIN_PASSWORD ?? "";

export type StaffRole = "OWNER" | "BARBER";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 3600 },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login?error=1",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-Mail oder Benutzername", type: "text" },
        password: { label: "Passwort", type: "password" },
      },
      authorize: async (credentials) => {
        const login = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!login || !password) return null;

        if (adminEmails.includes(login) && adminPassword && password === adminPassword) {
          return { id: `env:${login}`, email: login, name: "Inhaber", role: "OWNER" };
        }

        const user = await prisma.user.findFirst({
          where: { isActive: true, OR: [{ username: login }, { email: login }] },
        });
        if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.username,
          role: user.role === "BARBER" ? "BARBER" : "OWNER",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role ?? "OWNER";
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? "admin") as string;
        session.user.role = (token.role as string) ?? "OWNER";
      }
      return session;
    },
  },
});
