"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ethers } from "ethers";

interface WalletContextType {
  isConnected: boolean;
  walletAddress: string | null;
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  chainId: number | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isConnecting: boolean;
  error: string | null;
}

const WalletContext = createContext<WalletContextType>({
  isConnected: false,
  walletAddress: null,
  provider: null,
  signer: null,
  chainId: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  isConnecting: false,
  error: null,
});

export function useWallet() {
  return useContext(WalletContext);
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if wallet is already connected on component mount
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          // Check if we're already connected
          const accounts = await window.ethereum.request({ method: "eth_accounts" });
          
          if (accounts.length > 0) {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const address = await signer.getAddress();
            const network = await provider.getNetwork();
            
            setProvider(provider);
            setSigner(signer);
            setWalletAddress(address);
            setChainId(network.chainId);
            setIsConnected(true);
          }
        } catch (error) {
          console.error("Error checking wallet connection:", error);
        }
      }
    };

    checkConnection();
  }, []);

  // Listen for account and chain changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected their wallet
          disconnectWallet();
        } else if (accounts[0] !== walletAddress) {
          // User switched accounts
          setWalletAddress(accounts[0]);
        }
      };

      const handleChainChanged = (chainIdHex: string) => {
        const newChainId = parseInt(chainIdHex, 16);
        setChainId(newChainId);
        
        // Reload the provider with the new chain
        if (window.ethereum) {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          setProvider(provider);
          setSigner(provider.getSigner());
        }
      };

      const handleDisconnect = () => {
        disconnectWallet();
      };

      // Add event listeners
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
      window.ethereum.on("disconnect", handleDisconnect);

      // Clean up event listeners
      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
          window.ethereum.removeListener("chainChanged", handleChainChanged);
          window.ethereum.removeListener("disconnect", handleDisconnect);
        }
      };
    }
  }, [walletAddress]);

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (typeof window !== "undefined" && window.ethereum) {
        // Request account access
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        const network = await provider.getNetwork();
        
        // Check if we're on Sepolia testnet (chainId 11155111)
        if (network.chainId !== 11155111) {
          try {
            // Try to switch to Sepolia
            await window.ethereum.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0xaa36a7" }], // 0xaa36a7 is the hex value for 11155111 (Sepolia)
            });
            
            // Refresh provider after chain switch
            const updatedProvider = new ethers.providers.Web3Provider(window.ethereum);
            const updatedNetwork = await updatedProvider.getNetwork();
            
            setProvider(updatedProvider);
            setSigner(updatedProvider.getSigner());
            setChainId(updatedNetwork.chainId);
          } catch (switchError: any) {
            // This error code indicates that the chain has not been added to MetaMask
            if (switchError.code === 4902) {
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: "0xaa36a7",
                    chainName: "Sepolia Testnet",
                    nativeCurrency: {
                      name: "Sepolia ETH",
                      symbol: "ETH",
                      decimals: 18,
                    },
                    rpcUrls: ["https://sepolia.infura.io/v3/"],
                    blockExplorerUrls: ["https://sepolia.etherscan.io"],
                  },
                ],
              });
              
              // Refresh provider after adding chain
              const updatedProvider = new ethers.providers.Web3Provider(window.ethereum);
              const updatedNetwork = await updatedProvider.getNetwork();
              
              setProvider(updatedProvider);
              setSigner(updatedProvider.getSigner());
              setChainId(updatedNetwork.chainId);
            } else {
              throw switchError;
            }
          }
        } else {
          setProvider(provider);
          setSigner(signer);
          setChainId(network.chainId);
        }
        
        setWalletAddress(address);
        setIsConnected(true);
      } else {
        setError("No Ethereum wallet found. Please install MetaMask.");
      }
    } catch (error: any) {
      console.error("Error connecting wallet:", error);
      setError(error.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setWalletAddress(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
  };

  const value = {
    isConnected,
    walletAddress,
    provider,
    signer,
    chainId,
    connectWallet,
    disconnectWallet,
    isConnecting,
    error,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

// Add TypeScript support for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
} 