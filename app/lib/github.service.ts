"use server";

import { Octokit } from "octokit";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  default_branch: string;
  visibility: string;
  updated_at: string;
}

export async function getUserRepositories(accessToken: string): Promise<Repository[]> {
  try {
    const octokit = new Octokit({ auth: accessToken });
    
    const response = await octokit.request("GET /user/repos", {
      sort: "updated",
      per_page: 100,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    
    return response.data as Repository[];
  } catch (error) {
    console.error("Error fetching repositories:", error);
    throw new Error("Failed to fetch repositories");
  }
}

export async function getBranches(
  accessToken: string,
  owner: string,
  repo: string
): Promise<string[]> {
  try {
    const octokit = new Octokit({ auth: accessToken });
    
    const response = await octokit.request("GET /repos/{owner}/{repo}/branches", {
      owner,
      repo,
      per_page: 100,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    
    return response.data.map((branch) => branch.name);
  } catch (error) {
    console.error("Error fetching branches:", error);
    throw new Error("Failed to fetch branches");
  }
}

export async function getRepositoryContents(
  accessToken: string,
  owner: string,
  repo: string,
  path: string = "",
  branch: string = "main"
): Promise<any[]> {
  try {
    const octokit = new Octokit({ auth: accessToken });
    
    const response = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner,
      repo,
      path,
      ref: branch,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    
    return Array.isArray(response.data) ? response.data : [response.data];
  } catch (error) {
    console.error("Error fetching repository contents:", error);
    throw new Error("Failed to fetch repository contents");
  }
}

/**
 * Check if the user has access to a specific repository
 * @param accessToken GitHub access token
 * @param owner Repository owner
 * @param repo Repository name
 * @returns Object with access status and repository details
 */
export async function checkRepositoryAccess(
  accessToken: string,
  owner: string,
  repo: string
): Promise<{ 
  hasAccess: boolean; 
  repoDetails?: { 
    visibility: string;
    htmlUrl: string;
    description: string | null;
    defaultBranch: string;
  }
}> {
  try {
    const octokit = new Octokit({ auth: accessToken });
    
    const response = await octokit.request("GET /repos/{owner}/{repo}", {
      owner,
      repo,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    
    const visibility = response.data.visibility || 'private';
    const htmlUrl = response.data.html_url || `https://github.com/${owner}/${repo}`;
    const description = response.data.description || null;
    const defaultBranch = response.data.default_branch || 'main';
    
    return {
      hasAccess: true,
      repoDetails: {
        visibility,
        htmlUrl,
        description,
        defaultBranch,
      }
    };
  } catch (error: any) {
    // Check if the error is due to lack of permissions
    if (error.status === 404 || error.status === 403) {
      return { hasAccess: false };
    }
    
    console.error("Error checking repository access:", error);
    throw new Error("Failed to check repository access");
  }
}

/**
 * Get the list of repositories that the user has explicitly granted access to
 * @param accessToken GitHub access token
 * @returns Array of repository names that the user has explicitly granted access to
 */
export async function getAccessibleRepositories(accessToken: string): Promise<string[]> {
  try {
    const repositories = await getUserRepositories(accessToken);
    return repositories
      .map(repo => repo.full_name)
      .filter((name): name is string => typeof name === 'string');
  } catch (error) {
    console.error("Error getting accessible repositories:", error);
    throw new Error("Failed to get accessible repositories");
  }
}