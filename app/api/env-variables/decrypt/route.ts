import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { auth } from "@/lib/auth";
import connectToDatabase from "@/app/lib/mongodb";
import EnvironmentVariable from "@/app/models/EnvironmentVariable";

// This endpoint is only used during the deployment process
// It returns the decrypted environment variables for a repository
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(auth);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Get the user ID (email or ID)
    const userId = session.user?.email || session.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found" },
        { status: 400 }
      );
    }

    // Get repository from query parameters
    const searchParams = request.nextUrl.searchParams;
    const repositoryFullName = searchParams.get("repository");

    if (!repositoryFullName) {
      return NextResponse.json(
        { error: "Repository name is required" },
        { status: 400 }
      );
    }

    // Fetch environment variables for the user and repository
    const envVariables = await EnvironmentVariable.find({ 
      userId, 
      repositoryFullName 
    });

    // Decrypt the values and create a key-value object
    const decryptedEnvs: Record<string, string> = {};
    
    for (const env of envVariables) {
      try {
        decryptedEnvs[env.key] = env.decrypt(env.value);
      } catch (error) {
        console.error(`Error decrypting variable ${env.key}:`, error);
        // Skip this variable if decryption fails
      }
    }

    return NextResponse.json(decryptedEnvs);
  } catch (error) {
    console.error("Error fetching decrypted environment variables:", error);
    return NextResponse.json(
      { error: "Failed to fetch environment variables" },
      { status: 500 }
    );
  }
} 