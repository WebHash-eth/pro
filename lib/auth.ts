import { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { JWT } from "next-auth/jwt";
import mongoose from 'mongoose';
import connectToDatabase from "@/app/lib/mongodb";
import User from "@/app/models/User";

// Extend the Session type to include accessToken and githubId
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    githubId?: string;
    userId?: string; // MongoDB ObjectId
  }
}

// Extend the JWT type to include accessToken and githubId
declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    githubId?: string;
    userId?: string; // MongoDB ObjectId
  }
}

export const auth: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
        
        // Store GitHub ID in the token
        if (profile) {
          token.githubId = (profile as any).id?.toString();
          
          try {
            // Connect to the database
            console.log("Connecting to database for user creation/update...");
            const mongoose = await connectToDatabase();
            console.log("Database connection established");
            
            // Get direct access to the MongoDB collection
            const db = mongoose.connection.db;
            if (!db) {
              throw new Error("Database connection not established");
            }
            const usersCollection = db.collection('users');
            
            // Check if user exists by email or githubId
            const email = token.email;
            const githubId = token.githubId;
            
            console.log(`Looking for user with email: ${email} or githubId: ${githubId}`);
            
            // First check if user exists by either email or githubId
            let userDoc: any = await usersCollection.findOne({ 
              $or: [
                { email: email },
                { githubId: githubId }
              ]
            });
            
            let user: any;
            
            if (userDoc) {
              console.log(`User found with ID: ${userDoc._id}`);
              
              // Update user if needed
              let isUpdated = false;
              const updateData: Record<string, any> = {};
              
              // Update email if it changed
              if (email && userDoc.email !== email) {
                updateData.email = email;
                isUpdated = true;
              }
              
              // Update GitHub ID if it changed
              if (githubId && userDoc.githubId !== githubId) {
                updateData.githubId = githubId;
                isUpdated = true;
              }
              
              if (token.name && userDoc.name !== token.name) {
                updateData.name = token.name;
                isUpdated = true;
              }
              
              if (token.picture && userDoc.avatarUrl !== token.picture) {
                updateData.avatarUrl = token.picture;
                isUpdated = true;
              }
              
              if (isUpdated) {
                console.log("Updating existing user with new information");
                try {
                  await usersCollection.updateOne(
                    { _id: userDoc._id },
                    { $set: updateData }
                  );
                  console.log("User updated successfully");
                  
                  // Get the updated user
                  userDoc = await usersCollection.findOne({ _id: userDoc._id });
                } catch (error) {
                  console.error("Error updating user, but continuing authentication:", error);
                }
              }
              
              user = userDoc;
            } else {
              // Create new user
              console.log("No user found, creating new user");
              
              try {
                // Prepare user data
                const userData = {
                  email: email,
                  githubId: githubId,
                  name: token.name,
                  avatarUrl: token.picture,
                  createdAt: new Date(),
                  updatedAt: new Date()
                };
                
                // Use updateOne with upsert to avoid race conditions
                const result = await usersCollection.updateOne(
                  { 
                    $or: [
                      { email: email },
                      { githubId: githubId }
                    ]
                  },
                  { 
                    $set: userData,
                    $setOnInsert: { _id: new mongoose.Types.ObjectId() }
                  },
                  { upsert: true }
                );
                
                if (result.upsertedId) {
                  console.log(`New user created with ID: ${result.upsertedId._id}`);
                  // Get the newly created user
                  userDoc = await usersCollection.findOne({ _id: result.upsertedId._id });
                } else {
                  console.log("User already existed, fetching the existing user");
                  // Get the existing user that matched our query
                  userDoc = await usersCollection.findOne({ 
                    $or: [
                      { email: email },
                      { githubId: githubId }
                    ]
                  });
                }
                
                user = userDoc;
              } catch (error) {
                console.error("Error in user creation:", error);
                
                // Create a temporary user object as fallback
                user = {
                  _id: new mongoose.Types.ObjectId(),
                  email: email,
                  githubId: githubId
                };
                console.log(`Created temporary user object with ID: ${user._id}`);
              }
            }
            
            // Store MongoDB ObjectId in the token if user was found or created
            if (user && user._id) {
              token.userId = user._id.toString();
              console.log(`Set token.userId to: ${token.userId}`);
            } else {
              console.error("User object or user._id is undefined, cannot set token.userId");
            }
          } catch (error) {
            console.error("Error in user creation/update process:", error);
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client, like an access_token from a provider
      session.accessToken = token.accessToken;
      session.githubId = token.githubId;
      session.userId = token.userId;
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};