import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { auth } from "@/lib/auth";
import connectToDatabase from "@/app/lib/mongodb";
import EnsDomain from "@/app/models/EnsDomain";
import Deployment from "@/app/models/Deployment";

// POST: Update ENS records on the blockchain
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(auth);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user?.email;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { domainId, deploymentId, transactionHash } = body;

    if (!domainId || !deploymentId) {
      return NextResponse.json(
        { error: "Domain ID and deployment ID are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find the domain and deployment
    const domain = await EnsDomain.findOne({ _id: domainId, userId });
    const deployment = await Deployment.findOne({ _id: deploymentId, userId });

    if (!domain) {
      return NextResponse.json(
        { error: "ENS domain not found" },
        { status: 404 }
      );
    }

    if (!deployment) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 }
      );
    }

    // Update the domain with the deployment connection
    domain.deploymentId = deploymentId;
    domain.isConnected = true;
    domain.lastSyncedAt = new Date();
    await domain.save();

    // Update the deployment with the connected domain
    if (!deployment.connectedDomains?.includes(domain.domainName)) {
      deployment.connectedDomains = [
        ...(deployment.connectedDomains || []),
        domain.domainName
      ];
      await deployment.save();
    }

    return NextResponse.json({
      success: true,
      message: "ENS records updated successfully",
      domain,
      deployment,
      transactionHash
    });
  } catch (error) {
    console.error("Error updating ENS records:", error);
    return NextResponse.json(
      { error: "Failed to update ENS records" },
      { status: 500 }
    );
  }
} 