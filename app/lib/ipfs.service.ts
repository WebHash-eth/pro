"use server";

import { getIPFSGatewayURL } from "./ipfs.utils";
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';

export interface UploadResponse {
  Name: string;
  Hash: string;
  Size: string;
}

/**
 * Uploads a file to IPFS using the custom API
 * @param filePath Path to the file to upload
 * @param apiKey API key for authentication
 * @returns Upload response with CID and other details
 */
export async function uploadToIPFS(filePath: string, apiKey: string): Promise<UploadResponse> {
  try {
    console.log(`Uploading file to IPFS: ${filePath}`);
    
    // This is a placeholder for the actual implementation
    // In a real implementation, you would use fetch to call your custom API
    throw new Error("Custom API upload not implemented yet");
    
  } catch (error: any) {
    console.error("Error uploading to IPFS:", error);
    throw new Error(`Failed to upload to IPFS: ${error.message}`);
  }
}

/**
 * Uploads a tar.gz file to IPFS using the custom API
 * @param tarGzFilePath Path to the tar.gz file to upload
 * @param apiKey API key for authentication
 * @returns Object containing CID and gateway URL
 */
export async function uploadTarGzToIPFS(tarGzFilePath: string, apiKey: string): Promise<{ cid: string; gatewayUrl: string }> {
  try {
    console.log(`Uploading tar.gz file to IPFS: ${tarGzFilePath}`);
    
    // Get the API endpoint from environment variables
    const apiEndpoint = process.env.IPFS_API_ENDPOINT || 'http://52.38.175.117:5009/upload';
    console.log(`Uploading to API endpoint: ${apiEndpoint}`);
    
    // Parse the URL to get the hostname, path, and protocol
    const url = new URL(apiEndpoint);
    const isHttps = url.protocol === 'https:';
    
    // Create a form data instance
    const form = new FormData();
    
    // Add the file to the form
    form.append('file', fs.createReadStream(tarGzFilePath));
    
    // Return a promise that resolves with the API response
    return new Promise((resolve, reject) => {
      // Set up the request options
      const options = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...form.getHeaders()
        }
      };
      
      // Create the request
      const req = (isHttps ? httpsRequest : httpRequest)(options, (res) => {
        // Handle the response
        const chunks: Buffer[] = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          // Combine the chunks into a single buffer
          const responseBody = Buffer.concat(chunks).toString();
          
          // Check if the response is OK
          if (res.statusCode !== 200) {
            return reject(new Error(`API responded with status: ${res.statusCode}, message: ${responseBody}`));
          }
          
          try {
            // Parse the JSON response
            const data = JSON.parse(responseBody);
            console.log("API response:", data);
            
            // Extract the CID from the response
            const cid = data.cid;
            if (!cid) {
              return reject(new Error("API response did not include a CID"));
            }
            
            // Construct the gateway URL using the utility function
            const gatewayUrl = getIPFSGatewayURL(cid);
            
            // Resolve with the CID and gateway URL
            resolve({ cid, gatewayUrl });
          } catch (error: any) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        });
      });
      
      // Handle request errors
      req.on('error', (error) => {
        reject(new Error(`Request error: ${error.message}`));
      });
      
      // Pipe the form data to the request
      form.pipe(req);
    });
  } catch (error: any) {
    console.error("Error uploading tar.gz to IPFS:", error);
    throw new Error(`Failed to upload to IPFS: ${error.message}`);
  }
}

/**
 * Deploys a GitHub repository to IPFS
 * @param repoUrl GitHub repository URL
 * @param branch Branch to deploy
 * @param apiKey API key for authentication
 * @param buildCommand Optional build command
 * @returns Object containing CID and gateway URL
 */
export async function deployFromGitHub(
  repoUrl: string,
  branch: string,
  apiKey: string,
  buildCommand?: string
): Promise<{ cid: string; gatewayUrl: string }> {
  // This function will be implemented in the deploy route
  throw new Error("Not implemented yet");
} 