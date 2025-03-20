"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, Globe, LinkIcon, Unlink, Trash2, Plus, AlertTriangle, AlertCircle } from "lucide-react";
import { RainbowWalletProvider, useEnhancedWallet } from "@/app/components/wallet/rainbow-wallet-provider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletConnectButton } from "@/app/components/wallet/wallet-connect-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DisconnectButton } from "@/app/components/wallet/disconnect-button";
import { getNamehash } from "@/app/lib/ens";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EnsDomain {
  _id: string;
  domainName: string;
  walletAddress: string;
  isConnected: boolean;
  deploymentId?: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
  network: string;
}

interface Deployment {
  _id: string;
  repositoryName: string;
  cid: string;
  gatewayUrl: string;
}

function DomainsPageContent() {
  const router = useRouter();
  const { isConnected, walletAddress, chainId, isMainnet, chainName } = useEnhancedWallet();
  const [domains, setDomains] = useState<EnsDomain[]>([]);
  const [deployments, setDeployments] = useState<Record<string, Deployment>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredDomains, setFilteredDomains] = useState<EnsDomain[]>([]);
  const [domainToDisconnect, setDomainToDisconnect] = useState<EnsDomain | null>(null);

  useEffect(() => {
    fetchDomains();
  }, [walletAddress, isConnected]);

  // Add a new useEffect to clear domains when wallet is disconnected
  useEffect(() => {
    if (!isConnected) {
      setDomains([]);
      setFilteredDomains([]);
    }
  }, [isConnected]);

  useEffect(() => {
    if (searchQuery) {
      setFilteredDomains(
        domains.filter(
          (domain) =>
            domain.domainName.includes(searchQuery) ||
            domain.walletAddress.toLowerCase().includes(searchQuery)
        )
      );
    } else {
      setFilteredDomains(domains);
    }
  }, [searchQuery, domains]);

  const fetchDomains = async () => {
    if (!isConnected || !walletAddress) {
      setDomains([]);
      setFilteredDomains([]);
      return;
    }

    setIsLoading(true);
    try {
      console.log(`Fetching domains for wallet: ${walletAddress}`);
      
      // Add a delay to ensure the loading state is visible
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const response = await fetch(`/api/ens-domains?walletAddress=${walletAddress}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch domains: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Domains fetched:", data);
      
      if (Array.isArray(data)) {
        setDomains(data);
        setFilteredDomains(data);
      } else {
        console.error("Invalid domains data format:", data);
        toast.error("Failed to load domains: Invalid data format");
        setDomains([]);
        setFilteredDomains([]);
      }
    } catch (error: unknown) {
      console.error("Error fetching domains:", error);
      toast.error(`Failed to load domains: ${error instanceof Error ? error.message : String(error)}`);
      setDomains([]);
      setFilteredDomains([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDeploymentDetails = async (deploymentIds: string[]) => {
    try {
      const deploymentDetails: Record<string, Deployment> = {};
      
      for (const id of deploymentIds) {
        if (id) {
          const response = await fetch(`/api/deployments?id=${id}`);
          if (response.ok) {
            const deployment = await response.json();
            deploymentDetails[id] = deployment;
          }
        }
      }
      
      setDeployments(deploymentDetails);
    } catch (error) {
      console.error("Error fetching deployment details:", error);
    }
  };

  const handleDisconnectDomain = async () => {
    if (!domainToDisconnect) return;

    try {
      const response = await fetch("/api/deployments/disconnect-domain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domainId: domainToDisconnect._id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect domain");
      }

      toast.success(`Domain ${domainToDisconnect.domainName} disconnected`);
      
      // Refresh the domains list
      if (isConnected && walletAddress) {
        fetchDomains();
      } else {
        // If wallet is disconnected, clear the domains
        setDomains([]);
        setFilteredDomains([]);
      }
    } catch (error) {
      console.error("Error disconnecting domain:", error);
      toast.error("Failed to disconnect domain");
    } finally {
      setDomainToDisconnect(null);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">ENS Domains</h1>
        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button 
                variant="outline" 
                onClick={fetchDomains} 
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Refreshing...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Domains
                  </span>
                )}
              </Button>
              <DisconnectButton />
            </>
          ) : (
            <WalletConnectButton />
          )}
        </div>
      </div>
      
      {/* Network warning - update the condition to check for Ethereum Mainnet */}
      {isConnected && !isMainnet && (
        <Alert variant="default" className="bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertTitle>Wrong Network</AlertTitle>
          <AlertDescription>
            Please switch to Ethereum Mainnet to view and manage your ENS domains.
          </AlertDescription>
        </Alert>
      )}
      
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="pb-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-9 rounded-md" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : filteredDomains.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDomains.map((domain) => {
            const deployment = domain.deploymentId ? deployments[domain.deploymentId] : null;
            
            return (
              <Card key={domain._id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl truncate">
                      {domain.domainName}
                    </CardTitle>
                    <Badge variant={domain.isConnected ? "default" : "outline"}>
                      {domain.isConnected ? "Connected" : "Not Connected"}
                    </Badge>
                  </div>
                  <CardDescription className="truncate">
                    {domain.walletAddress}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Network:</span>
                      <span className="font-medium capitalize">{domain.network}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Added:</span>
                      <span>{formatDate(domain.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Updated:</span>
                      <span>{formatDate(domain.lastSyncedAt)}</span>
                    </div>
                    {domain.isConnected && deployment && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Deployment:</span>
                        <span className="font-medium truncate max-w-[150px]">
                          {deployment.repositoryName}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-2">
                  {domain.isConnected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDomainToDisconnect(domain)}
                      className="w-full"
                    >
                      <Unlink className="h-4 w-4 mr-2" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/dashboard/deployments")}
                      className="w-full"
                    >
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Connect
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Domains Found</CardTitle>
            <CardDescription>
              {isConnected
                ? isMainnet 
                  ? "No ENS domains were found for your wallet. Please make sure you're connected with the correct wallet."
                  : "Please switch to Ethereum Mainnet to view and manage your ENS domains."
                : "Connect your wallet to view your ENS domains."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {isConnected && isMainnet
                ? "We couldn't find any ENS domains associated with your wallet address. If you believe this is an error, try refreshing or check your wallet connection."
                : isConnected
                ? "ENS domains are only available on the Ethereum Mainnet. Please switch networks using your wallet."
                : "You need to connect your Ethereum wallet to manage ENS domains."}
            </p>
            
            {isConnected && isMainnet && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  We're having trouble detecting your ENS domains. This could be due to network issues or RPC limitations. Try refreshing or reconnecting your wallet.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-2">
            {isConnected ? (
              <>
                <Button variant="default" onClick={fetchDomains} disabled={isLoading}>
                  {isLoading ? "Refreshing..." : "Refresh Domains"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.open('https://app.ens.domains', '_blank')}
                >
                  Visit ENS App
                </Button>
              </>
            ) : (
              <WalletConnectButton />
            )}
          </CardFooter>
        </Card>
      )}

      {/* Disconnect Domain Dialog */}
      <AlertDialog open={!!domainToDisconnect} onOpenChange={(open) => !open && setDomainToDisconnect(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Domain</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect {domainToDisconnect?.domainName}? This will not affect the ENS records on the blockchain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnectDomain}>Disconnect</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

export default function DomainsPage() {
  return (
    <RainbowWalletProvider>
      <DomainsPageContent />
    </RainbowWalletProvider>
  );
} 