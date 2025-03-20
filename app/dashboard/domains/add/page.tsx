"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { RainbowWalletProvider, useEnhancedWallet } from "@/app/components/wallet/rainbow-wallet-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getNamehash } from "@/app/lib/ethereum";
import { WalletConnectButton } from "@/app/components/wallet/wallet-connect-button";
import { DisconnectButton } from "@/app/components/wallet/disconnect-button";

function AddDomainContent() {
  const router = useRouter();
  const { isConnected, walletAddress, isMainnet, chainName } = useEnhancedWallet();
  const [domainName, setDomainName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!isConnected || !walletAddress) {
      setError("Please connect your wallet first");
      setIsLoading(false);
      return;
    }

    if (!isMainnet) {
      setError("Please switch to Ethereum Mainnet to add ENS domains");
      setIsLoading(false);
      return;
    }

    if (!domainName.endsWith(".eth")) {
      setError("Domain name must end with .eth");
      setIsLoading(false);
      return;
    }

    try {
      // Try to get the namehash to validate the domain format
      try {
        getNamehash(domainName);
      } catch (error) {
        throw new Error("Invalid ENS domain format");
      }

      // Add the domain to our database
      const response = await fetch("/api/ens-domains", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domainName,
          walletAddress,
          network: "mainnet", // Use Ethereum Mainnet
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add domain");
      }

      toast.success(`Domain ${domainName} added successfully!`);
      router.push("/dashboard/domains");
    } catch (error: any) {
      console.error("Error adding domain:", error);
      setError(error.message || "Failed to add domain");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Add ENS Domain</h1>
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      {!isMainnet && isConnected && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You are connected to {chainName}. Please switch to Ethereum Mainnet to add ENS domains.
          </AlertDescription>
        </Alert>
      )}

      <Card className="max-w-md mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Add ENS Domain</CardTitle>
            <CardDescription>
              Add an ENS domain that you own to connect it to your deployments.
            </CardDescription>
          </div>
          {isConnected && <DisconnectButton variant="outline" size="sm" />}
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <div className="space-y-4">
              <p className="text-sm">
                Connect your wallet to add an ENS domain.
              </p>
              <div className="flex justify-center">
                <WalletConnectButton />
              </div>
            </div>
          ) : (
            <form onSubmit={handleAddDomain} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domainName">Domain Name</Label>
                <Input
                  id="domainName"
                  placeholder="yourdomain.eth"
                  value={domainName}
                  onChange={(e) => setDomainName(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the full ENS domain name, including .eth
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="walletAddress">Wallet Address</Label>
                <Input
                  id="walletAddress"
                  value={walletAddress || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Your connected wallet address
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.push("/dashboard/domains")} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !isMainnet}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Domain...
              </>
            ) : (
              "Add Domain"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function AddDomainPage() {
  return (
    <RainbowWalletProvider>
      <AddDomainContent />
    </RainbowWalletProvider>
  );
} 