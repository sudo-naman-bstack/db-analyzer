import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_DOMAIN = "browserstack.com";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase() ?? "";
      return email.endsWith(`@${ALLOWED_DOMAIN}`);
    },
    async jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email;
      return token;
    },
    async session({ session, token }) {
      if (token.email && session.user) session.user.email = token.email as string;
      return session;
    },
  },
  trustHost: true, // Vercel sets this implicitly but be explicit
});
