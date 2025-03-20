import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { auth } from "@/lib/auth";
import connectToDatabase from "@/app/lib/mongodb";
import Deployment from "@/app/models/Deployment";
import { getUserByEmail } from "@/app/lib/user.service";
import { IUser } from "@/app/models/User";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(auth);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the user ID from the session (MongoDB ObjectId) or fall back to email for backward compatibility
    let userId = session.userId;
    
    // If userId is not available in the session (for existing users before the update),
    // try to find the user by email and get their MongoDB ObjectId
    if (!userId && session.user?.email) {
      await connectToDatabase();
      const user = await getUserByEmail(session.user.email) as IUser | null;
      if (user && user._id) {
        userId = user._id.toString();
      } else {
        // If no user is found, fall back to using the email (for backward compatibility)
        userId = session.user.email;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found" },
        { status: 400 }
      );
    }

    // Check if we're requesting a specific deployment by ID
    const id = request.nextUrl.searchParams.get("id");

    await connectToDatabase();

    if (id) {
      // Find a specific deployment by ID
      const deployment = await Deployment.findOne({
        _id: id,
        userId,
      }).lean();

      if (!deployment) {
        return NextResponse.json(
          { error: "Deployment not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(deployment);
    } else {
      // Check if we're filtering by repository
      const repository = request.nextUrl.searchParams.get("repository");
      
      // Build the query
      const query: any = { userId };
      if (repository) {
        query.repositoryFullName = repository;
      }
      
      // Get deployments for the user with optional repository filter
      const deployments = await Deployment.find(query)
        .sort({ createdAt: -1 })
        .lean();

      // Always return an array, even if empty
      return NextResponse.json(deployments || []);
    }
  } catch (error) {
    console.error("Error fetching deployments:", error);
    return NextResponse.json(
      { error: "Failed to fetch deployments" },
      { status: 500 }
    );
  }
}