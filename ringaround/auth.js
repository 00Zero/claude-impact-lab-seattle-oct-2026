import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export function isAuthConfigured() {
  return Boolean(
    process.env.AUTH_SECRET &&
      process.env.AUTH_GOOGLE_ID &&
      process.env.AUTH_GOOGLE_SECRET,
  );
}

// The current session, or null when auth isn't configured (auth() throws
// without a secret).
export async function getSession() {
  return isAuthConfigured() ? auth() : null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    // Without a database adapter Auth.js gives the user a fresh random ID on
    // every sign-in, and that ID becomes `sub`. Everything in D1 is keyed by
    // `sub`, so use the Google account ID instead, which stays the same.
    jwt({ token, account }) {
      if (account) {
        token.sub = account.providerAccountId;
        token.stableId = true;
      }
      // Tokens issued before this carry a one-off ID; sign them out so the next
      // sign-in gets the stable one before more data is saved under the old.
      return token.stableId ? token : null;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.sub;
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
});
