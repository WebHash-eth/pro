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
    const { deploymentId, domainId, txHash } = body;

    if (!deploymentId || !domainId) {
      return NextResponse.json(
        { error: "Deployment ID and Domain ID are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find the deployment
    const deployment = await Deployment.findById(deploymentId);
    if (!deployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }

    // Check if the deployment belongs to the user
    if (deployment.userId.toString() !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

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

    // Disconnect any other domains connected to this deployment
    await EnsDomain.updateMany(
      { deploymentId },
      { $set: { isConnected: false, deploymentId: null } }
    );

    // Update the domain
    await EnsDomain.findByIdAndUpdate(
      domainId,
      { 
        $set: { 
          isConnected: true, 
          deploymentId, 
          lastSyncedAt: new Date(),
          txHash: txHash || null
        } 
      }
    );

    // Update the deployment
    await Deployment.findByIdAndUpdate(
      deploymentId,
      { $set: { ensDomain: domain.domainName } }
    );

    return NextResponse.json({ 
      success: true,
      message: "Domain connected successfully" 
    });
  } catch (error) {
    console.error("Error connecting domain to deployment:", error);
    return NextResponse.json(
      { error: "Failed to connect domain to deployment" },
      { status: 500 }
    );
  }
} 