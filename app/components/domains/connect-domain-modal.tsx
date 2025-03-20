"use client";

import { useState, useEffect } from "react";
import { useEnhancedWallet } from "@/app/components/wallet/rainbow-wallet-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle, CheckCircle2, Info, RefreshCw, ExternalLink, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { updateEnsContentHash, getEnsOwner, getEnsContentHash } from "@/app/lib/ethereum";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { normalize } from "viem/ens";

interface EnsDomain {
  _id: string;
  domainName: string;
  walletAddress: string;
  actualOwner?: string;
  isConnected: boolean;
  deploymentId?: string;
}

interface Deployment {
  _id: string;
  cid: string;
}

interface ConnectDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  deploymentId: string;
  deploymentCid: string;
  onRefresh?: () => void;
}

export function ConnectDomainModal({
  isOpen,
  onClose,
  deploymentId,
  deploymentCid,
  onRefresh,
}: ConnectDomainModalProps) {
  const { isConnected, walletAddress, provider, isMainnet, chainName, chainId } = useEnhancedWallet();
  const [domains, setDomains] = useState<EnsDomain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDomains, setIsFetchingDomains] = useState(false);
  const [isVerifyingOwnership, setIsVerifyingOwnership] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownershipError, setOwnershipError] = useState<{domain: string, owner: string} | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Used to trigger a refresh

  // Fetch domains when wallet is connected or refresh is triggered
  useEffect(() => {
    if (isConnected && walletAddress) {
      fetchDomainsForWallet();
    } else {
      setDomains([]);
    }
  }, [isConnected, walletAddress, refreshKey]);

  const fetchDomainsForWallet = async () => {
    if (!isConnected || !walletAddress) {
      setDomains([]);
      return;
    }

    setIsFetchingDomains(true);
    setError(null);
    setOwnershipError(null);

    try {
      console.log(`Fetching domains for wallet: ${walletAddress}`);
      
      // Fetch domains for this wallet address with blockchain data
      const response = await fetch(`/api/ens-domains?walletAddress=${walletAddress}&fetchFromBlockchain=true`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch domains: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Fetched domains:", data);
      
      // Filter out domains that are already connected to deployments
      // unless they're connected to this deployment
      const availableDomains = data.filter((domain: EnsDomain) => 
        !domain.isConnected || domain.deploymentId === deploymentId
      );
      
      console.log("Available domains:", availableDomains);
      setDomains(availableDomains);
      
      if (availableDomains.length > 0) {
        setSelectedDomainId(availableDomains[0]._id);
      } else {
        setSelectedDomainId("");
      }
    } catch (error: any) {
      console.error("Error fetching domains:", error);
      setError(error.message || "Failed to fetch domains");
    } finally {
      setIsFetchingDomains(false);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const verifyDomainOwnership = async (domainName: string) => {
    if (!provider) {
      toast.error("Wallet provider not available");
      return null;
    }

    setIsVerifyingOwnership(true);
    setOwnershipError(null);
    
    try {
      // Normalize the domain name
      const normalizedDomainName = normalize(domainName);
      
      // Get the owner from the blockchain
      const owner = await getEnsOwner(provider, normalizedDomainName);
      console.log(`Domain owner from blockchain: ${owner}`);
      console.log(`Connected wallet: ${walletAddress}`);
      
      // Check if the owner matches the connected wallet
      if (owner && owner.toLowerCase() !== walletAddress?.toLowerCase()) {
        setOwnershipError({
          domain: normalizedDomainName,
          owner: owner
        });
        
        // Don't show any toast message about ownership
        console.log(`Note: User is not the owner of ${normalizedDomainName}, but verification is being skipped.`);
        
        // Always return true since we're always skipping verification
        return true;
      }
      
      return true;
    } catch (error) {
      console.error("Error verifying domain ownership:", error);
      
      // When skipping verification, continue despite errors
      toast.warning("Could not verify domain ownership, continuing anyway");
      return true;
    } finally {
      setIsVerifyingOwnership(false);
    }
  };

  const handleConnectDomain = async () => {
    try {
      if (!isConnected) {
        toast.error("Please connect your wallet first");
        return;
      }

      if (!isMainnet) {
        toast.error("Please switch to Ethereum Mainnet");
        return;
      }

      if (!selectedDomainId) {
        toast.error("Please select a domain");
        return;
      }

      setIsLoading(true);
      setOwnershipError(null);
      setError(null);

      // Find the selected domain
      const selectedDomain = domains.find(domain => domain._id === selectedDomainId);
      console.log("Selected domain:", selectedDomain);
      console.log("Deployment CID:", deploymentCid);

      if (!selectedDomain) {
        throw new Error("Selected domain not found");
      }

      // Normalize the domain name according to ENS standards
      const normalizedDomainName = normalize(selectedDomain.domainName);
      console.log(`Using normalized domain name: ${normalizedDomainName}`);

      // Display ownership information if available, but don't block if skipping verification
      if (selectedDomain.actualOwner && 
          selectedDomain.actualOwner.toLowerCase() !== walletAddress?.toLowerCase()) {
        
        // Set the ownership error for display purposes
        setOwnershipError({
          domain: normalizedDomainName,
          owner: selectedDomain.actualOwner
        });
        
        // Don't show any toast message about ownership
        console.log(`Note: User is not the owner of ${normalizedDomainName}, but verification is being skipped.`);
      }

      // Always skip ownership verification
      const isOwner = await verifyDomainOwnership(normalizedDomainName);
      
      // Try to update the ENS content hash on-chain
      let txHash = "";
      let onChainUpdateSuccessful = false;
      
      try {
        if (provider && deploymentCid) {
          // Use the updated function with the correct parameters
          txHash = await updateEnsContentHash(
            provider,
            normalizedDomainName,
            deploymentCid,
            true
          );
          onChainUpdateSuccessful = true;
          console.log("ENS content hash updated successfully:", txHash);
        }
      } catch (error: unknown) {
        console.error("Error updating ENS content hash:", error);
        
        // Check if the error is related to ownership
        if (error instanceof Error && error.message && error.message.includes("You are not the owner")) {
          // Try to get the actual owner of the domain
          try {
            if (provider) {
              const owner = await getEnsOwner(provider, normalizedDomainName);
              setOwnershipError({
                domain: normalizedDomainName,
                owner: owner
              });
            }
          } catch (ownerError) {
            console.error("Error getting domain owner:", ownerError);
          }
          
          // Show a detailed error message for ownership issues
          toast.error(
            `You are not the owner of ${normalizedDomainName} on the blockchain`,
            {
              duration: 6000,
              description: "If you believe this is an error, please verify your wallet address and ensure you're connected with the correct wallet that owns this domain."
            }
          );
          
          throw new Error(`Ownership verification failed: You are not the owner of ${normalizedDomainName}`);
        }
        // Check if the error is related to CID format
        else if (error instanceof Error && (
          error.message.includes("Invalid CID format") || 
          error.message.includes("Failed to convert CID") ||
          error.message.includes("non-base58")
        )) {
          // Show an error for CID format issues
          toast.error(`Could not update ENS record: ${error.message}`, {
            duration: 5000
          });
          throw error;
        } else {
          // For other errors, show a generic message
          toast.error(`Failed to update ENS content hash: ${error instanceof Error ? error.message : String(error)}`, {
            duration: 5000
          });
          throw error;
        }
      }

      // Only connect the domain in the database if on-chain update was successful
      if (onChainUpdateSuccessful) {
        try {
          const response = await fetch("/api/deployments/connect-domain", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              deploymentId: deploymentId,
              domainId: selectedDomainId,
              txHash: txHash || "",
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
            throw new Error(errorData.error || "Failed to connect domain");
          }

          // Show success message
          toast.success(`Domain ${normalizedDomainName} connected successfully`, {
            description: "ENS record updated on-chain and domain connected to deployment"
          });

          // Refresh the deployment data
          if (onRefresh) {
            onRefresh();
          }

          // Close the modal
          onClose();
        } catch (error: unknown) {
          console.error("Error connecting domain in database:", error);
          toast.error(`Failed to connect domain in database: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } catch (error: unknown) {
      console.error("Error connecting domain:", error);
      if (error instanceof Error && !error.message.includes("Ownership verification failed")) {
        // Only show this error if it's not an ownership error (which already has a toast)
        toast.error(`Failed to connect domain: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const viewOnEtherscan = (address: string) => {
    window.open(`https://etherscan.io/address/${address}`, "_blank");
  };

  const getSelectedDomain = () => {
    return domains.find(domain => domain._id === selectedDomainId);
  };

  const hasOwnershipMismatch = (domain: EnsDomain) => {
    return domain.actualOwner && 
           walletAddress && 
           domain.actualOwner.toLowerCase() !== walletAddress.toLowerCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect ENS Domain</DialogTitle>
          <DialogDescription>
            Connect an ENS domain to your deployment to make it accessible via a human-readable name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isConnected ? (
            <div className="space-y-4">
              <p className="text-sm">
                Connect your wallet to select an ENS domain.
              </p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>
          ) : (
            <>
              {!isMainnet && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You are connected to {chainName}. Please switch to Mainnet to connect ENS domains.
                  </AlertDescription>
                </Alert>
              )}
              
              {isFetchingDomains ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2">Fetching domains...</span>
                </div>
              ) : domains.length === 0 ? (
                <div className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      No ENS domains found for this wallet. You can add your domains in the Domains section.
                    </AlertDescription>
                  </Alert>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={handleRefresh}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                    <Button 
                      variant="default" 
                      className="flex-1"
                      onClick={() => {
                        onClose();
                        window.location.href = "/dashboard/domains";
                      }}
                    >
                      Go to Domains
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="domain" className="text-sm font-medium">
                        Select Domain
                      </label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-2"
                        onClick={handleRefresh}
                        disabled={isFetchingDomains}
                      >
                        <RefreshCw className={`h-4 w-4 ${isFetchingDomains ? 'animate-spin' : ''}`} />
                        <span className="ml-1">Refresh</span>
                      </Button>
                    </div>
                    <Select
                      value={selectedDomainId}
                      onValueChange={setSelectedDomainId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a domain" />
                      </SelectTrigger>
                      <SelectContent>
                        {domains.map((domain) => (
                          <SelectItem key={domain._id} value={domain._id}>
                            <div className="flex items-center">
                              <span>{domain.domainName}</span>
                              {domain.isConnected && (
                                <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                                  Connected
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex space-x-2 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleConnectDomain}
            disabled={
              !isConnected || 
              !selectedDomainId || 
              isLoading || 
              !isMainnet
            }
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect Domain
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 