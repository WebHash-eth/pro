"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ExternalLink, FileCode, Globe, Search, Server } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Deployment {
  _id: string;
  repositoryName: string;
  repositoryFullName: string;
  branch: string;
  cid: string;
  gatewayUrl: string;
  projectType: string;
  status: 'success' | 'failed';
  createdAt: string;
  sizeInMB?: string;
}

export default function DeploymentsPage() {
  const router = useRouter();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [repositories, setRepositories] = useState<{[key: string]: Deployment[]}>({});
  const [filteredRepositories, setFilteredRepositories] = useState<{[key: string]: Deployment[]}>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deploymentsPerPage] = useState(6);
  const [expandedRepositories, setExpandedRepositories] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    fetchDeployments();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredRepositories(repositories);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered: {[key: string]: Deployment[]} = {};
      
      Object.keys(repositories).forEach(repoFullName => {
        if (
          repoFullName.toLowerCase().includes(query) ||
          repositories[repoFullName][0].repositoryName.toLowerCase().includes(query) ||
          repositories[repoFullName][0].branch.toLowerCase().includes(query) ||
          repositories[repoFullName][0].projectType.toLowerCase().includes(query)
        ) {
          filtered[repoFullName] = repositories[repoFullName];
        }
      });
      
      setFilteredRepositories(filtered);
    }
    setCurrentPage(1);
  }, [searchQuery, repositories]);

  const fetchDeployments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/deployments");
      if (!response.ok) {
        throw new Error("Failed to fetch deployments");
      }
      const data = await response.json();
      const deploymentsArray = Array.isArray(data) ? data : [];
      
      // Group deployments by repository
      const groupedByRepo: {[key: string]: Deployment[]} = {};
      
      deploymentsArray.forEach((deployment) => {
        if (!groupedByRepo[deployment.repositoryFullName]) {
          groupedByRepo[deployment.repositoryFullName] = [];
        }
        groupedByRepo[deployment.repositoryFullName].push(deployment);
      });
      
      // Sort deployments within each repository by creation date (newest first)
      Object.keys(groupedByRepo).forEach((repo) => {
        groupedByRepo[repo].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      
      setRepositories(groupedByRepo);
      setFilteredRepositories(groupedByRepo);

      // Set loading to false
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching deployments:", error);
      toast.error("Failed to load deployments");
      setDeployments([]);
      setRepositories({});
      setFilteredRepositories({});
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getProjectTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "react":
        return <FileCode className="h-5 w-5 text-blue-500" />;
      case "static":
        return <Globe className="h-5 w-5 text-green-500" />;
      default:
        return <Server className="h-5 w-5 text-purple-500" />;
    }
  };

  // Get current repositories for pagination
  const repoNames = Object.keys(filteredRepositories);
  const indexOfLastRepo = currentPage * deploymentsPerPage;
  const indexOfFirstRepo = indexOfLastRepo - deploymentsPerPage;
  const currentRepoNames = repoNames.slice(indexOfFirstRepo, indexOfLastRepo);
  
  // Calculate total pages
  const totalPages = Math.ceil(repoNames.length / deploymentsPerPage);

  // Generate page numbers
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Repositories</h1>
          <p className="text-muted-foreground">
            View and manage your deployed repositories
          </p>
        </div>
        <div className="w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 pl-8"
            />
          </div>
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
      ) : repoNames.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentRepoNames.map((repoFullName) => {
              const repoDeployments = filteredRepositories[repoFullName];
              const latestDeployment = repoDeployments[0]; // Already sorted newest first
              const successfulDeployments = repoDeployments.filter(d => d.status === "success").length;
              const totalDeployments = repoDeployments.length;
              
              return (
                <Card key={repoFullName} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl truncate">
                        {latestDeployment.repositoryName}
                      </CardTitle>
                      <div className="flex items-center space-x-1">
                        {getProjectTypeIcon(latestDeployment.projectType)}
                        <span className="text-xs capitalize">
                          {latestDeployment.projectType}
                        </span>
                      </div>
                    </div>
                    <CardDescription className="truncate">
                      {repoFullName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Latest branch:</span>
                        <span className="font-medium">{latestDeployment.branch}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Deployments:</span>
                        <span className="font-medium">{totalDeployments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Success rate:</span>
                        <span className="font-medium">
                          {Math.round((successfulDeployments / totalDeployments) * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Latest deploy:</span>
                        <span>{formatDate(latestDeployment.createdAt)}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between pt-2">
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => router.push(`/dashboard/repositories/${encodeURIComponent(repoFullName)}`)}
                      >
                        View Deployments
                      </Button>
                    </div>
                    {latestDeployment.status === "success" && (
                      <Button
                        variant="outline"
                        size="icon"
                        asChild
                      >
                        <a
                          href={latestDeployment.gatewayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open latest deployment"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <Pagination className="mt-8">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    size="default"
                  />
                </PaginationItem>
                
                {pageNumbers.map((number) => {
                  // Show first page, last page, and pages around current page
                  if (
                    number === 1 ||
                    number === totalPages ||
                    (number >= currentPage - 1 && number <= currentPage + 1)
                  ) {
                    return (
                      <PaginationItem key={number}>
                        <PaginationLink
                          isActive={currentPage === number}
                          onClick={() => setCurrentPage(number)}
                          size="icon"
                        >
                          {number}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }
                  
                  // Show ellipsis for gaps
                  if (
                    (number === 2 && currentPage > 3) ||
                    (number === totalPages - 1 && currentPage < totalPages - 2)
                  ) {
                    return (
                      <PaginationItem key={number}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }
                  
                  return null;
                })}
                
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                    size="default"
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Server className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No repositories found</h2>
          <p className="mt-2 text-muted-foreground">
            {searchQuery ? "Try a different search term" : "Deploy your first repository to get started"}
          </p>
        </div>
      )}
    </div>
  );
}