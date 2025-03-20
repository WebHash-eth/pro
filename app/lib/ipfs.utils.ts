export function getIPFSGatewayURL(cid: string): string {
  // Use a public IPFS gateway or your custom gateway
  return `https://ipfs.io/ipfs/${cid}`;
} 