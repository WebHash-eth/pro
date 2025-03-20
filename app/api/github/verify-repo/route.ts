import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { auth } from "@/lib/auth";
import { Octokit } from "octokit";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(auth);

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Owner and repo parameters are required" },
        { status: 400 }
      );
    }

    const octokit = new Octokit({ auth: session.accessToken });
    
    try {
      // Try to get repository information
      const repoResponse = await octokit.request("GET /repos/{owner}/{repo}", {
        owner,
        repo,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      // Try to get branches to verify we have sufficient access
      const branchResponse = await octokit.request("GET /repos/{owner}/{repo}/branches", {
        owner,
        repo,
        per_page: 1,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      // Try to verify clone access by checking contents
      const contentResponse = await octokit.request("GET /repos/{owner}/{repo}/contents", {
        owner,
        repo,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      // If we get here, we have full access to the repository
      return NextResponse.json({
        exists: true,
        accessible: true,
        visibility: repoResponse.data.visibility,
        default_branch: repoResponse.data.default_branch,
      });
    } catch (error: any) {
      console.error("Error verifying repository access:", error);
      
      // Check if the error response exists
      const status = error.status || error.response?.status;
      
      if (status === 404) {
        return NextResponse.json(
          { 
            exists: false,
            accessible: false,
            error: `Repository "${owner}/${repo}" not found. Please check that it exists and you have access to it.`
          },
          { status: 404 }
        );
      } else if (status === 403) {
        return NextResponse.json(
          {
            exists: true,
            accessible: false,
            error: "You don't have permission to access this repository. Please request access from the repository owner."
          },
          { status: 403 }
        );
      } else {
        return NextResponse.json(
          {
            exists: false,
            accessible: false,
            error: "Failed to verify repository access. Please check the repository URL and your permissions."
          },
          { status: status || 500 }
        );
      }
    }
  } catch (error) {
    console.error("Error in verify-repo API:", error);
    return NextResponse.json(
      { 
        exists: false,
        accessible: false,
        error: "Failed to verify repository access" 
      },
      { status: 500 }
    );
  }
} 