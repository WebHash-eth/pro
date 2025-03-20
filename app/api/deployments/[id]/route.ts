import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { auth } from "@/lib/auth";
import connectToDatabase from "@/app/lib/mongodb";
import Deployment from "@/app/models/Deployment";
import { getUserByEmail } from "@/app/lib/user.service";
import { IUser } from "@/app/models/User";

// In Next.js 15, the route handler pattern has changed
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

    // Extract the ID from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      return NextResponse.json(
        { error: "Deployment ID is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Check if the ID is a MongoDB ObjectId or a deployment ID string
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    // Find a specific deployment by ID
    let deployment;
    
    if (isObjectId) {
      // If it's a MongoDB ObjectId, search by _id
      deployment = await Deployment.findOne({
        _id: id,
        userId,
      }).lean();
    } else {
      // If it's a deployment ID string (e.g., deploy_1741855625576_mmxxzaw), search by deploymentId
      deployment = await Deployment.findOne({
        deploymentId: id,
        userId,
      }).lean();
    }

    if (!deployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(deployment);
  } catch (error) {
    console.error("Error fetching deployment:", error);
    return NextResponse.json(
      { error: "Failed to fetch deployment" },
      { status: 500 }
    );
  }
}

// Add PATCH method to update deployment status
export async function PATCH(request: NextRequest) {
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

    // Extract the ID from the URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      return NextResponse.json(
        { error: "Deployment ID is required" },
        { status: 400 }
      );
    }

    // Parse the request body
    const body = await request.json();
    
    // Validate the status field
    if (!body.status || !['completed', 'failed', 'in_progress'].includes(body.status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be one of: completed, failed, in_progress" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Check if the ID is a MongoDB ObjectId or a deployment ID string
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    // Update the deployment status
    let updatedDeployment;
    
    if (isObjectId) {
      // If it's a MongoDB ObjectId, search by _id
      updatedDeployment = await Deployment.findOneAndUpdate(
        { _id: id, userId },
        { $set: { status: body.status } },
        { new: true }
      );
    } else {
      // If it's a deployment ID string (e.g., deploy_1741855625576_mmxxzaw), search by deploymentId
      updatedDeployment = await Deployment.findOneAndUpdate(
        { deploymentId: id, userId },
        { $set: { status: body.status } },
        { new: true }
      );
    }

    if (!updatedDeployment) {
      return NextResponse.json(
        { error: "Deployment not found or you don't have permission to update it" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Deployment status updated successfully",
      deployment: updatedDeployment
    });
  } catch (error) {
    console.error("Error updating deployment status:", error);
    return NextResponse.json(
      { error: "Failed to update deployment status" },
      { status: 500 }
    );
  }
}