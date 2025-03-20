import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Octokit } from "@octokit/rest";
import { auth } from "@/lib/auth";

/**
 * API route to check if the user has access to a specific GitHub repository
 * @param request NextRequest object containing the owner and repo in the query params
 * @returns NextResponse with access status and repository details if available
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(auth);
    
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in with GitHub." },
        { status: 401 }
      );
    }
    
    const url = new URL(request.url);
    const owner = url.searchParams.get("owner");
    const repo = url.searchParams.get("repo");
    
    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Missing required parameters: owner and repo" },
        { status: 400 }
      );
    }
    
    const octokit = new Octokit({ auth: session.accessToken });
    
    try {
      // Try to fetch the repository to see if the user has access
      const response = await octokit.request("GET /repos/{owner}/{repo}", {
        owner,
        repo,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      
      // If we get here, the user has access to the repository
      return NextResponse.json({
        hasAccess: true,
        repoDetails: {
          visibility: response.data.visibility || 'private',
          htmlUrl: response.data.html_url,
          description: response.data.description,
          defaultBranch: response.data.default_branch || 'main',
        }
      });
    } catch (error: any) {
      // Check if the error is due to lack of permissions
      if (error.status === 404 || error.status === 403) {
        return NextResponse.json({ hasAccess: false });
      }
      
      throw error; // Re-throw for the outer catch block
    }
  } catch (error) {
    console.error("Error checking repository access:", error);
    return NextResponse.json(
      { error: "Failed to check repository access" },
      { status: 500 }
    );
  }
}
