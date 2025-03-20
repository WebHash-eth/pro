"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ExternalLink, FileCode, Globe, Search, Server, ArrowLeft, LinkIcon } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ConnectDomainModal } from "@/app/components/domains/connect-domain-modal";
import { RainbowWalletProvider } from "@/app/components/wallet/rainbow-wallet-provider";
import { Badge } from "@/components/ui/badge";

interface Deployment {
  _id: string;
  userId: string;
  repositoryName: string;
  repositoryFullName: string;
  branch: string;
  cid: string;
  gatewayUrl: string;
  projectType: string;
  status: 'success' | 'failed';
  createdAt: string;
  sizeInMB?: string;
  buildCommand?: string;
  outputDirectory?: string;
  connectedDomains?: string[];
}

interface EnsDomain {
  _id: string;
  domainName: string;
  walletAddress: string;
  isConnected: boolean;
  deploymentId?: string;
}

export default function RepositoryDeploymentsPage() {
  const router = useRouter();
  const params = useParams();

  // More robust approach to handle repository names with slashes
  // This handles multiple URL encoding scenarios that can occur in different environments
  const getRepoFullName = () => {
    // Handle different parameter formats
    let repoName = '';
    
    if (typeof params.repoFullName === 'string') {
      repoName = params.repoFullName;
      
      // Handle double-encoded slashes (can happen in some environments)
      repoName = repoName.replace(/%252F/g, '/');
      
      // Handle single-encoded slashes (most common case)
      repoName = repoName.replace(/%2F/g, '/');
      
      // Decode the entire string to handle any other encoded characters
      try {
        repoName = decodeURIComponent(repoName);
      } catch (e) {
        console.error("Error decoding repository name:", e);
      }
    } else if (Array.isArray(params.repoFullName)) {
      // In some Next.js configurations, the param might be an array
      repoName = params.repoFullName.join('/');
    }
    
    console.log("Decoded repository name:", repoName);
    return repoName;
  };
  
  const repoFullName = getRepoFullName();
  
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [filteredDeployments, setFilteredDeployments] = useState<Deployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const deploymentsPerPage = 6;
  const [showConnectDomainModal, setShowConnectDomainModal] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [connectedDomainsMap, setConnectedDomainsMap] = useState<{[deploymentId: string]: EnsDomain[]}>({});

  useEffect(() => {
    fetchDeployments();
  }, [repoFullName]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredDeployments(deployments);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredDeployments(
        deployments.filter(
          (deployment) =>
            deployment.branch.toLowerCase().includes(query) ||
            deployment.cid.toLowerCase().includes(query) ||
            deployment.status.toLowerCase().includes(query) ||
            (deployment.buildCommand && deployment.buildCommand.toLowerCase().includes(query))
        )
      );
    }
    setCurrentPage(1);
  }, [searchQuery, deployments]);

  const fetchConnectedDomains = async (deploymentId: string) => {
    try {
      const response = await fetch(`/api/ens-domains?deploymentId=${deploymentId}`);
      
      if (!response.ok) {
        console.error(`Error fetching connected domains: ${response.status} ${response.statusText}`);
        return [];
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching connected domains:", error);
      return [];
    }
  };

  const fetchDeployments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/deployments?repository=${encodeURIComponent(repoFullName)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch deployments");
      }
      const data = await response.json();
      const deploymentsArray = Array.isArray(data) ? data : [];
      
      // Sort deployments by creation date (newest first)
      deploymentsArray.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setDeployments(deploymentsArray);
      setFilteredDeployments(deploymentsArray);

      // Fetch connected domains for each deployment
      const domainsMap: {[deploymentId: string]: EnsDomain[]} = {};
      
      // Fetch domains for each deployment
      await Promise.all(
        deploymentsArray.map(async (deployment) => {
          if (deployment.status === 'success') {
            const domains = await fetchConnectedDomains(deployment._id);
            if (domains && domains.length > 0) {
              domainsMap[deployment._id] = domains;
            }
          }
        })
      );
      
      setConnectedDomainsMap(domainsMap);
    } catch (error) {
      console.error("Error fetching deployments:", error);
      toast.error("Failed to load deployments");
      setDeployments([]);
      setFilteredDeployments([]);
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

  const handleOpenConnectDomainModal = (deployment: Deployment) => {
    setSelectedDeployment(deployment);
    setShowConnectDomainModal(true);
  };

  const handleCloseConnectDomainModal = () => {
    setShowConnectDomainModal(false);
    setSelectedDeployment(null);
  };

  const refreshDeploymentDomains = async () => {
    if (selectedDeployment) {
      const domains = await fetchConnectedDomains(selectedDeployment._id);
      const updatedDomainsMap = { ...connectedDomainsMap };
      updatedDomainsMap[selectedDeployment._id] = domains;
      setConnectedDomainsMap(updatedDomainsMap);
    }
  };

  // Get current deployments for pagination
  const indexOfLastDeployment = currentPage * deploymentsPerPage;
  const indexOfFirstDeployment = indexOfLastDeployment - deploymentsPerPage;
  const currentDeployments = filteredDeployments.slice(indexOfFirstDeployment, indexOfLastDeployment);

  // Calculate total pages
  const totalPages = Math.ceil(filteredDeployments.length / deploymentsPerPage);

  // Generate page numbers
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

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

  // Extract repository name from full name (e.g., "Rahamthunisa/recipe-app" -> "recipe-app")
  const repositoryName = repoFullName.split('/').pop() || '';

  return (
    <RainbowWalletProvider>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-0 h-8 w-8" 
                onClick={() => router.push('/dashboard/deployments')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-3xl font-bold">{repositoryName}</h1>
            </div>
            <p className="text-muted-foreground ml-8">
              {repoFullName} • {deployments.length} deployments
            </p>
          </div>
          <div className="w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search deployments..."
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
        ) : filteredDeployments.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentDeployments.map((deployment) => (
                <Card key={deployment._id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-xl truncate">
                        {deployment.branch}
                      </CardTitle>
                      <div className="flex items-center space-x-1">
                        {getProjectTypeIcon(deployment.projectType)}
                        <span className="text-xs capitalize">
                          {deployment.projectType}
                        </span>
                      </div>
                    </div>
                    <CardDescription className="truncate">
                      {deployment.cid.substring(0, 16)}...
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span
                          className={`font-medium ${
                            deployment.status === "success"
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                        >
                          {deployment.status === "success" ? "Success" : "Failed"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Deployed:</span>
                        <span>{formatDate(deployment.createdAt)}</span>
                      </div>
                      {deployment.sizeInMB && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Size:</span>
                          <span>{deployment.sizeInMB} MB</span>
                        </div>
                      )}
                      <div className="flex justify-between items-start">
                        <span className="text-muted-foreground">Domains:</span>
                        <div className="flex flex-col items-end">
                          {connectedDomainsMap[deployment._id] && connectedDomainsMap[deployment._id].length > 0 ? (
                            <div className="space-y-1">
                              {connectedDomainsMap[deployment._id].map((domain) => (
                                <div key={domain._id} className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xs px-1 py-0">
                                    {domain.domainName}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4"
                                    asChild
                                  >
                                    <a
                                      href={`https://${domain.domainName}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Visit domain"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between pt-2">
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => router.push(`/dashboard/deployments/${deployment._id}`)}
                      >
                        View Details
                      </Button>
                      {deployment.status === "success" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenConnectDomainModal(deployment)}
                        >
                          <LinkIcon className="h-4 w-4 mr-1" />
                          Connect Domain
                        </Button>
                      )}
                    </div>
                    {deployment.status === "success" && (
                      <Button
                        variant="outline"
                        size="icon"
                        asChild
                      >
                        <a
                          href={deployment.gatewayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open deployment"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
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
                            onClick={() => setCurrentPage(number)}
                            isActive={currentPage === number}
                          >
                            {number}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    }
                    
                    // Show ellipsis for skipped pages
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
            <h2 className="mt-4 text-xl font-semibold">No deployments found</h2>
            <p className="mt-2 text-muted-foreground">
              {searchQuery ? "Try a different search term" : "This repository has no deployments yet"}
            </p>
          </div>
        )}
        {showConnectDomainModal && selectedDeployment && (
          <ConnectDomainModal
            isOpen={showConnectDomainModal}
            onClose={handleCloseConnectDomainModal}
            deploymentId={selectedDeployment._id}
            deploymentCid={selectedDeployment.cid}
            onRefresh={refreshDeploymentDomains}
          />
        )}
      </div>
    </RainbowWalletProvider>
  );
}
