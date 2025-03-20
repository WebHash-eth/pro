"use client";
//commen
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ExternalLink, FileCode, Globe, Search, Server, Plus } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { GitHubLogoIcon, ReloadIcon, Component1Icon, GlobeIcon } from "@radix-ui/react-icons";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GitHubAccessModal } from "@/app/components/github-access-modal";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  default_branch: string;
  visibility: string;
  updated_at: string;
}

interface Deployment {
  _id: string;
  repositoryName: string;
  repositoryFullName: string;
  branch: string;
  cid: string;
  gatewayUrl: string;
  projectType: string;
  status: 'success' | 'failed';
  createdAt: string;
  sizeInMB?: string;
}

interface DeploymentLog {
  type: 'info' | 'error' | 'success';
  message: string;
  timestamp: string;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [lighthouseApiKey, setLighthouseApiKey] = useState<string>("");
  const [buildCommand, setBuildCommand] = useState("");
  const [outputDirectory, setOutputDirectory] = useState("");
  const [projectType, setProjectType] = useState<"static" | "react">("static");
  const [showAccessRequestModal, setShowAccessRequestModal] = useState(false);
  const [requestRepoName, setRequestRepoName] = useState("");
  const [requestRepoOwner, setRequestRepoOwner] = useState("");
  const [requestRepoUrl, setRequestRepoUrl] = useState("");
  const [requestRepoVisibility, setRequestRepoVisibility] = useState<"public" | "private">("private");
  const [showManualRepoModal, setShowManualRepoModal] = useState(false);
  const [manualRepoUrl, setManualRepoUrl] = useState("");
  const [manualRepoBranch, setManualRepoBranch] = useState("main");
  const [isValidatingRepo, setIsValidatingRepo] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState<string>("");
  const [deploymentProgressId, setDeploymentProgressId] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<'success' | 'error' | null>(null);
  const [showGitHubAccessModal, setShowGitHubAccessModal] = useState(false);
  
  // State for tabs
  const [activeTab, setActiveTab] = useState<string>("deploy");
  
  // Deployments tab state
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [filteredDeployments, setFilteredDeployments] = useState<Deployment[]>([]);
  const [isLoadingDeployments, setIsLoadingDeployments] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const deploymentsPerPage = 6;

  const [deploymentLogs, setDeploymentLogs] = useState<DeploymentLog[]>([]);
  const [currentDeploymentId, setCurrentDeploymentId] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Function to clean up all toasts
  const cleanupAllToasts = () => {
    if (deploymentProgressId) {
      console.log('Cleaning up all toasts');
      toast.dismiss(deploymentProgressId);
      setDeploymentProgressId(null);
    }
    
    // Force dismiss all toasts (this is a sonner-specific feature)
    toast.dismiss();
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.accessToken) {
      fetchRepositories();
      
      // Get API key from localStorage
      const storedApiKey = localStorage.getItem("ipfsApiKey") || "";
      setLighthouseApiKey(storedApiKey);
    }
    
    // Clean up toasts when component mounts (in case there are any lingering from previous sessions)
    cleanupAllToasts();
    
    // Clean up toasts when component unmounts
    return () => {
      cleanupAllToasts();
    };
  }, [session]);

  // Add effect for deployments search filtering
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredDeployments(deployments);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredDeployments(
        deployments.filter(
          (deployment) =>
            deployment.repositoryName.toLowerCase().includes(query) ||
            deployment.repositoryFullName.toLowerCase().includes(query) ||
            deployment.branch.toLowerCase().includes(query) ||
            deployment.projectType.toLowerCase().includes(query)
        )
      );
    }
    setCurrentPage(1);
  }, [searchQuery, deployments]);

  const fetchRepositories = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/github/repositories");
      if (!response.ok) {
        throw new Error("Failed to fetch repositories");
      }
      const data = await response.json();
      setRepositories(data);
    } catch (error) {
      console.error("Error fetching repositories:", error);
      toast.error("Failed to fetch repositories");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBranches = async (owner: string, repo: string) => {
    try {
      const response = await fetch(`/api/github/branches?owner=${owner}&repo=${repo}`);
      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }
      const data = await response.json();
      setBranches(data);
      if (data.length > 0) {
        setSelectedBranch(data[0]);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast.error("Failed to fetch branches");
    }
  };

  const handleRepoSelect = (repo: Repository) => {
    setSelectedRepo(repo);
    const [owner, repoName] = repo.full_name.split("/");
    fetchBranches(owner, repoName);
  };

  const verifyRepositoryAccess = async (owner: string, repo: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/github/verify-repo?owner=${owner}&repo=${repo}`);
      const data = await response.json();
      
      if (!response.ok) {
        // Show the access request modal with the error message
        setRequestRepoName(repo);
        setRequestRepoOwner(owner);
        setRequestRepoUrl(`https://github.com/${owner}/${repo}`);
        setRequestRepoVisibility(data.exists ? "private" : "public");
        setShowAccessRequestModal(true);
        
        // Show the error message
        toast.error(data.error || "Repository not found or not accessible");
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error verifying repository access:", error);
      toast.error("Failed to verify repository access");
      return false;
    }
  };

  // Function to connect to the SSE endpoint for deployment logs
  const connectToDeploymentLogs = (deploymentId: string) => {
    console.log(`Connecting to deployment logs for deployment ID: ${deploymentId}`);
    
    // Close any existing EventSource connection
    if (eventSourceRef.current) {
      console.log('Closing existing EventSource connection before starting new deployment');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    // Clear previous logs
    setDeploymentLogs([]);
    
    // Set the current deployment ID
    setCurrentDeploymentId(deploymentId);
    
    // Add initial connecting message
    setDeploymentLogs([{
      type: 'info',
      message: 'Connecting to deployment logs...',
      timestamp: new Date().toISOString()
    }]);
    
    // Create a new EventSource connection
    console.log(`Creating new EventSource for: /api/deployment-logs?deploymentId=${deploymentId}`);
    
    // Add a timestamp and random string to prevent caching
    const timestamp = new Date().getTime();
    const random = Math.random().toString(36).substring(2, 15);
    const eventSource = new EventSource(`/api/deployment-logs?deploymentId=${deploymentId}&_=${timestamp}&r=${random}`);
    
    // Store the EventSource in the ref for later cleanup
    eventSourceRef.current = eventSource;
    
    // Track if we've received any logs beyond the initial connection message
    let hasReceivedLogs = false;
    let hasReceivedInitialConnection = false;
    let hasReceivedCompletionEvent = false;
    
    // Track if we should attempt reconnection
    let shouldReconnect = true;
    
    // Set a connection timeout (increased to 15 seconds for slower connections)
    const connectionTimeout = setTimeout(() => {
      if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.OPEN) {
        console.error('SSE connection timeout');
        setDeploymentLogs(prev => [...prev, {
          type: 'error',
          message: 'Connection timeout. Attempting to reconnect...',
          timestamp: new Date().toISOString()
        }]);
        
        // Close the connection and try again if we should reconnect
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        if (shouldReconnect && isDeploying) {
          connectToDeploymentLogs(deploymentId);
        }
      }
    }, 15000);
    
    // Set a processing timeout to detect if we're not receiving expected logs
    const processingTimeout = setTimeout(() => {
      console.log('Checking if logs have been received...');
      
      // Only attempt reconnection if we haven't received the initial connection message
      // This prevents unnecessary reconnections for quick deployments
      if (!hasReceivedInitialConnection) {
        console.log('No initial connection message received. Attempting to reconnect...');
        setDeploymentLogs(prev => [...prev, {
          type: 'info',
          message: 'No connection established. Reconnecting...',
          timestamp: new Date().toISOString()
        }]);
        
        // Close the connection and try again if we should reconnect
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        
        if (shouldReconnect && isDeploying) {
          connectToDeploymentLogs(deploymentId);
        } else {
          console.log('Not reconnecting because deployment is no longer in progress');
        }
      } else if (!hasReceivedLogs && !hasReceivedCompletionEvent) {
        // If we've received the initial connection but no logs, fetch them directly
        console.log('Connection established but no logs received. Fetching logs directly...');
        
        // First try the embedded logs endpoint
        fetch(`/api/deployments/${deploymentId}/embedded-logs`)
          .then(response => {
            if (!response.ok) {
              // If embedded logs endpoint fails, try the legacy endpoint
              console.log('Embedded logs endpoint failed, trying legacy endpoint');
              return fetch(`/api/deployment-logs/fetch?deploymentId=${deploymentId}`).then(r => r.json());
            }
            return response.json();
          })
          .then(logs => {
            if (logs && logs.length > 0) {
              console.log(`Found ${logs.length} logs for deployment ${deploymentId}`);
              setDeploymentLogs(prev => [...prev, ...logs]);
              hasReceivedLogs = true;
              
              // Check if any of the logs indicate completion
              const completionLog = logs.find((log: DeploymentLog) => 
                (log.type === 'success' && log.message.includes('completed successfully')) ||
                (log.type === 'error' && log.message.includes('failed'))
              );
              
              if (completionLog) {
                console.log('Found completion log:', completionLog);
                hasReceivedCompletionEvent = true;
                if (completionLog.type === 'success') {
                  setDeploymentStatus('success');
                  
                  // Extract the MongoDB ID from the completion message if available
                  const idMatch = completionLog.message.match(/saved to database with ID: ([a-f0-9]+)/);
                  if (idMatch && idMatch[1]) {
                    const mongoDbId = idMatch[1];
                    console.log(`Extracted deployment MongoDB ID from direct log fetch: ${mongoDbId}`);
                    
                    // Show success toast
                    toast.success('Deployment completed successfully!');
                    
                    // Navigate to the deployment details page after a short delay
                    setTimeout(() => {
                      router.push(`/dashboard/deployments/${mongoDbId}`);
                    }, 1000);
                  } else {
                    console.warn('Could not extract MongoDB ID from completion message:', completionLog.message);
                    toast.success('Deployment completed successfully!');
                    // Fetch the updated deployment list
                    fetchDeployments();
                  }
                } else {
                  setDeploymentStatus('error');
                }
                setIsDeploying(false);
              }
            }
          })
          .catch(error => console.error('Error fetching logs:', error));
      }
    }, 3000); // Reduced from 8000ms to 3000ms for quicker response to quick deployments
    
    // Handle connection open
    if (eventSourceRef.current) {
      eventSourceRef.current.onopen = () => {
        console.log('SSE connection established');
        hasReceivedInitialConnection = true;
        
        // Clear the connection timeout
        clearTimeout(connectionTimeout);
      };
      
      // Handle incoming messages
      eventSourceRef.current.onmessage = (event) => {
        try {
          // Log raw event data for debugging
          console.log('Raw SSE event:', event.data);
          
          // Skip processing keepalive messages
          if (event.data.startsWith(':')) {
            console.log('Received keepalive message');
            return;
          }
          
          const log = JSON.parse(event.data) as DeploymentLog;
          console.log('Parsed log:', log);
          
          // If this is not the initial connection message, mark that we've received logs
          if (!(log.type === 'info' && log.message === 'SSE connection established')) {
            hasReceivedLogs = true;
          }
          
          // Add the log to the state
          setDeploymentLogs(prev => [...prev, log]);
          
          // Check if this log indicates deployment completion
          if (log.type === 'success' && log.message.includes('completed successfully')) {
            console.log('Deployment completed successfully');
            setDeploymentStatus('success');
            setIsDeploying(false);
            shouldReconnect = false;
            
            // Extract the deployment ID from the completion message
            // First try to find the deploymentId pattern (deploy_timestamp_random)
            const deployIdMatch = log.message.match(/deploymentId: (deploy_\d+_[a-z]+)/);
            if (deployIdMatch && deployIdMatch[1]) {
              const deploymentId = deployIdMatch[1];
              console.log(`Extracted deployment ID: ${deploymentId}`);
              
              // Show success toast
              toast.success('Deployment completed successfully!');
              
              // Navigate to the deployment details page after a short delay
              setTimeout(() => {
                router.push(`/dashboard/deployments/${deploymentId}`);
              }, 1000);
            } 
            // If no deploymentId pattern found, try to find MongoDB ObjectId
            else {
              const mongoIdMatch = log.message.match(/saved to database with ID: ([a-f0-9]+)/);
              if (mongoIdMatch && mongoIdMatch[1]) {
                const mongoDbId = mongoIdMatch[1];
                console.log(`Extracted deployment MongoDB ID: ${mongoDbId}`);
                
                // Show success toast
                toast.success('Deployment completed successfully!');
                
                // Navigate to the deployment details page after a short delay
                setTimeout(() => {
                  router.push(`/dashboard/deployments/${mongoDbId}`);
                }, 1000);
              } else {
                console.warn('Could not extract any ID from completion message:', log.message);
                toast.success('Deployment completed successfully!');
              }
            }
            
            // Close the connection after a short delay to ensure all logs are received
            setTimeout(() => {
              console.log('Closing EventSource connection after successful deployment');
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
              }
            }, 2000);
          } else if (log.type === 'error' && log.message.includes('failed')) {
            console.log('Deployment failed');
            setDeploymentStatus('error');
            setIsDeploying(false);
            shouldReconnect = false;
            
            // Close the connection after a short delay to ensure all logs are received
            setTimeout(() => {
              console.log('Closing EventSource connection after deployment error');
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
              }
            }, 2000);
          }
        } catch (error) {
          console.error('Error processing SSE message:', error);
        }
      };
      
      // Listen for completion events
      eventSourceRef.current.addEventListener('completion', (event: any) => {
        try {
          console.log('Received completion event:', event.data);
          
          const completionData = JSON.parse(event.data);
          hasReceivedCompletionEvent = true;
          
          // Update the deployment status based on the completion event
          if (completionData.success) {
            console.log('Deployment completed successfully');
            setDeploymentStatus('success');
            
            // Extract the deployment ID from the completion data
            // First try to find the deploymentId pattern (deploy_timestamp_random)
            const deployIdMatch = completionData.deploymentId.match(/deploy_\d+_[a-z]+/);
            if (deployIdMatch) {
              const deploymentId = deployIdMatch[0];
              console.log(`Extracted deployment ID: ${deploymentId}`);
              
              // Show success toast
              toast.success('Deployment completed successfully!');
              
              // Navigate to the deployment details page after a short delay
              setTimeout(() => {
                router.push(`/dashboard/deployments/${deploymentId}`);
              }, 1000);
            } 
            // If no deploymentId pattern found, try to find MongoDB ObjectId
            else if (completionData.deploymentId) {
              const mongoDbId = completionData.deploymentId;
              console.log(`Extracted deployment MongoDB ID: ${mongoDbId}`);
              
              // Show success toast
              toast.success('Deployment completed successfully!');
              
              // Navigate to the deployment details page after a short delay
              setTimeout(() => {
                router.push(`/dashboard/deployments/${mongoDbId}`);
              }, 1000);
            } else {
              console.warn('No deploymentId in completion event:', completionData);
              toast.success('Deployment completed successfully!');
              // Fetch the updated deployment to get the gateway URL
              fetchDeployments();
            }
          } else {
            console.log('Deployment failed');
            setDeploymentStatus('error');
          }
          
          // Update the isDeploying state
          setIsDeploying(false);
          shouldReconnect = false;
          
          // Close the connection
          console.log('Closing EventSource connection after completion event');
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
          }
        } catch (error) {
          console.error('Error processing completion event:', error);
        }
      });
      
      // Handle connection errors
      eventSourceRef.current.onerror = (error) => {
        console.error('SSE connection error:', error);
        
        // If the connection is closed, don't try to reconnect
        if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.CLOSED) {
          console.log('SSE connection closed');
          
          // If we haven't received any logs yet, try to fetch them directly
          if (!hasReceivedLogs && !hasReceivedCompletionEvent) {
            console.log('No logs received before connection closed. Fetching logs directly...');
            
            // First try the embedded logs endpoint
            fetch(`/api/deployments/${deploymentId}/embedded-logs`)
              .then(response => {
                if (!response.ok) {
                  // If embedded logs endpoint fails, try the legacy endpoint
                  return fetch(`/api/deployment-logs/fetch?deploymentId=${deploymentId}`);
                }
                return response;
              })
              .then(response => response.json())
              .then(logs => {
                if (logs && logs.length > 0) {
                  setDeploymentLogs(prev => [...prev, ...logs]);
                  
                  // Check if any of the logs indicate completion
                  const completionLog = logs.find((log: DeploymentLog) => 
                    (log.type === 'success' && log.message.includes('completed successfully')) ||
                    (log.type === 'error' && log.message.includes('failed'))
                  );
                  
                  if (completionLog) {
                    if (completionLog.type === 'success') {
                      setDeploymentStatus('success');
                      
                      // Extract the deployment ID from the completion message
                      // First try to find the deploymentId pattern (deploy_timestamp_random)
                      const deployIdMatch = completionLog.message.match(/deploymentId: (deploy_\d+_[a-z]+)/);
                      if (deployIdMatch && deployIdMatch[1]) {
                        const deploymentId = deployIdMatch[1];
                        console.log(`Extracted deployment ID: ${deploymentId}`);
                        
                        // Show success toast
                        toast.success('Deployment completed successfully!');
                        
                        // Navigate to the deployment details page after a short delay
                        setTimeout(() => {
                          router.push(`/dashboard/deployments/${deploymentId}`);
                        }, 1000);
                      } 
                      // If no deploymentId pattern found, try to find MongoDB ObjectId
                      else {
                        const mongoIdMatch = completionLog.message.match(/saved to database with ID: ([a-f0-9]+)/);
                        if (mongoIdMatch && mongoIdMatch[1]) {
                          const mongoDbId = mongoIdMatch[1];
                          console.log(`Extracted deployment MongoDB ID: ${mongoDbId}`);
                          
                          // Show success toast
                          toast.success('Deployment completed successfully!');
                          
                          // Navigate to the deployment details page after a short delay
                          setTimeout(() => {
                            router.push(`/dashboard/deployments/${mongoDbId}`);
                          }, 1000);
                        } else {
                          console.warn('Could not extract any ID from completion message:', completionLog.message);
                          toast.success('Deployment completed successfully!');
                        }
                      }
                    } else {
                      setDeploymentStatus('error');
                    }
                    setIsDeploying(false);
                  }
                }
              })
              .catch(error => console.error('Error fetching logs:', error));
          }
        } else {
          // Add an error message to the logs
          setDeploymentLogs(prev => [...prev, {
            type: 'error',
            message: 'Connection error. Reconnecting...',
            timestamp: new Date().toISOString()
          }]);
        }
      };
    }
    
    // Return a cleanup function
    return () => {
      // Prevent further reconnection attempts
      shouldReconnect = false;
      
      // Clear the timeouts
      clearTimeout(connectionTimeout);
      clearTimeout(processingTimeout);
      
      if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
        console.log('Cleaning up EventSource connection');
        eventSourceRef.current.close();
      }
      eventSourceRef.current = null;
    };
  };

  // Function to check the deployment status
  const checkDeploymentStatus = (depId: string) => {
    console.log(`Checking deployment status for ${depId}...`);
    
    // Fetch the deployment details to check its status
    fetch(`/api/deployments/${depId}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch deployment status');
        }
        return response.json();
      })
      .then(deployment => {
        console.log('Deployment status:', deployment.status);
        
        // If the deployment is completed or failed, update the UI
        if (deployment.status === 'success' || deployment.status === 'failed') {
          console.log(`Deployment ${depId} is ${deployment.status}`);
          
          if (deployment.status === 'success') {
            setDeploymentStatus('success');
            
            // Add a completion log if we don't have one
            setDeploymentLogs(prev => [
              ...prev, 
              {
                type: 'success',
                message: 'Deployment completed successfully',
                timestamp: new Date().toISOString()
              }
            ]);
            
            // Fetch the updated deployment to get the gateway URL
            fetchDeployments();
          } else {
            setDeploymentStatus('error');
            
            // Add a failure log if we don't have one
            setDeploymentLogs(prev => [
              ...prev, 
              {
                type: 'error',
                message: 'Deployment failed',
                timestamp: new Date().toISOString()
              }
            ]);
          }
          
          setIsDeploying(false);
          
          // Close the connection if it exists
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        } else if (deployment.status === 'in-progress') {
          // If still in progress, schedule another check
          setTimeout(() => checkDeploymentStatus(depId), 2000);
        }
      })
      .catch(error => {
        console.error('Error checking deployment status:', error);
      });
  };

  // Clean up EventSource connection on unmount
  useEffect(() => {
    // Clean up function
    return () => {
      if (eventSourceRef.current) {
        console.log('Component unmounting, closing EventSource connection');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      // Dismiss any lingering toasts when component unmounts
      cleanupAllToasts();
    };
  }, []);

  // Effect to clean up connections when deployment state changes
  useEffect(() => {
    // If deployment is no longer in progress, close any existing connections
    if (!isDeploying && eventSourceRef.current) {
      console.log('Deployment no longer in progress, closing EventSource connection');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, [isDeploying]);

  const handleDeploy = async () => {
    if (!selectedRepo || !selectedBranch) {
      toast.error("Please select a repository and branch");
      return;
    }
    
    if (isDeploying) {
      toast.error("A deployment is already in progress");
      return;
    }

    try {
      // Clean up any previous deployment state
      if (eventSourceRef.current) {
        console.log('Closing existing EventSource connection before starting new deployment');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      // Clear any previous deployment logs
      setDeploymentLogs([]);
      setCurrentDeploymentId(null);
      
      // Clean up any lingering toasts
      cleanupAllToasts();
      
      setIsDeploying(true);
      
      // Show initial toast only for starting the deployment
      const loadingToastId = toast.loading("Starting deployment...");
      setDeploymentProgressId(loadingToastId as string);
      
      // Verify repository access first
      const [owner, repo] = selectedRepo.full_name.split("/");
      const hasAccess = await verifyRepositoryAccess(owner, repo);
      
      if (!hasAccess) {
        toast.dismiss(loadingToastId);
        setDeploymentProgressId(null);
        setIsDeploying(false);
        return; // The access request modal will be shown by verifyRepositoryAccess
      }
      
      // For static websites without a build command, use "." as the output directory
      const effectiveOutputDirectory = projectType === "static" && !buildCommand ? "." : outputDirectory;
      
      // Set up a timeout for the deployment
      const deploymentTimeout = setTimeout(() => {
        if (deploymentProgressId) {
          toast.error("Deployment timed out. This could be due to a large repository or slow network connection.");
          setIsDeploying(false);
          setDeploymentProgressId(null);
        }
      }, 20 * 60 * 1000); // 20 minutes timeout
      
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repoFullName: selectedRepo.full_name,
          branch: selectedBranch,
          buildCommand: buildCommand || null,
          outputDirectory: effectiveOutputDirectory,
          projectType,
        }),
      });

      // Clear the timeout
      clearTimeout(deploymentTimeout);
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Deployment failed";
        
        // Check if there's a suggestion for timeout errors
        if (errorData.suggestion) {
          toast.error(
            <div>
              <p className="font-medium">{errorMessage}</p>
              <p className="text-sm mt-1">{errorData.suggestion}</p>
            </div>
          );
        } else {
          toast.error(errorMessage);
        }
        
        setIsDeploying(false);
        setDeploymentProgressId(null);
        return;
      }

      const data = await response.json();
      
      // Connect to the SSE endpoint for deployment logs
      if (data.deploymentId) {
        // Dismiss the initial loading toast since we'll now show logs
        toast.dismiss(loadingToastId);
        setDeploymentProgressId(null);
        
        // Connect to deployment logs
        connectToDeploymentLogs(data.deploymentId);
      } else {
        // If no deployment ID was returned, dismiss the toast and reset state
        toast.dismiss(loadingToastId);
        setDeploymentProgressId(null);
        setIsDeploying(false);
        toast.error("Failed to start deployment: No deployment ID returned");
      }
    } catch (error) {
      console.error("Error deploying:", error);
      toast.error("Deployment failed: Network error or server issue");
      setIsDeploying(false);
      if (deploymentProgressId) {
        toast.dismiss(deploymentProgressId);
        setDeploymentProgressId(null);
      }
    }
  };

  const handleRequestAccess = async () => {
    try {
      // Copy the repository URL to clipboard
      await navigator.clipboard.writeText(requestRepoUrl);
      
      // Create email template with pre-filled content
      const subject = encodeURIComponent(`Request for access to ${requestRepoOwner}/${requestRepoName}`);
      const body = encodeURIComponent(
        `Hi,\n\nI would like to request access to the repository ${requestRepoOwner}/${requestRepoName}.\n\n` +
        `Repository URL: ${requestRepoUrl}\n\n` +
        `Could you please either:\n` +
        `1. Make the repository public, or\n` +
        `2. Add me as a collaborator\n\n` +
        `Thank you!`
      );
      
      // Open email client with pre-filled content
      window.open(`mailto:?subject=${subject}&body=${body}`);
      
      toast.success("Repository URL copied and email template prepared");
      setShowAccessRequestModal(false);
    } catch (error) {
      console.error("Error handling request access:", error);
      toast.error("Failed to copy repository URL");
    }
  };

  const handleManualRepoSubmit = async () => {
    if (!manualRepoUrl) {
      toast.error("Please enter a repository URL");
      return;
    }

    setIsValidatingRepo(true);

    try {
      // Extract owner and repo from URL
      // Support formats like:
      // https://github.com/owner/repo
      // github.com/owner/repo
      // owner/repo
      let owner = "";
      let repo = "";

      if (manualRepoUrl.includes("github.com")) {
        const urlParts = manualRepoUrl.split("github.com/");
        if (urlParts.length > 1) {
          const pathParts = urlParts[1].split("/");
          if (pathParts.length >= 2) {
            owner = pathParts[0];
            repo = pathParts[1].replace(".git", "");
          }
        }
      } else if (manualRepoUrl.includes("/")) {
        const pathParts = manualRepoUrl.split("/");
        if (pathParts.length >= 2) {
          owner = pathParts[0];
          repo = pathParts[1].replace(".git", "");
        }
      }

      if (!owner || !repo) {
        toast.error("Invalid repository URL format. Please use owner/repo or github.com/owner/repo");
        setIsValidatingRepo(false);
        return;
      }

      // Verify repository access
      const hasAccess = await verifyRepositoryAccess(owner, repo);
      
      if (!hasAccess) {
        // Show the access request modal
        setRequestRepoName(repo);
        setRequestRepoOwner(owner);
        setRequestRepoUrl(`https://github.com/${owner}/${repo}`);
        setRequestRepoVisibility(selectedRepo?.visibility === "public" ? "public" : "private");
        setShowAccessRequestModal(true);
        setShowManualRepoModal(false);
        setIsValidatingRepo(false);
        return;
      }

      // Create a mock repository object
      const mockRepo: Repository = {
        id: Date.now(),
        name: repo,
        full_name: `${owner}/${repo}`,
        html_url: `https://github.com/${owner}/${repo}`,
        description: "Manually added repository",
        default_branch: manualRepoBranch,
        visibility: "unknown",
        updated_at: new Date().toISOString(),
      };

      // Set as selected repository
      setSelectedRepo(mockRepo);
      
      // Fetch branches
      fetchBranches(owner, repo);
      
      // Close the modal
      setShowManualRepoModal(false);
      toast.success("Repository added successfully");
    } catch (error) {
      console.error("Error adding repository:", error);
      toast.error("Failed to add repository");
    } finally {
      setIsValidatingRepo(false);
    }
  };

  const fetchDeployments = async () => {
    setIsLoadingDeployments(true);
    try {
      const response = await fetch("/api/deployments");
      if (!response.ok) {
        throw new Error("Failed to fetch deployments");
      }
      const data = await response.json();
      const deploymentsArray = Array.isArray(data) ? data : [];
      setDeployments(deploymentsArray);
      setFilteredDeployments(deploymentsArray);
    } catch (error) {
      console.error("Error fetching deployments:", error);
      toast.error("Failed to load deployments");
      setDeployments([]);
      setFilteredDeployments([]);
    } finally {
      setIsLoadingDeployments(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getProjectTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "react":
        return <Component1Icon className="h-5 w-5 text-blue-500" />;
      case "static":
        return <GlobeIcon className="h-5 w-5 text-green-500" />;
      default:
        return <Server className="h-5 w-5 text-purple-500" />;
    }
  };

  // Get current deployments for pagination
  const indexOfLastDeployment = currentPage * deploymentsPerPage;
  const indexOfFirstDeployment = indexOfLastDeployment - deploymentsPerPage;
  const currentDeployments = Array.isArray(filteredDeployments) 
    ? filteredDeployments.slice(indexOfFirstDeployment, indexOfLastDeployment)
    : [];

  // Calculate total pages
  const totalPages = Math.ceil((Array.isArray(filteredDeployments) ? filteredDeployments.length : 0) / deploymentsPerPage);

  // Generate page numbers
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  const filteredRepositories = repositories.filter((repo) =>
    repo.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Function to format the timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  
  // Function to get the color class for a log type
  const getLogTypeClass = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-500 dark:text-green-400';
      case 'error':
        return 'text-red-500 dark:text-red-400';
      case 'info':
      default:
        return 'text-blue-500 dark:text-blue-400';
    }
  };
  
  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="container py-8 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Deploy and manage your web applications
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => setShowGitHubAccessModal(true)} variant="outline" className="gap-2">
              <GitHubLogoIcon className="h-4 w-4" />
              Add Repository Access
            </Button>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="deploy">Deploy</TabsTrigger>
          </TabsList>
          
          <TabsContent value="deploy" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Select Repository</CardTitle>
                  <CardDescription>
                    Choose a GitHub repository to deploy
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Input
                      placeholder="Search repositories..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="flex-1 mr-2"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => setShowManualRepoModal(true)}
                      size="sm"
                    >
                      Add Repo
                    </Button>
                  </div>
                  <div className="h-80 overflow-y-auto border rounded-md">
                    {isLoading ? (
                      <div className="flex justify-center items-center h-full">
                        <p className="text-muted-foreground">Loading repositories...</p>
                      </div>
                    ) : filteredRepositories.length === 0 ? (
                      <div className="flex justify-center items-center h-full">
                        <p className="text-muted-foreground">No repositories found</p>
                      </div>
                    ) : (
                      <ul className="divide-y">
                        {filteredRepositories.map((repo) => (
                          <li
                            key={repo.id}
                            className={`p-3 hover:bg-muted cursor-pointer ${
                              selectedRepo?.id === repo.id ? "bg-muted" : ""
                            }`}
                            onClick={() => handleRepoSelect(repo)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{repo.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {repo.full_name}
                                </p>
                              </div>
                              <div className="flex items-center">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  repo.visibility === "public" 
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                }`}>
                                  {repo.visibility}
                                </span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  
                  {selectedRepo && (
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Branch
                      </label>
                      <select
                        className="w-full p-2 border rounded-md bg-background"
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                      >
                        {branches.map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Deployment Settings</CardTitle>
                  <CardDescription>
                    Configure how your website will be deployed
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedRepo && (
                    <div className="bg-muted p-3 rounded-md mb-2">
                      <h3 className="text-sm font-medium">Selected Repository</h3>
                      <div className="flex items-center justify-between">
                        <p className="text-sm">{selectedRepo.full_name}</p>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          selectedRepo.visibility === "public" 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}>
                          {selectedRepo.visibility}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Branch: {selectedBranch || selectedRepo.default_branch}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Project Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={projectType === "static" ? "default" : "outline"}
                        onClick={() => setProjectType("static")}
                        className="w-full justify-start"
                      >
                        <GlobeIcon className="w-4 h-4 mr-2" />
                        Static
                      </Button>
                      <Button
                        type="button"
                        variant={projectType === "react" ? "default" : "outline"}
                        onClick={() => {
                          setProjectType("react");
                          if (!buildCommand) setBuildCommand("npm run build");
                          if (!outputDirectory) setOutputDirectory("build");
                        }}
                        className="w-full justify-start"
                      >
                        <Component1Icon className="w-4 h-4 mr-2" />
                        React
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {projectType === "react" ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          Note: Only client-side React apps are supported. No server-side code will work.
                        </span>
                      ) : (
                        "Select the type of project you're deploying"
                      )}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Build Command {projectType !== "static" && <span className="text-red-500">*</span>}
                    </label>
                    <Input
                      placeholder={
                        projectType === "static" 
                          ? "Leave empty for static websites" 
                          : "npm run build"
                      }
                      value={buildCommand}
                      onChange={(e) => setBuildCommand(e.target.value)}
                      disabled={projectType === "static"}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {projectType === "static" 
                        ? "Static websites don't require a build command" 
                        : "Command to build your application (e.g., npm run build)"}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Output Directory {projectType !== "static" && <span className="text-red-500">*</span>}
                    </label>
                    <Input
                      placeholder={
                        projectType === "static" 
                          ? "." 
                          : "build"
                      }
                      value={outputDirectory}
                      onChange={(e) => setOutputDirectory(e.target.value)}
                      disabled={projectType === "static"}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {projectType === "static" 
                        ? "For static websites, the root directory will be used" 
                        : "Directory containing built files (usually 'build')"}
                    </p>
                  </div>
                  
                  {/* Deployment Logs */}
                  {isDeploying && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium">Deployment Logs</h3>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-2"></div>
                          Deployment in progress
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-2 h-64 overflow-y-auto text-xs font-mono">
                        {deploymentLogs.length > 0 ? (
                          deploymentLogs.map((log, index) => (
                            <div key={index} className="py-1">
                              <span className="text-gray-500 dark:text-gray-400">[{formatTimestamp(log.timestamp)}] </span>
                              <span className={getLogTypeClass(log.type)}>{log.message}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex justify-center items-center h-full text-muted-foreground">
                            Waiting for logs...
                          </div>
                        )}
                        <div ref={logsEndRef} />
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col space-y-2">
                  <Button 
                    onClick={handleDeploy} 
                    disabled={isLoading || isDeploying || !selectedRepo || !selectedBranch}
                    className="w-full"
                  >
                    {isDeploying ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Deploying...
                      </>
                    ) : (
                      "Deploy to IPFS"
                    )}
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    Deployment time depends on project size. Large projects may take several minutes.
                  </p>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Repository Access Request Modal */}
        {showAccessRequestModal && (
          <Dialog open={showAccessRequestModal} onOpenChange={(open) => !open && setShowAccessRequestModal(false)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Repository Access Required</DialogTitle>
                <DialogDescription>
                  This repository is {requestRepoVisibility}. You'll need permission from the owner to access it.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-4">
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-amber-800 dark:text-amber-300">
                      <p>You can either request access from the repository owner or update your GitHub permissions.</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Repository Details</h3>
                  <div className="bg-muted p-3 rounded-md space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Owner:</span> {requestRepoOwner}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Repository:</span> {requestRepoName}
                    </div>
                    <div className="break-all">
                      <span className="text-muted-foreground">URL:</span> {requestRepoUrl}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Options to Get Access</h3>
                  <div className="space-y-4">
                    <div className="border border-border rounded-md p-3">
                      <h4 className="font-medium text-sm mb-1">Option 1: Contact Repository Owner</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Request the owner to add you as a collaborator or make the repository public.
                      </p>
                      <Button 
                        variant="outline" 
                        onClick={handleRequestAccess}
                        className="w-full"
                        size="sm"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Prepare Email Request
                      </Button>
                    </div>
                    
                    <div className="border border-primary/20 bg-primary/5 rounded-md p-3">
                      <h4 className="font-medium text-sm mb-1">Option 2: Update GitHub Permissions</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Re-authenticate with GitHub to grant WebHash access to more repositories.
                      </p>
                      <Button 
                        onClick={() => {
                          setShowAccessRequestModal(false);
                          setShowGitHubAccessModal(true);
                        }}
                        className="w-full"
                        size="sm"
                      >
                        <GitHubLogoIcon className="h-4 w-4 mr-2" />
                        Update GitHub Permissions
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setShowAccessRequestModal(false)}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        
        {/* Manual Repository Modal */}
        {showManualRepoModal && (
          <Dialog open={showManualRepoModal} onOpenChange={(open) => !open && setShowManualRepoModal(false)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Repository Manually</DialogTitle>
                <DialogDescription>
                  Enter the GitHub repository URL or owner/repo format to add a repository that doesn't appear in your list.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Repository URL or owner/repo
                  </label>
                  <Input
                    placeholder="e.g., github.com/owner/repo or owner/repo"
                    value={manualRepoUrl}
                    onChange={(e) => setManualRepoUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: github.com/vercel/next.js or vercel/next.js
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Default Branch
                  </label>
                  <Input
                    placeholder="main"
                    value={manualRepoBranch}
                    onChange={(e) => setManualRepoBranch(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usually 'main' or 'master'
                  </p>
                </div>
                <DialogFooter className="flex space-x-2 sm:justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowManualRepoModal(false)}
                    disabled={isValidatingRepo}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleManualRepoSubmit}
                    disabled={isValidatingRepo}
                  >
                    {isValidatingRepo ? "Validating..." : "Add Repository"}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        )}
        
        {/* GitHub Access Modal */}
        <GitHubAccessModal 
          isOpen={showGitHubAccessModal} 
          onClose={() => setShowGitHubAccessModal(false)} 
        />
      </main>
    </div>
  );
}