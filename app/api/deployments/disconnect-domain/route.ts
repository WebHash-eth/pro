import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { auth } from "@/lib/auth";
import connectToDatabase from "@/app/lib/mongodb";
import Deployment from "@/app/models/Deployment";
import EnsDomain from "@/app/models/EnsDomain";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { domainId } = body;

    if (!domainId) {
      return NextResponse.json(
        { error: "Domain ID is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find the domain
    const domain = await EnsDomain.findById(domainId);
    if (!domain) {
      return NextResponse.json(
        { error: "Domain not found" },
        { status: 404 }
      );
    }

    // Check if the domain belongs to the user
    if (domain.userId && domain.userId.toString() !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the deployment ID before disconnecting
    const deploymentId = domain.deploymentId;

    // Update the domain to disconnect it
    await EnsDomain.findByIdAndUpdate(
      domainId,
      { 
        $set: { 
          isConnected: false,
          deploymentId: null,
          lastSyncedAt: new Date()
        } 
      }
    );

    // If there was a deployment, update it to remove the ENS domain
    if (deploymentId) {
      await Deployment.findByIdAndUpdate(
        deploymentId,
        { $set: { ensDomain: null } }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: "Domain disconnected successfully" 
    });
  } catch (error) {
    console.error("Error disconnecting domain from deployment:", error);
    return NextResponse.json(
      { error: "Failed to disconnect domain from deployment" },
      { status: 500 }
    );
  }
} 