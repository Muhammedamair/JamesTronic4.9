import NextAuth from 'next-auth';
import { createClient } from '@supabase/supabase-js';

// Define the authOptions
export const authOptions = {
  providers: [
    // You can add providers like Google, GitHub, etc. here if needed
    // For now, we'll use Supabase's built-in authentication
  ],
  callbacks: {
    async session({ session, token }: { session: any; token: any }) {
      // Add user ID and role to the session
      session.user.id = token.sub;
      session.user.role = token.role;
      return session;
    },
    async jwt({ token, user }: { token: any; user?: any }) {
      // Add custom claims to JWT token
      if (user) {
        token.role = user.role;
      }
      return token;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  // Add other options as needed
};

// Create the NextAuth instance
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };