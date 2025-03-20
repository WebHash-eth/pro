import NextAuth from "next-auth/next";
import { auth } from "../../../lib/auth";

// Export the NextAuth handler
const handler = NextAuth(auth);

export { handler as GET, handler as POST }; 