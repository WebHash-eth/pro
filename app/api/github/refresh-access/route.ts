import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { auth } from "@/lib/auth";

/**
 * API route to refresh GitHub access token and permissions
 * This endpoint redirects the user to GitHub OAuth flow to re-authenticate
 * and grant access to additional repositories
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(auth);
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in with GitHub." },
        { status: 401 }
      );
    }
    
    // Return success with session info
    // The actual re-authentication will be handled client-side using NextAuth's signIn function
    return NextResponse.json({
      success: true,
      message: "Use client-side NextAuth signIn to refresh GitHub access",
      user: {
        email: session.user?.email,
        name: session.user?.name,
        image: session.user?.image
      }
    });
  } catch (error) {
    console.error("Error refreshing GitHub access:", error);
    return NextResponse.json(
      { error: "Failed to refresh GitHub access" },
      { status: 500 }
    );
  }
}
