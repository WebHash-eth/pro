import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { auth } from "@/lib/auth";
import { Octokit } from "octokit";
import { getUserRepositories } from "@/app/lib/github.service";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(auth);

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const repositories = await getUserRepositories(session.accessToken);
    return NextResponse.json(repositories);
  } catch (error) {
    console.error("Error fetching repositories:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
} 