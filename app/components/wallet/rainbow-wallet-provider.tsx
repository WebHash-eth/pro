"use client";

import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import {
  RainbowKitProvider,
  darkTheme,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import { WagmiConfig, createConfig } from "wagmi";
import { sepolia, mainnet } from "wagmi/chains";
import { http } from "viem";
import { ethers } from "ethers";
import { useTheme } from "next-themes";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { 
  useAccount, 
  useChainId, 
  useDisconnect, 
  useSwitchChain,
  useWalletClient
} from 'wagmi';
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

// Create a client
const queryClient = new QueryClient();

// Configure wagmi config
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

const config = getDefaultConfig({
  appName: "WebHash Pro",
  projectId,
  chains: [sepolia, mainnet] as const,
  transports: {
    [sepolia.id]: http(`https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || ""}`),
    [mainnet.id]: http(),
  },
});

// Enhanced wallet context with ethers.js compatibility
interface EnhancedWalletContextType {
  isConnected: boolean;
  walletAddress: string | null;
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  chainId: number | null;
  chainName: string | null;
  isMainnet: boolean;
  switchToMainnet: () => Promise<void>;
  disconnect: () => void;
  isLoading: boolean;
  error: string | null;
}

const EnhancedWalletContext = createContext<EnhancedWalletContextType>({
  isConnected: false,
  walletAddress: null,
  provider: null,
  signer: null,
  chainId: null,
  chainName: null,
  isMainnet: false,
  switchToMainnet: async () => {},
  disconnect: () => {},
  isLoading: false,
  error: null,
});

export function useEnhancedWallet() {
  return useContext(EnhancedWalletContext);
}

function EnhancedWalletProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChain, isPending: isSwitchingNetwork, error: switchChainError } = useSwitchChain();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected && walletClient) {
      // Create ethers provider from wallet client
      const provider = new ethers.providers.Web3Provider(walletClient as any);
      setProvider(provider);
      setSigner(provider.getSigner());
    } else {
      setProvider(null);
      setSigner(null);
    }
  }, [isConnected, walletClient]);

  // Log chain information for debugging
  useEffect(() => {
    if (chain) {
      console.log("Chain information:", {
        id: chain.id,
        name: chain.name,
      });
    }
  }, [chain]);

  // Improved Ethereum Mainnet detection
  const chainId = chain?.id || null;
  const chainName = chain?.name || null;
  
  // Check if on Ethereum Mainnet (chain ID 1)
  const isMainnet = chainId === 1;
  
  console.log("Mainnet detection:", { chainId, chainName, isMainnet });

  // Handle network switching
  const switchToMainnet = async () => {
    if (!isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      await switchChain({ chainId: mainnet.id });
      setError(null);
    } catch (err) {
      console.error("Error switching network:", err);
      setError("Failed to switch network");
    }
  };

  // Handle disconnection
  const disconnect = () => {
    console.log("Disconnecting wallet...");
    wagmiDisconnect();
    setProvider(null);
    setSigner(null);
    
    // Add a small delay to ensure the UI updates
    setTimeout(() => {
      console.log("Wallet disconnected, state cleared");
      // Force a re-render by updating the state
      setIsLoading(false);
    }, 100);
  };

  const value = {
    isConnected,
    walletAddress: address || null,
    provider,
    signer,
    chainId,
    chainName,
    isMainnet,
    switchToMainnet,
    disconnect,
    isLoading,
    error: switchChainError ? switchChainError.message : error,
  };

  return (
    <EnhancedWalletContext.Provider value={value}>
      {children}
    </EnhancedWalletContext.Provider>
  );
}

interface RainbowWalletProviderProps {
  children: ReactNode;
}

export function RainbowWalletProvider({ children }: RainbowWalletProviderProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Ensure theme is available on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={resolvedTheme === 'dark' ? darkTheme() : lightTheme()}
        >
          <EnhancedWalletProvider>
            {children}
          </EnhancedWalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
} 