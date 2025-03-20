import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { ethers } from 'ethers';
import { normalize } from "viem/ens";
import { isAddress } from "ethers/lib/utils";

// Get the Alchemy API key from environment variables
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '';
const alchemyRpcUrl = `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;

// List of fallback RPC URLs in case the primary one fails
const FALLBACK_RPC_URLS = [
  'https://eth-mainnet.public.blastapi.io',
  'https://ethereum.publicnode.com',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
  "https://eth.llamarpc.com",
  "https://1rpc.io/eth",
  "https://rpc.builder0x69.io",
];

// Create a public client for ENS with proper error handling
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(alchemyApiKey 
    ? alchemyRpcUrl
    : FALLBACK_RPC_URLS[0]),
});

// Create multiple ethers providers for redundancy
const providers: ethers.providers.JsonRpcProvider[] = [];

// Initialize providers
function initializeProviders() {
  // Add Alchemy provider if API key is available
  if (alchemyApiKey) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(
        alchemyRpcUrl,
        {
          name: 'mainnet',
          chainId: 1
        }
      );
      providers.push(provider);
      console.log('Initialized Alchemy provider for ENS');
    } catch (error) {
      console.warn('Failed to initialize Alchemy provider:', error);
    }
  }

  // Add fallback providers with explicit network configuration
  for (const url of FALLBACK_RPC_URLS) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(
        url,
        {
          name: 'mainnet',
          chainId: 1
        }
      );
      providers.push(provider);
    } catch (error) {
      console.warn(`Failed to initialize provider with URL ${url}:`, error);
    }
  }

  // Log the number of initialized providers
  console.log(`Initialized ${providers.length} Ethereum providers`);
}

// Initialize providers on module load
initializeProviders();

/**
 * Get a working provider from the pool of providers
 * @returns A working ethers provider or null if none are available
 */
async function getWorkingProvider(): Promise<ethers.providers.JsonRpcProvider | null> {
  for (const provider of providers) {
    try {
      // Test if the provider is working by getting the network
      const network = await provider.getNetwork();
      
      // Verify that we're connected to mainnet
      if (network.chainId === 1) {
        console.log(`Provider ${provider.connection.url} connected to Ethereum mainnet`);
        return provider;
      } else {
        console.warn(`Provider ${provider.connection.url} connected to wrong network: ${network.name} (${network.chainId})`);
      }
    } catch (error) {
      console.warn(`Provider ${provider.connection.url} failed:`, error);
      continue;
    }
  }
  
  // If all providers fail, try to create a new one with a fallback URL
  for (const rpcUrl of FALLBACK_RPC_URLS) {
    try {
      console.log(`Trying new provider with URL: ${rpcUrl}`);
      const newProvider = new ethers.providers.JsonRpcProvider(
        rpcUrl,
        {
          name: 'mainnet',
          chainId: 1
        }
      );
      
      // Test the network
      const network = await newProvider.getNetwork();
      if (network.chainId === 1) {
        console.log(`New provider ${rpcUrl} connected to Ethereum mainnet`);
        providers.push(newProvider); // Add to the pool if it works
        return newProvider;
      }
    } catch (error) {
      console.warn(`Failed to initialize new provider with URL ${rpcUrl}:`, error);
      continue;
    }
  }
  
  // Try Infura as a last resort
  try {
    console.log("Trying Infura provider as last resort");
    const infuraApiKey = process.env.NEXT_PUBLIC_INFURA_API_KEY || '';
    
    // If no Infura API key is available, use a default provider
    const infuraProvider = infuraApiKey 
      ? new ethers.providers.InfuraProvider('mainnet', infuraApiKey)
      : new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'); // Public Infura ID
    
    // Test the network
    const network = await infuraProvider.getNetwork();
    if (network.chainId === 1) {
      console.log("Infura provider connected to Ethereum mainnet");
      return infuraProvider;
    }
  } catch (error) {
    console.error("Infura provider failed:", error);
  }
  
  console.error("All providers failed");
  return null;
}

/**
 * Get domains for a given address
 * @param address The wallet address to check
 * @returns Array of ENS domain names
 */
export async function getDomainsForAddress(address: string): Promise<any[]> {
  try {
    console.log(`Fetching ENS domains for address: ${address}`);
    
    // Normalize the address
    const normalizedAddress = address.toLowerCase();
    console.log(`Using normalized address: ${normalizedAddress}`);
    
    // Attempt to fetch domains using ENS Graph API
    console.log("Attempting to fetch domains using ENS Graph API...");
    const graphDomains = await getDomainsFromGraphAPI(normalizedAddress);
    
    if (graphDomains.length > 0) {
      console.log(`Found ${graphDomains.length} domains from Graph API`);
      return graphDomains;
    }
    
    // If Graph API returned no domains, return an empty array
    console.log("Graph API returned no domains");
    return [];
  } catch (error) {
    console.error("Error fetching domains:", error);
    return [];
  }
}

/**
 * Get domains using the Graph API
 * @param address The wallet address to check
 * @returns Array of ENS domain names
 */
async function getDomainsFromGraphAPI(address: string): Promise<any[]> {
  try {
    console.log(`Querying ENS subgraph for domains owned by ${address}`);
    
    // Using The Graph API to query ENS domains on Ethereum mainnet only
    const response = await fetch(
      "https://api.thegraph.com/subgraphs/name/ensdomains/ens",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query getRecords($id: String!) {
              account(id: $id) {
                domains(first: 1000) {
                  id
                  name
                  labelName
                  labelhash
                  resolver {
                    addr {
                      id
                    }
                    texts
                    coinTypes
                    contentHash
                  }
                  owner {
                    id
                  }
                }
                wrappedDomains(first: 1000) {
                  id
                  name
                  owner {
                    id
                  }
                }
              }
            }
          `,
          variables: {
            id: address.toLowerCase()
          }
        }),
      }
    );

    const data = await response.json();
    
    // Check for errors in the response
    if (data.errors) {
      console.error("Graph API returned errors:", data.errors);
      return [];
    }
    
    // Check if the expected data structure exists
    if (!data.data || !data.data.account) {
      console.error("Unexpected Graph API response structure:", data);
      return [];
    }

    // Combine regular domains and wrapped domains
    const regularDomains = data.data.account.domains || [];
    const wrappedDomains = data.data.account.wrappedDomains || [];
    
    console.log(`Graph API returned ${regularDomains.length} regular domains and ${wrappedDomains.length} wrapped domains`);
    
    // Normalize all domain names with proper error handling
    const allDomains = [];
    
    // Process regular domains
    for (const domain of regularDomains) {
      try {
        if (!domain.name) continue;
        
        // Check if the name is valid for normalization
        if (domain.name.includes('[') || domain.name.includes(']')) {
          console.log(`Skipping domain with invalid characters: ${domain.name}`);
          continue;
        }
        
        const normalizedName = domain.name.endsWith('.eth') ? normalize(domain.name) : domain.name;
        allDomains.push({
          ...domain,
          name: normalizedName,
          source: "graph-regular",
          resolver: domain.resolver ? domain.resolver : null
        });
      } catch (error) {
        console.error(`Error processing regular domain: ${domain.name}`, error);
      }
    }
    
    // Process wrapped domains
    for (const domain of wrappedDomains) {
      try {
        if (!domain.name) continue;
        
        // Check if the name is valid for normalization
        if (domain.name.includes('[') || domain.name.includes(']')) {
          console.log(`Skipping wrapped domain with invalid characters: ${domain.name}`);
          continue;
        }
        
        const normalizedName = domain.name.endsWith('.eth') ? normalize(domain.name) : domain.name;
        allDomains.push({
          ...domain,
          name: normalizedName,
          source: "graph-wrapped",
          resolver: "wrapped"
        });
      } catch (error) {
        console.error(`Error processing wrapped domain: ${domain.name}`, error);
      }
    }
    
    // Filter out duplicates based on name
    const uniqueDomains = allDomains.filter((domain, index, self) => 
      domain.name && self.findIndex(d => d.name === domain.name) === index
    );
    
    console.log(`Found ${uniqueDomains.length} unique domains after deduplication`);
    return uniqueDomains;
  } catch (error) {
    console.error("Error fetching domains from Graph API:", error);
    return [];
  }
}

/**
 * Get the primary ENS name for a wallet address
 * @param address The wallet address to check
 * @returns The primary ENS name or null if not found
 */
export async function getPrimaryENS(address: string): Promise<string | null> {
  try {
    // Get a working provider
    const provider = await getWorkingProvider();
    if (!provider) {
      console.error('No working Ethereum provider available');
      return null;
    }
    
    const name = await provider.lookupAddress(address);
    return name;
  } catch (error) {
    console.error('Error fetching primary ENS:', error);
    return null;
  }
}

/**
 * Validate if a string is a valid ENS domain
 * @param domain The domain name to validate
 * @returns Boolean indicating if the domain is valid
 */
export function isValidENSDomain(domain: string): boolean {
  // Basic validation
  if (!domain || typeof domain !== 'string') return false;
  
  // Check if it ends with .eth
  if (!domain.endsWith('.eth')) return false;
  
  // Check if it contains invalid characters
  const validRegex = /^[a-z0-9-]+\.eth$/;
  return validRegex.test(domain);
}

/**
 * Get the owner of an ENS domain
 * @param domain The ENS domain name
 * @returns The owner address or null if not found
 */
export async function getENSDomainOwner(domain: string): Promise<string | null> {
  try {
    if (!isValidENSDomain(domain)) return null;
    
    // Get a working provider
    const provider = await getWorkingProvider();
    if (!provider) {
      console.error('No working Ethereum provider available');
      return null;
    }
    
    const owner = await provider.resolveName(domain);
    return owner;
  } catch (error) {
    console.error('Error fetching ENS domain owner:', error);
    return null;
  }
}

/**
 * Get the namehash for an ENS domain
 * @param domain The ENS domain name
 * @returns The namehash string
 */
export function getNamehash(domain: string): string {
  return ethers.utils.namehash(domain);
}

// Function to get domains using ethers
async function getDomainsUsingEthers(address: string): Promise<any[]> {
  try {
    const provider = await getWorkingProvider();
    
    if (!provider) {
      console.error("No working provider available for ethers lookup");
      
      // Try with a direct provider as a last resort
      try {
        console.log("Trying with a direct Infura provider as last resort");
        const infuraApiKey = process.env.NEXT_PUBLIC_INFURA_API_KEY || '';
        
        // If no Infura API key is available, use a default provider
        const infuraProvider = infuraApiKey 
          ? new ethers.providers.InfuraProvider('mainnet', infuraApiKey)
          : new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'); // Public Infura ID
        
        // Look up the primary ENS name for this address
        const name = await infuraProvider.lookupAddress(address);
        
        if (!name) {
          console.log("No primary ENS name found using Infura provider");
          return [];
        }
        
        console.log(`Found primary ENS name using Infura: ${name}`);
        
        return [
          {
            id: getNamehash(name),
            name,
            labelName: name.split(".")[0],
            owner: {
              id: address.toLowerCase(),
            },
            resolver: {
              contentHash: null,
            },
            source: "infura",
          },
        ];
      } catch (infuraError) {
        console.error("Infura provider also failed:", infuraError);
        return [];
      }
    }
    
    console.log(`Using provider ${(provider as any).connection?.url || "unknown"} for ethers lookup`);
    
    // Look up the primary ENS name for this address
    const name = await provider.lookupAddress(address);
    
    if (!name) {
      console.log("No primary ENS name found for address using ethers");
      return [];
    }
    
    console.log(`Found primary ENS name: ${name}`);
    
    // Verify that this name resolves back to the address
    const resolvedAddress = await provider.resolveName(name);
    
    if (resolvedAddress?.toLowerCase() !== address.toLowerCase()) {
      console.warn(`Primary ENS name ${name} resolves to ${resolvedAddress} instead of ${address}`);
      return [];
    }
    
    // Get the resolver for this name
    const resolver = await provider.getResolver(name);
    
    return [
      {
        id: getNamehash(name),
        name,
        labelName: name.split(".")[0],
        owner: {
          id: address.toLowerCase(),
        },
        resolver: {
          contentHash: resolver ? await resolver.getContentHash().catch(() => null) : null,
        },
        source: "ethers",
      },
    ];
  } catch (error) {
    console.error("Error fetching domains using ethers:", error);
    return [];
  }
} 