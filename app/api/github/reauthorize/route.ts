import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // Get the GitHub OAuth URL
    const clientId = process.env.GITHUB_CLIENT_ID;
    
    if (!clientId) {
      return NextResponse.json({ error: "GitHub client ID not configured" }, { status: 500 });
    }
    
    // Get the callback URL from the request query parameters
    const { searchParams } = new URL(request.url);
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
    
    // Construct the GitHub authorization URL with force consent
    const githubAuthUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${clientId}` +
      `&scope=read:user,user:email,repo` +
      `&redirect_uri=${encodeURIComponent(process.env.NEXTAUTH_URL + "/api/auth/callback/github")}` +
      `&state=${encodeURIComponent(callbackUrl)}` +
      `&allow_signup=false` +
      `&prompt=consent`;
    
    // Redirect directly to GitHub instead of returning the URL
    return NextResponse.redirect(githubAuthUrl);
  } catch (error) {
    console.error("Error generating GitHub reauthorization URL:", error);
    return NextResponse.json({ error: "Failed to generate GitHub authorization URL" }, { status: 500 });
  }
}
