import { ethers } from 'ethers';
// @ts-ignore - content-hash doesn't have TypeScript definitions
import * as contentHash from '@ensdomains/content-hash';

// ENS Registry ABI (simplified)
const ENS_REGISTRY_ABI = [
  'function resolver(bytes32 node) external view returns (address)',
  'function owner(bytes32 node) external view returns (address)',
];

// ENS Public Resolver ABI (simplified for content hash updates)
const ENS_PUBLIC_RESOLVER_ABI = [
  'function setContenthash(bytes32 node, bytes calldata hash) external',
  'function contenthash(bytes32 node) external view returns (bytes memory)',
];

// ENS Registry address on Ethereum Mainnet
const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'; // Mainnet ENS Registry

// Convert IPFS CID to content hash format for ENS
export function ipfsCidToContentHash(cid: string): string {
  try {
    // Log the input CID for debugging
    console.log("Converting CID to content hash:", cid);
    
    // Remove the 'ipfs://' prefix if present
    let cleanCid = cid.replace('ipfs://', '');
    console.log("Clean CID (after removing ipfs:// prefix):", cleanCid);
    
    // Use the @ensdomains/content-hash library to encode the IPFS CID
    try {
      // Encode the CID as an IPFS content hash using 'ipfs' codec
      console.log("Encoding IPFS CID using @ensdomains/content-hash library");
      const encoded = contentHash.encode('ipfs', cleanCid);
      console.log("Raw encoded result:", encoded);
      
      // Ensure the content hash has the 0x prefix
      const formattedContentHash = encoded.startsWith('0x') ? encoded : `0x${encoded}`;
      console.log("Final formatted content hash:", formattedContentHash);
      
      return formattedContentHash;
    } catch (encodeError: any) {
      console.error("Error encoding with content-hash library:", encodeError);
      
      // Manual fallback for IPFS CIDs
      console.log("Attempting manual encoding for IPFS CID");
      
      // For IPFS CIDv1 (bafy...) or CIDv0 (Qm...)
      // Use the standard IPFS codec prefix (0xe301)
      if (cleanCid.startsWith('bafy') || cleanCid.startsWith('Qm')) {
        const contentHashHex = `0xe301${Buffer.from(cleanCid).toString('hex')}`;
        console.log("Manually encoded content hash:", contentHashHex);
        return contentHashHex;
      }
      
      throw new Error(`Failed to encode CID: ${encodeError.message}`);
    }
  } catch (error: any) {
    console.error("Error converting CID to content hash:", error);
    throw new Error(`Failed to convert CID to content hash: ${error.message}`);
  }
}

// Convert content hash to IPFS CID
export function contentHashToIpfsCid(hash: string): string {
  try {
    // Check if it's a valid content hash
    if (!hash || hash === '0x') {
      return '';
    }
    
    // Remove the '0x' prefix if present
    const cleanHash = hash.startsWith('0x') ? hash.substring(2) : hash;
    
    try {
      // Use the @ensdomains/content-hash library to decode
      console.log("Decoding content hash using @ensdomains/content-hash library");
      const codec = contentHash.getCodec(cleanHash);
      console.log("Detected codec:", codec);
      
      if (codec === 'ipfs') {
        const value = contentHash.decode(cleanHash);
        console.log("Decoded IPFS CID:", value);
        return `ipfs://${value}`;
      } else {
        console.log("Unsupported codec:", codec);
        return `${codec}://${contentHash.decode(cleanHash)}`;
      }
    } catch (decodeError: any) {
      console.error("Error decoding with content-hash library:", decodeError);
      
      // Manual fallback for IPFS content hashes
      if (cleanHash.startsWith('e301')) {
        console.log("Attempting manual decoding for IPFS content hash");
        const cidHex = cleanHash.substring(4);
        const cidBytes = Buffer.from(cidHex, 'hex');
        const cid = cidBytes.toString();
        console.log("Manually decoded IPFS CID:", cid);
        return `ipfs://${cid}`;
      }
      
      return '';
    }
  } catch (error: any) {
    console.error('Error converting content hash to IPFS CID:', error);
    return '';
  }
}

// Get the namehash for an ENS domain
export function getNamehash(domain: string): string {
  return ethers.utils.namehash(domain);
}

// Get ENS domains owned by a wallet address
export async function getEnsDomainsForWallet(
  walletAddress: string,
  provider: ethers.providers.Provider
): Promise<string[]> {
  try {
    // This is a simplified implementation
    // In a real app, you would need to query the ENS registry or use a subgraph
    // For Ethereum Mainnet, you could use the ENS Graph API or ENS SDK
    
    // For now, we'll return an empty array
    // In a production app, you would implement this properly
    return [];
  } catch (error: any) {
    console.error('Error getting ENS domains for wallet:', error);
    return [];
  }
}

// Update the content hash for an ENS domain
export async function updateEnsContentHash(
  provider: ethers.providers.Provider,
  domainName: string,
  cid: string,
  skipOwnershipCheck: boolean = true
): Promise<string> {
  try {
    console.log(`Updating content hash for ${domainName} to ${cid}`);
    
    // Get the signer
    // Need to cast provider to Web3Provider to access getSigner
    const web3Provider = provider as ethers.providers.Web3Provider;
    const signer = web3Provider.getSigner();
    const address = await signer.getAddress();
    
    // Get the ENS registry
    const registry = new ethers.Contract(
      ENS_REGISTRY_ADDRESS,
      ENS_REGISTRY_ABI,
      signer
    );
    
    // Get the resolver address for the domain
    const resolverAddress = await registry.resolver(getNamehash(domainName));
    
    if (resolverAddress === ethers.constants.AddressZero) {
      throw new Error(`No resolver found for ${domainName}`);
    }
    
    // Get the resolver contract
    const resolver = new ethers.Contract(
      resolverAddress,
      ENS_PUBLIC_RESOLVER_ABI,
      signer
    );
    
    // Check if the connected wallet is the owner of the domain (unless skipped)
    if (!skipOwnershipCheck) {
      const owner = await registry.owner(getNamehash(domainName));
      console.log(`Owner of ${domainName}: ${owner}`);
      console.log(`Connected wallet: ${address}`);
      
      if (owner.toLowerCase() !== address.toLowerCase()) {
        console.error(`Ownership verification failed for ${domainName}:`);
        console.error(`- Domain owner on blockchain: ${owner}`);
        console.error(`- Connected wallet address: ${address}`);
        throw new Error(`You are not the owner of ${domainName}`);
      }
    } else {
      console.log(`Skipping ownership verification for ${domainName}`);
    }
    
    // Convert the IPFS CID to a content hash
    let contentHash;
    try {
      contentHash = ipfsCidToContentHash(cid);
      console.log(`Converted content hash: ${contentHash}`);
    } catch (error: any) {
      console.error("Error converting CID to content hash:", error);
      throw new Error(`Failed to convert CID to content hash: ${error.message}`);
    }
    
    // Update the content hash
    console.log(`Setting content hash for ${domainName} to ${contentHash}`);
    const tx = await resolver.setContenthash(getNamehash(domainName), contentHash);
    console.log(`Transaction hash: ${tx.hash}`);
    
    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    
    return tx.hash;
  } catch (error: any) {
    console.error("Error updating ENS content hash:", error);
    throw new Error(`Failed to update ENS content hash: ${error.message}`);
  }
}

// Get the owner of an ENS domain
export async function getEnsOwner(
  provider: ethers.providers.Provider,
  domainName: string
): Promise<string> {
  try {
    console.log(`Getting owner for domain: ${domainName}`);
    
    // Get the ENS registry
    const registry = new ethers.Contract(
      ENS_REGISTRY_ADDRESS,
      ENS_REGISTRY_ABI,
      provider
    );
    
    // Get the owner address for the domain
    const owner = await registry.owner(getNamehash(domainName));
    console.log(`Owner of ${domainName}: ${owner}`);
    
    return owner;
  } catch (error: any) {
    console.error('Error getting ENS domain owner:', error);
    throw new Error(`Failed to get owner of ${domainName}: ${error.message}`);
  }
}

// Get the content hash for an ENS domain
export async function getEnsContentHash(
  provider: ethers.providers.Provider,
  domainName: string
): Promise<string> {
  try {
    console.log(`Getting content hash for domain: ${domainName}`);
    
    // Get the ENS registry
    const registry = new ethers.Contract(
      ENS_REGISTRY_ADDRESS,
      ENS_REGISTRY_ABI,
      provider
    );
    
    // Get the resolver address for the domain
    const resolverAddress = await registry.resolver(getNamehash(domainName));
    
    if (resolverAddress === ethers.constants.AddressZero) {
      throw new Error(`No resolver found for ${domainName}`);
    }
    
    // Get the resolver contract
    const resolver = new ethers.Contract(
      resolverAddress,
      ENS_PUBLIC_RESOLVER_ABI,
      provider
    );
    
    // Get the content hash
    const contentHash = await resolver.contenthash(getNamehash(domainName));
    console.log(`Content hash for ${domainName}: ${contentHash}`);
    
    return contentHash;
  } catch (error: any) {
    console.error(`Error getting content hash for ${domainName}:`, error);
    throw new Error(`Failed to get content hash for ${domainName}: ${error.message}`);
  }
} 