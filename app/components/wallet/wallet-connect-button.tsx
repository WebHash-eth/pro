"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEnhancedWallet } from "./rainbow-wallet-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ExternalLink, AlertTriangle, LogOut } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function WalletConnectButton() {
  const { isConnected, chainName, isMainnet, switchToMainnet, disconnect, isLoading, error } = useEnhancedWallet();
  const [showNetworkWarning, setShowNetworkWarning] = useState(true);

  return (
    <div className="flex flex-col gap-2">
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          mounted,
        }) => {
          const ready = mounted;
          const connected = ready && account && chain;

          return (
            <div
              {...(!ready && {
                "aria-hidden": true,
                style: {
                  opacity: 0,
                  pointerEvents: "none",
                  userSelect: "none",
                },
              })}
            >
              {(() => {
                if (!connected) {
                  return (
                    <Button onClick={openConnectModal} variant="default">
                      Connect Wallet
                    </Button>
                  );
                }

                if (chain.unsupported) {
                  return (
                    <Button onClick={openChainModal} variant="destructive">
                      Wrong Network
                    </Button>
                  );
                }

                return (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={openChainModal}
                      variant="outline"
                      className="hidden sm:flex"
                      size="sm"
                    >
                      {chain.name}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex items-center gap-2">
                          {account.displayName}
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>
                          <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium">{account.displayName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {account.displayBalance ? `${account.displayBalance}` : ""}
                            </p>
                          </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={openChainModal} className="cursor-pointer">
                          <div className="flex justify-between w-full items-center">
                            <span>Network: {chain.name}</span>
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => {
                            window.open(`https://etherscan.io/address/${account.address}`, "_blank");
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span>View on Explorer</span>
                            <ExternalLink className="h-4 w-4" />
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={disconnect} 
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <div className="flex items-center gap-2">
                            <LogOut className="h-4 w-4" />
                            <span>Disconnect Wallet</span>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })()}
            </div>
          );
        }}
      </ConnectButton.Custom>

      {isConnected && !isMainnet && showNetworkWarning && (
        <Alert variant="destructive" className="mt-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex justify-between items-center">
            <span>Please switch to Ethereum Mainnet for ENS functionality</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNetworkWarning(false)}
                className="h-7 px-2"
              >
                Dismiss
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={switchToMainnet}
                disabled={isLoading}
                className="h-7 px-2"
              >
                Switch
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
} 