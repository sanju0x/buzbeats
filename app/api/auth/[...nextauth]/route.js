import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { serverEnv } from "@/lib/serverEnv";

const env = serverEnv();

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID || "",
      clientSecret: env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: "/",
  },
  secret: env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
