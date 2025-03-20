"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Key, User, Wallet, ExternalLink, Copy } from "lucide-react";
import { RainbowWalletProvider, useEnhancedWallet } from "@/app/components/wallet/rainbow-wallet-provider";
import { WalletConnectButton } from "@/app/components/wallet/wallet-connect-button";

function WalletTab() {
  const { isConnected, walletAddress, chainId, chainName, disconnect } = useEnhancedWallet();
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Address copied to clipboard");
    } catch (err) {
      toast.error("Failed to copy address");
    }
  };
  
  const formatAddress = (address: string | null) => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  const viewOnEtherscan = (address: string) => {
    window.open(`https://etherscan.io/address/${address}`, "_blank");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Wallet className="mr-2 h-5 w-5" />
          Wallet Connection
        </CardTitle>
        <CardDescription>
          Connect your Ethereum wallet to manage ENS domains
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && walletAddress ? (
          <div className="space-y-4">
            <div>
              <Label>Connected Address</Label>
              <div className="flex items-center mt-1.5 gap-2">
                <div className="bg-muted p-2 rounded-md flex-1 font-mono text-sm">
                  {walletAddress}
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => copyToClipboard(walletAddress)}
                  title="Copy address"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => viewOnEtherscan(walletAddress)}
                  title="View on Etherscan"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <Label>Network</Label>
              <div className="flex items-center mt-1.5">
                <div className="bg-muted p-2 rounded-md flex-1">
                  {chainName || "Unknown"} (Chain ID: {chainId || "Unknown"})
                </div>
              </div>
            </div>
            
            <div className="pt-2">
              <Button 
                variant="destructive" 
                onClick={disconnect}
                className="w-full sm:w-auto"
              >
                Disconnect Wallet
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-md text-center">
              <p className="mb-4">Connect your wallet to manage ENS domains and deploy to IPFS</p>
              <WalletConnectButton />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();

  return (
    <RainbowWalletProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <Tabs defaultValue="account" className="w-full">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
          </TabsList>
          
          <TabsContent value="account" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5" />
                  Account Information
                </CardTitle>
                <CardDescription>
                  View and manage your account details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {session?.user?.name && (
                  <div>
                    <Label>Name</Label>
                    <div className="flex items-center mt-1.5">
                      <Input value={session.user.name} readOnly className="bg-muted" />
                    </div>
                  </div>
                )}
                
                {session?.user?.email && (
                  <div>
                    <Label>Email</Label>
                    <div className="flex items-center mt-1.5">
                      <Input value={session.user.email} readOnly className="bg-muted" />
                    </div>
                  </div>
                )}
                
                <div className="bg-amber-50 border border-amber-200 rounded-md p-4 dark:bg-amber-900/20 dark:border-amber-800">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-2 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-800 dark:text-amber-400">GitHub Account</h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Your account is linked to GitHub. To update your profile information, please visit your GitHub account settings.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="destructive" onClick={() => signOut({ callbackUrl: "/", redirect: true })}>
                  Sign Out
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="wallet" className="space-y-4 mt-4">
            <WalletTab />
          </TabsContent>
        </Tabs>
      </div>
    </RainbowWalletProvider>
  );
} 