"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEnhancedWallet } from "./rainbow-wallet-provider";

interface DisconnectButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function DisconnectButton({
  variant = "outline",
  size = "default",
  className = "",
}: DisconnectButtonProps) {
  const { disconnect, isConnected } = useEnhancedWallet();

  if (!isConnected) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={disconnect}
      className={`flex items-center gap-2 ${className}`}
    >
      <LogOut className="h-4 w-4" />
      <span>Disconnect Wallet</span>
    </Button>
  );
} 