import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Admin login: a single shared email + password from env (dev placeholder).
// For production this should become a hashed, per-user credential.
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const adminPassword = process.env.ADMIN_PASSWORD ?? "";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login?error=1",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        if (!adminEmails.includes(email)) return null;
        if (!adminPassword || password !== adminPassword) return null;
        return { id: email, email, role: "ADMIN" };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "ADMIN";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? "admin") as string;
        session.user.role = (token.role as string) ?? "ADMIN";
      }
      return session;
    },
  },
});
