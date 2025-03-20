import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface DeploymentLog {
  deploymentId?: string;
  type: 'info' | 'error' | 'success';
  message: string;
  timestamp: string;
  _id?: string; // Make _id optional since it might not exist in the new structure
}

interface DeploymentLogsProps {
  deploymentId: string;
  useEmbeddedLogs?: boolean; // Flag to determine which API to use
  onLogsComplete?: (success: boolean) => void; // Callback for when logs are complete
  withoutCard?: boolean; // Flag to determine whether to render the Card container
}

export default function DeploymentLogs({ deploymentId, useEmbeddedLogs = true, onLogsComplete, withoutCard = false }: DeploymentLogsProps) {
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deploymentId) return;

    console.log(`Setting up SSE connection for deployment ${deploymentId}`);
    
    // Add a timestamp and random string to prevent caching
    const timestamp = new Date().getTime();
    const random = Math.random().toString(36).substring(2, 15);
    const eventSource = new EventSource(`/api/deployment-logs?deploymentId=${deploymentId}&_=${timestamp}&r=${random}`);
    
    // Track if we've received any logs beyond the initial connection message
    let hasReceivedLogs = false;
    let hasReceivedInitialConnection = false;
    let hasReceivedCompletionEvent = false;
    
    // Set a connection timeout
    const connectionTimeout = setTimeout(() => {
      if (eventSource.readyState !== EventSource.OPEN) {
        console.error('SSE connection timeout');
        setLogs(prev => [...prev, {
          type: 'error',
          message: 'Connection timeout. Attempting to reconnect...',
          timestamp: new Date().toISOString()
        }]);
        
        // Close the connection and try again
        eventSource.close();
        
        // If we haven't received any logs, try to fetch them directly
        if (!hasReceivedLogs && !hasReceivedCompletionEvent) {
          fetchLogsDirectly();
        }
      }
    }, 10000);
    
    // Set a processing timeout to detect if we're not receiving expected logs
    const processingTimeout = setTimeout(() => {
      console.log('Checking if logs have been received...');
      
      if (!hasReceivedInitialConnection) {
        console.log('No initial connection message received. Attempting to reconnect...');
        setLogs(prev => [...prev, {
          type: 'info',
          message: 'No connection established. Reconnecting...',
          timestamp: new Date().toISOString()
        }]);
        
        // Close the connection
        eventSource.close();
        
        // Try to fetch logs directly
        fetchLogsDirectly();
      } else if (!hasReceivedLogs && !hasReceivedCompletionEvent) {
        // If we've received the initial connection but no logs, fetch them directly
        console.log('Connection established but no logs received. Fetching logs directly...');
        fetchLogsDirectly();
      }
    }, 2000);
    
    // Function to fetch logs directly from the API
    const fetchLogsDirectly = () => {
      console.log('Fetching logs directly...');
      setIsLoading(true);
      
      // First try the embedded logs endpoint if enabled
      if (useEmbeddedLogs) {
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
            setIsLoading(false);
            
            if (logs && logs.length > 0) {
              console.log(`Found ${logs.length} logs for deployment ${deploymentId}`);
              setLogs(prev => [...prev, ...logs]);
              hasReceivedLogs = true;
              
              // Check if any of the logs indicate completion
              // First prioritize success logs
              const successLog = logs.find((log: DeploymentLog) => 
                log.type === 'success' && log.message.includes('completed successfully')
              );
              
              if (successLog) {
                console.log('Found success completion log:', successLog);
                hasReceivedCompletionEvent = true;
                onLogsComplete?.(true); // Always true for success logs
              } else {
                // Only look for error logs if no success log was found
                const errorLog = logs.find((log: DeploymentLog) => 
                  log.type === 'error' && log.message.includes('failed')
                );
                
                if (errorLog) {
                  console.log('Found error completion log:', errorLog);
                  hasReceivedCompletionEvent = true;
                  onLogsComplete?.(false);
                } else {
                  // If no completion log was found but we have logs, check if the deployment is still in progress
                  checkDeploymentStatus();
                }
              }
            } else {
              console.log('No logs found, checking deployment status');
              // If no logs were found, check the deployment status
              checkDeploymentStatus();
            }
          })
          .catch(error => {
            console.error('Error fetching logs:', error);
            setIsLoading(false);
            setError('Failed to fetch logs. Please try again.');
            
            // Even if fetching logs fails, check the deployment status
            checkDeploymentStatus();
          });
      } else {
        // Use legacy endpoint directly if embedded logs are disabled
        fetch(`/api/deployment-logs/fetch?deploymentId=${deploymentId}`)
          .then(response => response.json())
          .then(logs => {
            setIsLoading(false);
            
            if (logs && logs.length > 0) {
              console.log(`Found ${logs.length} logs for deployment ${deploymentId}`);
              setLogs(prev => [...prev, ...logs]);
              hasReceivedLogs = true;
              
              // Check if any of the logs indicate completion
              // First prioritize success logs
              const successLog = logs.find((log: DeploymentLog) => 
                log.type === 'success' && log.message.includes('completed successfully')
              );
              
              if (successLog) {
                console.log('Found success completion log:', successLog);
                hasReceivedCompletionEvent = true;
                onLogsComplete?.(true); // Always true for success logs
              } else {
                // Only look for error logs if no success log was found
                const errorLog = logs.find((log: DeploymentLog) => 
                  log.type === 'error' && log.message.includes('failed')
                );
                
                if (errorLog) {
                  console.log('Found error completion log:', errorLog);
                  hasReceivedCompletionEvent = true;
                  onLogsComplete?.(false);
                } else {
                  // If no completion log was found, check the deployment status
                  checkDeploymentStatus();
                }
              }
            } else {
              console.log('No logs found, checking deployment status');
              // If no logs were found, check the deployment status
              checkDeploymentStatus();
            }
          })
          .catch(error => {
            console.error('Error fetching logs:', error);
            setIsLoading(false);
            setError('Failed to fetch logs. Please try again.');
            
            // Even if fetching logs fails, check the deployment status
            checkDeploymentStatus();
          });
      }
    };
    
    // Function to check the deployment status
    const checkDeploymentStatus = () => {
      console.log('Checking deployment status...');
      
      // Fetch the deployment details to check its status
      fetch(`/api/deployments/${deploymentId}`)
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch deployment status');
          }
          return response.json();
        })
        .then(deployment => {
          console.log('Deployment status:', deployment.status);
          
          // If the deployment is completed or failed, notify the callback
          if (deployment.status === 'success' || deployment.status === 'failed') {
            console.log(`Deployment ${deploymentId} is ${deployment.status}`);
            hasReceivedCompletionEvent = true;
            onLogsComplete?.(deployment.status === 'success');
            
            // Add a completion log if we don't have one
            if (deployment.status === 'success') {
              setLogs(prev => [
                ...prev, 
                {
                  type: 'success',
                  message: 'Deployment completed successfully',
                  timestamp: new Date().toISOString()
                }
              ]);
            } else {
              setLogs(prev => [
                ...prev, 
                {
                  type: 'error',
                  message: 'Deployment failed',
                  timestamp: new Date().toISOString()
                }
              ]);
            }
          } else if (deployment.status === 'in-progress') {
            // If still in progress, schedule another check
            setTimeout(checkDeploymentStatus, 2000);
          }
        })
        .catch(error => {
          console.error('Error checking deployment status:', error);
        });
    };
    
    // Handle connection open
    eventSource.onopen = () => {
      console.log('SSE connection established');
      hasReceivedInitialConnection = true;
      
      // Clear the connection timeout
      clearTimeout(connectionTimeout);
    };
    
    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        // Skip processing keepalive messages
        if (event.data.startsWith(':')) {
          console.log('Received keepalive message');
          return;
        }
        
        const log = JSON.parse(event.data) as DeploymentLog;
        console.log('Received log:', log);
        
        // If this is not the initial connection message, mark that we've received logs
        if (!(log.type === 'info' && log.message === 'SSE connection established')) {
          hasReceivedLogs = true;
          
          // Clear the processing timeout since we're receiving logs
          clearTimeout(processingTimeout);
        }
        
        // Add the log to the state
        setLogs(prev => [...prev, log]);
        
        // Check if this log indicates deployment completion
        // Prioritize success logs over error logs
        if (log.type === 'success' && log.message.includes('completed successfully')) {
          console.log('Deployment completed successfully');
          hasReceivedCompletionEvent = true;
          onLogsComplete?.(true);
          
          // Close the connection after a short delay to ensure all logs are received
          setTimeout(() => {
            eventSource.close();
          }, 2000);
        } 
        // Only process error logs if we haven't already received a success log
        else if (!hasReceivedCompletionEvent && log.type === 'error' && log.message.includes('failed')) {
          console.log('Deployment failed');
          hasReceivedCompletionEvent = true;
          onLogsComplete?.(false);
          
          // Close the connection after a short delay to ensure all logs are received
          setTimeout(() => {
            eventSource.close();
          }, 2000);
        }
      } catch (error) {
        console.error('Error processing SSE message:', error);
      }
    };
    
    // Listen for completion events
    eventSource.addEventListener('completion', (event: any) => {
      try {
        console.log('Received completion event:', event.data);
        
        const completionData = JSON.parse(event.data);
        
        // Add the completion message to the logs
        setLogs(prev => [...prev, {
          type: completionData.type,
          message: completionData.message,
          timestamp: completionData.timestamp
        }]);
        
        // Only set completion if we haven't already received a success completion
        // This ensures success events take priority over error events
        if (!hasReceivedCompletionEvent || completionData.type === 'completion_success') {
          hasReceivedCompletionEvent = true;
          
          // Notify parent component about completion
          onLogsComplete?.(completionData.type === 'completion_success');
        }
        
        // Close the connection
        console.log('Closing EventSource connection after completion event');
        eventSource.close();
      } catch (error) {
        console.error('Error processing completion event:', error);
      }
    });
    
    // Handle connection errors
    eventSource.onerror = (error) => {
      // Don't log the error object directly as it may be empty
      console.error('SSE connection error occurred');
      
      // If the connection is closed, try to fetch logs directly
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('SSE connection closed');
        
        // If we haven't received any logs yet, try to fetch them directly
        if (!hasReceivedLogs && !hasReceivedCompletionEvent) {
          console.log('Connection closed without receiving logs. Fetching logs directly...');
          fetchLogsDirectly();
        }
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        console.log('SSE connection is attempting to reconnect...');
      }
    };
    
    return () => {
      console.log('Cleaning up SSE connection');
      clearTimeout(connectionTimeout);
      clearTimeout(processingTimeout);
      eventSource.close();
    };
  }, [deploymentId, useEmbeddedLogs]);

  // Function to format the timestamp
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return '';
    }
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

  return (
    <>
      {withoutCard ? (
        <div>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-destructive">{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-muted-foreground">No logs available for this deployment</p>
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-2 h-64 overflow-y-auto text-xs font-mono">
              {logs.map((log, index) => (
                <div key={log._id || `log-${index}`} className="py-1">
                  <span className="text-gray-500 dark:text-gray-400">[{formatTimestamp(log.timestamp)}] </span>
                  <span className={getLogTypeClass(log.type)}>{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Deployment Logs</CardTitle>
                <CardDescription>
                  Logs from the deployment process
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setLogs([]);
                  setIsLoading(true);
                  setError(null);
                }}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-destructive">{error}</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-muted-foreground">No logs available for this deployment</p>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-2 h-64 overflow-y-auto text-xs font-mono">
                {logs.map((log, index) => (
                  <div key={log._id || `log-${index}`} className="py-1">
                    <span className="text-gray-500 dark:text-gray-400">[{formatTimestamp(log.timestamp)}] </span>
                    <span className={getLogTypeClass(log.type)}>{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}