import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { auth } from "@/lib/auth";
import connectToDatabase from "@/app/lib/mongodb";
import Deployment from "@/app/models/Deployment";
import DeploymentLog, { IDeploymentLog } from "@/app/models/DeploymentLog";
import mongoose from "mongoose";

// Define a type for the formatted log response
interface FormattedLog {
  _id: string;
  deploymentId: string;
  type: 'info' | 'error' | 'success';
  message: string;
  timestamp: string | Date;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(auth);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user?.email || session.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found" },
        { status: 400 }
      );
    }

    // Get the deployment ID from query parameters
    const url = new URL(request.url);
    const deploymentId = url.searchParams.get("deploymentId");

    if (!deploymentId) {
      return NextResponse.json(
        { error: "Deployment ID is required" },
        { status: 400 }
      );
    }

    // Parse query parameters for pagination
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    
    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    await connectToDatabase();

    // Check if the ID is a MongoDB ObjectId or a deployment ID string
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(deploymentId);
    
    // First, try to find the deployment to validate access
    let deployment: any = null;
    
    if (isObjectId) {
      // Find the deployment by MongoDB ObjectId
      deployment = await Deployment.findOne(
        {
          _id: deploymentId,
          userId,
        }
      ).lean();
    } else {
      // Find the deployment by deploymentId field
      deployment = await Deployment.findOne(
        {
          deploymentId: deploymentId,
          userId,
        }
      ).lean();
    }

    if (!deployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }

    // Determine the correct deploymentId to query logs with
    let queryDeploymentId: string | null = null;
    
    if (isObjectId) {
      // If the input was an ObjectId, we need to use the deployment's deploymentId field
      queryDeploymentId = deployment.deploymentId;
    } else {
      // If the input was already a deploymentId string, use it directly
      queryDeploymentId = deploymentId;
    }

    // If no deploymentId is found, return empty logs
    if (!queryDeploymentId) {
      console.log("No deploymentId found for deployment:", deployment._id);
      return NextResponse.json([]);
    }

    console.log("Fetching logs for deploymentId:", queryDeploymentId);
    
    // Execute a raw query to get the logs
    const db = mongoose.connection.db;
    if (!db) {
      console.error("MongoDB connection not established");
      return NextResponse.json(
        { error: "Database connection error" },
        { status: 500 }
      );
    }
    
    const rawLogs = await db
      .collection('deploymentlogs')
      .find({ deploymentId: queryDeploymentId })
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // If no logs found, return an empty array
    if (!rawLogs || rawLogs.length === 0) {
      console.log("No logs found for deploymentId:", queryDeploymentId);
      return NextResponse.json([]);
    }

    console.log(`Found ${rawLogs.length} logs for deploymentId:`, queryDeploymentId);

    // Format the logs to match the expected format with explicit typing
    const formattedLogs: FormattedLog[] = rawLogs.map((log: any) => ({
      _id: log._id.toString(),
      deploymentId: log.deploymentId,
      type: log.type as 'info' | 'error' | 'success',
      message: log.message,
      timestamp: log.timestamp,
    }));

    return NextResponse.json(formattedLogs);
  } catch (error) {
    console.error("Error fetching deployment logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch deployment logs" },
      { status: 500 }
    );
  }
}
