"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Calendar, Clock, Code, Copy, ExternalLink, FileCode, Globe, HardDrive, Server, LinkIcon, AlertTriangle, Unlink } from "lucide-react";
import { RainbowWalletProvider, useEnhancedWallet } from "@/app/components/wallet/rainbow-wallet-provider";
import { ConnectDomainModal } from "@/app/components/domains/connect-domain-modal";
import { Badge } from "@/components/ui/badge";
import { DisconnectButton } from "@/app/components/wallet/disconnect-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WalletConnectButton } from "@/app/components/wallet/wallet-connect-button";
import DeploymentLogs from "@/app/components/DeploymentLogs";

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
  updatedAt: string;
  sizeInMB?: string;
  buildCommand?: string;
  outputDirectory?: string;
  error?: string;
  connectedDomains?: string[];
  deploymentId?: string;
  accessUrls?: Record<string, string>;
}

interface EnsDomain {
  _id: string;
  domainName: string;
  walletAddress: string;
  isConnected: boolean;
  deploymentId?: string;
}

export default function DeploymentDetailsPage() {
  const router = useRouter();
  const [deploymentId, setDeploymentId] = useState<string>("");
  
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [connectedDomains, setConnectedDomains] = useState<EnsDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<'success' | 'error' | null>(null);
  const [showConnectDomainModal, setShowConnectDomainModal] = useState(false);
  const [isDisconnectingDomain, setIsDisconnectingDomain] = useState(false);
  const { isConnected, walletAddress, isMainnet, chainName, chainId } = useEnhancedWallet();

  useEffect(() => {
    const path = window.location.pathname;
    const pathParts = path.split('/');
    const id = pathParts[pathParts.length - 1];
    
    if (id) {
      setDeploymentId(id);
    }
  }, []);

  useEffect(() => {
    if (deploymentId) {
      fetchDeploymentDetails();
    }
  }, [deploymentId]);

  const fetchDeploymentDetails = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/deployments/${deploymentId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch deployment: ${response.statusText}`);
      }
      
      const data = await response.json();
      setDeployment(data);
      
      // Set initial deployment status based on the deployment data
      if (data.status === 'completed' || data.status === 'success') {
        setDeploymentStatus('success');
      } else if (data.status === 'failed') {
        setDeploymentStatus('error');
      }
      
      // Fetch connected domains
      if (data._id) {
        await fetchConnectedDomains(data._id);
      }
    } catch (error: any) {
      console.error("Error fetching deployment:", error);
      setError(error.message || "Failed to fetch deployment");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConnectedDomains = async (deploymentId: string) => {
    try {
      const response = await fetch(`/api/ens-domains?deploymentId=${deploymentId}`);
      
      if (!response.ok) {
        console.error(`Error fetching connected domains: ${response.status} ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      setConnectedDomains(data);
    } catch (error) {
      console.error("Error fetching connected domains:", error);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text);
    toast.success(message);
  };

  const getProjectTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case "react":
        return <FileCode className="h-5 w-5 text-blue-500" />;
      case "static":
        return <Globe className="h-5 w-5 text-green-500" />;
      default:
        return <Server className="h-5 w-5 text-purple-500" />;
    }
  };

  const refreshDeploymentData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/deployment?id=${deploymentId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch deployment");
      }
      const data = await response.json();
      setDeployment(data);
      
      // Also refresh connected domains
      await fetchConnectedDomains(data._id);
    } catch (error) {
      console.error("Error refreshing deployment data:", error);
      toast.error("Failed to refresh deployment data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectDomain = async (domainId: string, domainName: string) => {
    try {
      setIsDisconnectingDomain(true);
      
      const response = await fetch("/api/deployments/disconnect-domain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domainId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect domain");
      }

      toast.success(`Domain ${domainName} disconnected`);
      
      // Refresh the deployment data
      refreshDeploymentData();
    } catch (error) {
      console.error("Error disconnecting domain:", error);
      toast.error("Failed to disconnect domain");
    } finally {
      setIsDisconnectingDomain(false);
    }
  };

  const handleLogsComplete = (success: boolean) => {
    console.log(`Deployment logs complete with status: ${success ? 'success' : 'error'}`);
    
    // Only update the status if it's not already set to success
    // This prevents a successful deployment from being marked as failed
    if (deploymentStatus !== 'success') {
      setDeploymentStatus(success ? 'success' : 'error');
    }
    
    // Update the deployment status in the database if it's not already set
    if (deployment && !['completed', 'failed', 'success'].includes(deployment.status)) {
      fetch(`/api/deployments/${deploymentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: success ? 'completed' : 'failed',
        }),
      })
        .then(response => {
          if (!response.ok) {
            console.error('Failed to update deployment status');
          } else {
            console.log('Deployment status updated successfully');
            // Refresh the deployment data
            fetchDeploymentDetails();
          }
        })
        .catch(error => {
          console.error('Error updating deployment status:', error);
        });
    }
  };

  return (
    <RainbowWalletProvider>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Deployment Details</h1>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Card className="animate-pulse">
              <CardHeader className="h-24 bg-muted/50"></CardHeader>
              <CardContent className="h-40 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </CardContent>
            </Card>
          </div>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>
                There was a problem loading the deployment details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">{error}</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" onClick={() => router.back()}>
                Go Back
              </Button>
            </CardFooter>
          </Card>
        ) : deployment ? (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl">{deployment.repositoryName}</CardTitle>
                    <CardDescription>{deployment.repositoryFullName}</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getProjectTypeIcon(deployment.projectType)}
                    <span className="text-sm capitalize">{deployment.projectType}</span>
                    <Badge variant={deployment.status === "success" ? "default" : "destructive"}>
                      {deployment.status === "success" ? "Success" : "Failed"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Deployment Information</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-muted-foreground">Repository:</div>
                        <div>{deployment.repositoryFullName}</div>
                        <div className="text-muted-foreground">Branch:</div>
                        <div>{deployment.branch}</div>
                        <div className="text-muted-foreground">Deployed:</div>
                        <div>{formatDate(deployment.createdAt)}</div>
                        <div className="text-muted-foreground">Project Type:</div>
                        <div className="flex items-center">
                          {getProjectTypeIcon(deployment.projectType)}
                          <span className="ml-1 capitalize">{deployment.projectType}</span>
                        </div>
                        {deployment.sizeInMB && (
                          <>
                            <div className="text-muted-foreground">Size:</div>
                            <div>{deployment.sizeInMB} MB</div>
                          </>
                        )}
                        {deployment.buildCommand && (
                          <>
                            <div className="text-muted-foreground">Build Command:</div>
                            <div className="font-mono text-xs bg-muted p-1 rounded">
                              {deployment.buildCommand}
                            </div>
                          </>
                        )}
                        {deployment.outputDirectory && (
                          <>
                            <div className="text-muted-foreground">Output Directory:</div>
                            <div>{deployment.outputDirectory}</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">IPFS Information</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">CID:</span>
                          <div className="flex items-center">
                            <code 
                              className="text-xs bg-muted p-1 rounded max-w-[200px] truncate cursor-pointer hover:bg-muted/80 transition-colors"
                              onClick={() => copyToClipboard(deployment.cid, "CID copied to clipboard")}
                              title="Click to copy"
                            >
                              {deployment.cid}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(deployment.cid, "CID copied to clipboard")}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Gateway URL:</span>
                          <div className="flex items-center">
                            <code 
                              className="text-xs bg-muted p-1 rounded max-w-[200px] truncate cursor-pointer hover:bg-muted/80 transition-colors"
                              onClick={() => copyToClipboard(deployment.gatewayUrl, "Gateway URL copied to clipboard")}
                              title="Click to copy"
                            >
                              {deployment.gatewayUrl}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(deployment.gatewayUrl, "Gateway URL copied to clipboard")}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Connected Domains</h3>
                      
                      <div className="space-y-4">
                        {connectedDomains.length > 0 ? (
                          <div className="space-y-2">
                            {connectedDomains.map((domain) => (
                              <div key={domain._id} className="flex justify-between items-center p-2 bg-muted rounded-md">
                                <div className="flex items-center">
                                  <Globe className="h-4 w-4 mr-2 text-primary" />
                                  <span className="font-medium">{domain.domainName}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
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
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                    onClick={() => handleDisconnectDomain(domain._id, domain.domainName)}
                                    disabled={isDisconnectingDomain}
                                    title="Disconnect domain"
                                  >
                                    <Unlink className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-md text-center">
                            No domains connected to this deployment.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col space-y-2">
                      <Button asChild>
                        <a
                          href={deployment.gatewayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Visit Deployment
                        </a>
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        onClick={() => setShowConnectDomainModal(true)}
                      >
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Connect ENS Domain
                      </Button>
                      
                      <Button variant="outline" onClick={() => router.push("/dashboard/deployments")}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Deployments
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {deployment.error && (
              <Card className="border-destructive">
                <CardHeader className="pb-2">
                  <CardTitle className="text-destructive">Deployment Error</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
                    {deployment.error}
                  </pre>
                </CardContent>
              </Card>
            )}
            
            {/* Deployment Logs */}
            <Card>
              <CardHeader>
                <CardTitle>Deployment Logs</CardTitle>
                <CardDescription>
                  Real-time logs for this deployment
                </CardDescription>
              </CardHeader>
              <CardContent>
                {deployment && (
                  <DeploymentLogs 
                    deploymentId={deployment._id.toString()} 
                    useEmbeddedLogs={true}
                    onLogsComplete={handleLogsComplete}
                    withoutCard={true}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Deployment Not Found</CardTitle>
              <CardDescription>
                The deployment you're looking for doesn't exist or you don't have access to it.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={() => router.push("/dashboard/deployments")}>
                View All Deployments
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Connect Domain Modal */}
        {deployment && (
          <ConnectDomainModal
            isOpen={showConnectDomainModal}
            onClose={() => setShowConnectDomainModal(false)}
            deploymentId={deployment._id}
            deploymentCid={deployment.cid}
            onRefresh={refreshDeploymentData}
          />
        )}
      </div>
    </RainbowWalletProvider>
  );
} 