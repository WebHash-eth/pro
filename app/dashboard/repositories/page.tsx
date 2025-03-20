"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Eye, EyeOff, ExternalLink, GitBranch } from "lucide-react";

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

export default function RepositoriesPage() {
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [filteredRepositories, setFilteredRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchRepositories();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredRepositories(repositories);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredRepositories(
        repositories.filter(
          (repo) =>
            repo.name.toLowerCase().includes(query) ||
            repo.full_name.toLowerCase().includes(query) ||
            (repo.description && repo.description.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, repositories]);

  const fetchRepositories = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/github/repositories");
      if (!response.ok) {
        throw new Error("Failed to fetch repositories");
      }
      const data = await response.json();
      setRepositories(data);
      setFilteredRepositories(data);
    } catch (error) {
      console.error("Error fetching repositories:", error);
      toast.error("Failed to load repositories");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploy = (repo: Repository) => {
    router.push(`/dashboard?repo=${repo.full_name}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Repositories</h1>
          <p className="text-muted-foreground">
            View and deploy your GitHub repositories
          </p>
        </div>
        <div className="w-full md:w-auto">
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-64"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50"></CardHeader>
              <CardContent className="h-20 mt-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardContent>
              <CardFooter className="h-12 bg-muted/50"></CardFooter>
            </Card>
          ))}
        </div>
      ) : filteredRepositories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRepositories.map((repo) => (
            <Card key={repo.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl truncate">{repo.name}</CardTitle>
                  <div className="flex items-center">
                    {repo.visibility === "public" ? (
                      <Eye className="h-4 w-4 text-green-500 mr-1" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-amber-500 mr-1" />
                    )}
                    <span className="text-xs capitalize">
                      {repo.visibility}
                    </span>
                  </div>
                </div>
                <CardDescription className="line-clamp-2 h-10">
                  {repo.description || "No description provided"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground">
                  <GitBranch className="h-4 w-4 mr-1" />
                  <span>Default branch: {repo.default_branch}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Updated: {formatDate(repo.updated_at)}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="default"
                  onClick={() => handleDeploy(repo)}
                >
                  Deploy
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  asChild
                >
                  <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <GitBranch className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No repositories found</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            {searchQuery
              ? `No repositories matching "${searchQuery}"`
              : "We couldn't find any GitHub repositories. Make sure you have repositories on your GitHub account."}
          </p>
          {searchQuery && (
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          )}
        </div>
      )}
    </div>
  );
} 