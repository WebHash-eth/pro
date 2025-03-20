import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { auth } from "@/lib/auth";
import connectToDatabase from "@/app/lib/mongodb";
import Deployment from "@/app/models/Deployment";
import { getUserByEmail } from "@/app/lib/user.service";
import { IUser } from "@/app/models/User";

export async function GET(
  request: NextRequest
) {
  try {
    const session = await getServerSession(auth);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Instead of using dynamic route params which are now promises in Next.js 15,
    // let's extract the ID from the URL directly
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 2]; // Get the ID from the path

    if (!id) {
      return NextResponse.json(
        { error: "Deployment ID is required" },
        { status: 400 }
      );
    }

    console.log(`Fetching embedded logs for deployment: ${id}`);

    await connectToDatabase();

    // Check if the ID is a MongoDB ObjectId or a deployment ID string
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    // Find the deployment
    let deployment;
    
    if (isObjectId) {
      deployment = await Deployment.findOne({
        _id: id,
        userId,
      }).lean();
    } else {
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

    // Get the logs from the deployment
    const logs = (deployment as any).logs || [];

    // Sort logs by timestamp (oldest first for chronological display)
    logs.sort((a: { timestamp: string | Date }, b: { timestamp: string | Date }) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateA.getTime() - dateB.getTime();
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching deployment logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch deployment logs" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
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

    // Instead of using dynamic route params which are now promises in Next.js 15,
    // let's extract the ID from the URL directly
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 2]; // Get the ID from the path

    if (!id) {
      return NextResponse.json(
        { error: "Deployment ID is required" },
        { status: 400 }
      );
    }

    // Parse the request body
    const body = await request.json();
    
    // Validate the log entry
    if (!body.message) {
      return NextResponse.json(
        { error: "Log message is required" },
        { status: 400 }
      );
    }

    const logEntry = {
      type: body.type || 'info',
      message: body.message,
      timestamp: new Date(),
    };

    await connectToDatabase();

    // Check if the ID is a MongoDB ObjectId or a deployment ID string
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    // Find and update the deployment
    let updatedDeployment;
    
    if (isObjectId) {
      updatedDeployment = await Deployment.findOneAndUpdate(
        {
          _id: id,
          userId,
        },
        {
          $push: { logs: logEntry }
        },
        { new: true }
      );
    } else {
      updatedDeployment = await Deployment.findOneAndUpdate(
        {
          deploymentId: id,
          userId,
        },
        {
          $push: { logs: logEntry }
        },
        { new: true }
      );
    }

    if (!updatedDeployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Log added successfully",
      log: logEntry
    });
  } catch (error) {
    console.error("Error adding deployment log:", error);
    return NextResponse.json(
      { error: "Failed to add deployment log" },
      { status: 500 }
    );
  }
}
