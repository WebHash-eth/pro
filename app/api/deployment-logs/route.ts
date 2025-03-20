import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { auth } from '@/lib/auth';
import connectToDatabase from '@/app/lib/mongodb';
import mongoose from 'mongoose';

// Map to store active SSE connections by deployment ID
const activeConnections: Map<string, Set<ReadableStreamController<Uint8Array>>> = new Map();

// Queue to store logs for deployments that don't have active connections yet
const logQueue: Map<string, Array<any>> = new Map();

// Queue to store logs for deployments that don't exist in the database yet
const pendingDeploymentLogs: Map<string, Array<any>> = new Map();

// Check for pending logs periodically and try to store them
setInterval(async () => {
  for (const [deploymentId, logs] of pendingDeploymentLogs.entries()) {
    if (logs.length > 0) {
      try {
        // Connect to the database
        await connectToDatabase();
        
        // Check if the database connection is established
        if (!mongoose.connection || !mongoose.connection.db) {
          continue;
        }
        
        // Check if the deployment now exists
        const deployment = await mongoose.connection.db.collection('deployments').findOne({ 
          deploymentId: deploymentId 
        });
        
        if (deployment) {
          console.log(`Found deployment ${deploymentId}, storing ${logs.length} pending logs`);
          
          // Store all pending logs
          for (const log of logs) {
            await mongoose.connection.db.collection('deployments').updateOne(
              { _id: deployment._id },
              { 
                $push: { 
                  logs: {
                    type: log.type,
                    message: log.message,
                    timestamp: new Date(log.timestamp)
                  } 
                } 
              } as any
            );
          }
          
          // Clear the pending logs
          pendingDeploymentLogs.delete(deploymentId);
        }
      } catch (error) {
        console.error(`Error processing pending logs for deployment ${deploymentId}:`, error);
      }
    }
  }
}, 5000); // Check every 5 seconds

/**
 * Send a log update to all connected clients for a specific deployment
 */
export function sendLogUpdate(deploymentId: string, log: any) {
  try {
    console.log(`Attempting to send log update for deployment ${deploymentId}:`, log);
    
    // Normalize the deployment ID (convert to lowercase)
    const normalizedDeploymentId = deploymentId.toLowerCase();
    
    // Store the log in the queue regardless of active connections
    if (!logQueue.has(normalizedDeploymentId)) {
      logQueue.set(normalizedDeploymentId, []);
    }
    logQueue.get(normalizedDeploymentId)!.push(log);
    
    // Limit queue size to prevent memory issues
    const queue = logQueue.get(normalizedDeploymentId)!;
    if (queue.length > 100) {
      queue.shift(); // Remove oldest log if queue gets too large
    }
    
    // Also store the log in the deployment document (embedded logs)
    storeLogInDeployment(deploymentId, log).catch(error => {
      console.error(`Error storing log in deployment document for ${deploymentId}:`, error);
    });
    
    if (!activeConnections.has(normalizedDeploymentId)) {
      console.log(`No active connections for deployment ${deploymentId}, log queued for later delivery`);
      return;
    }
    
    const connections = activeConnections.get(normalizedDeploymentId)!;
    console.log(`Found ${connections.size} active connections for deployment ${deploymentId}`);
    
    if (connections.size === 0) {
      console.log(`No active clients connected for deployment ${deploymentId}, log queued for later delivery`);
      return;
    }
    
    // Convert the log to a string
    const logString = JSON.stringify(log);
    
    // Send the log to all connected clients
    let sentCount = 0;
    for (const controller of connections) {
      try {
        controller.enqueue(new TextEncoder().encode(`data: ${logString}\n\n`));
        sentCount++;
      } catch (error) {
        console.error(`Error sending log to client for deployment ${deploymentId}:`, error);
      }
    }
    
    console.log(`Successfully sent log to ${sentCount}/${connections.size} clients for deployment ${deploymentId}`);
  } catch (error) {
    console.error(`Error in sendLogUpdate for deployment ${deploymentId}:`, error);
  }
}

/**
 * Store a log in the deployment document's embedded logs array
 */
async function storeLogInDeployment(deploymentId: string, log: any) {
  try {
    // Connect to the database
    await connectToDatabase();
    
    // Check if the database connection is established
    if (!mongoose.connection || !mongoose.connection.db) {
      console.error(`Database connection not established for deployment ${deploymentId}`);
      return;
    }
    
    // Check if the ID is a MongoDB ObjectId or a deployment ID string
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(deploymentId);
    
    // Find the deployment
    let deployment;
    
    if (isObjectId) {
      deployment = await mongoose.connection.db.collection('deployments').findOne({ 
        _id: new mongoose.Types.ObjectId(deploymentId) 
      });
    } else {
      deployment = await mongoose.connection.db.collection('deployments').findOne({ 
        deploymentId: deploymentId 
      });
    }
    
    if (!deployment) {
      console.log(`No deployment found with ID ${deploymentId} to store logs`);
      
      // Add the log to the pending deployment logs queue
      if (!pendingDeploymentLogs.has(deploymentId)) {
        pendingDeploymentLogs.set(deploymentId, []);
      }
      pendingDeploymentLogs.get(deploymentId)!.push(log);
      console.log(`Added log to pending queue for deployment ${deploymentId}. Queue size: ${pendingDeploymentLogs.get(deploymentId)!.length}`);
      
      return;
    }
    
    // Add the log to the deployment's logs array
    const result = await mongoose.connection.db.collection('deployments').updateOne(
      { _id: deployment._id },
      { 
        $push: { 
          logs: {
            type: log.type,
            message: log.message,
            timestamp: new Date(log.timestamp)
          } 
        } 
      } as any
    );
    
    console.log(`Stored ${result.modifiedCount} logs for deployment ${deploymentId}`);
    
    // Check if this is a completion log (success or error) and the deployment is not already marked as complete
    if ((log.type === 'success' && log.message.includes('completed successfully')) || 
        (log.type === 'error' && log.message.includes('failed'))) {
      
      // Send a completion event to all connected clients
      sendCompletionEvent(deploymentId, log.type === 'success');
    }
  } catch (error) {
    console.error(`Error storing log in deployment document for ${deploymentId}:`, error);
  }
}

/**
 * Send a completion event to all connected clients for a specific deployment
 */
function sendCompletionEvent(deploymentId: string, isSuccess: boolean) {
  try {
    // Normalize the deployment ID
    const normalizedDeploymentId = deploymentId.toLowerCase();
    
    if (!activeConnections.has(normalizedDeploymentId)) {
      console.log(`No active connections for deployment ${deploymentId}, cannot send completion event`);
      return;
    }
    
    const connections = activeConnections.get(normalizedDeploymentId)!;
    console.log(`Sending completion event to ${connections.size} clients for deployment ${deploymentId}`);
    
    // Create the completion event
    const completionEvent = {
      type: isSuccess ? 'completion_success' : 'completion_error',
      message: isSuccess ? 'Deployment completed successfully' : 'Deployment failed',
      timestamp: new Date().toISOString()
    };
    
    // Convert the event to a string
    const eventString = JSON.stringify(completionEvent);
    
    // Send the completion event to all connected clients
    let sentCount = 0;
    for (const controller of connections) {
      try {
        controller.enqueue(new TextEncoder().encode(`event: completion\ndata: ${eventString}\n\n`));
        sentCount++;
      } catch (error) {
        console.error(`Error sending completion event to client for deployment ${deploymentId}:`, error);
      }
    }
    
    console.log(`Successfully sent completion event to ${sentCount}/${connections.size} clients for deployment ${deploymentId}`);
    
    // Close all connections after sending the completion event
    setTimeout(() => {
      if (activeConnections.has(normalizedDeploymentId)) {
        const connections = activeConnections.get(normalizedDeploymentId)!;
        console.log(`Closing ${connections.size} connections for completed deployment ${deploymentId}`);
        
        // Close all connections
        for (const controller of connections) {
          try {
            controller.close();
          } catch (error) {
            console.error(`Error closing controller for deployment ${deploymentId}:`, error);
          }
        }
        
        // Remove the deployment from active connections
        activeConnections.delete(normalizedDeploymentId);
      }
    }, 2000); // Wait 2 seconds before closing connections
  } catch (error) {
    console.error(`Error sending completion event for deployment ${deploymentId}:`, error);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get the deployment ID from the query parameters
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deploymentId');
    
    console.log(`SSE connection request for deployment ID: ${deploymentId}`);
    
    // Check if the deployment ID is provided
    if (!deploymentId) {
      console.error('Missing deploymentId parameter in SSE request');
      return NextResponse.json({ error: 'Missing deploymentId parameter' }, { status: 400 });
    }
    
    // Normalize the deployment ID (convert to lowercase)
    const normalizedDeploymentId = deploymentId.toLowerCase();
    
    // Check if the user is authenticated
    const session = await getServerSession(auth);
    if (!session) {
      console.error('Unauthorized SSE connection attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Create a new ReadableStream for SSE
    const stream = new ReadableStream({
      start(controller) {
        console.log(`Starting new SSE stream for deployment ${deploymentId}`);
        
        // Add the controller to the active connections
        if (!activeConnections.has(normalizedDeploymentId)) {
          activeConnections.set(normalizedDeploymentId, new Set());
        }
        
        const connections = activeConnections.get(normalizedDeploymentId)!;
        connections.add(controller);
        console.log(`Added new connection. Total connections for deployment ${deploymentId}: ${connections.size}`);
        
        // Send an initial connection message
        const initialMessage = {
          type: 'info',
          message: 'SSE connection established',
          timestamp: new Date().toISOString()
        };
        
        try {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(initialMessage)}\n\n`));
          console.log(`Sent initial connection message to client for deployment ${deploymentId}`);
          
          // Check if there are queued logs for this deployment
          // Debug the log queue state
          console.log(`Log queue keys: ${Array.from(logQueue.keys()).join(', ')}`);
          console.log(`Checking for queued logs for deployment ${normalizedDeploymentId}`);
          
          // Check if there are any logs with a similar deployment ID (case-insensitive)
          const queueKey = Array.from(logQueue.keys()).find(key => 
            key.toLowerCase() === normalizedDeploymentId || 
            normalizedDeploymentId.includes(key.toLowerCase()) || 
            key.toLowerCase().includes(normalizedDeploymentId)
          );
          
          if (queueKey) {
            console.log(`Found matching queue key: ${queueKey} for deployment ${deploymentId}`);
            const queuedLogs = logQueue.get(queueKey)!;
            
            console.log(`Found log queue for deployment ${deploymentId} with ${queuedLogs.length} logs`);
            
            if (queuedLogs.length > 0) {
              console.log(`Found ${queuedLogs.length} queued logs for deployment ${deploymentId}`);
              
              // Add a small delay to ensure the client is ready to receive logs
              setTimeout(() => {
                try {
                  console.log(`Sending ${queuedLogs.length} queued logs to client for deployment ${deploymentId}`);
                  
                  // Create a copy of the queued logs to avoid issues if new logs are added during sending
                  const logsToSend = [...queuedLogs];
                  
                  for (const log of logsToSend) {
                    try {
                      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(log)}\n\n`));
                      console.log(`Sent queued log to client: ${log.type} - ${log.message}`);
                    } catch (error) {
                      console.error(`Error sending queued log for deployment ${deploymentId}:`, error);
                    }
                  }
                  
                  console.log(`Successfully sent all ${logsToSend.length} queued logs for deployment ${deploymentId}`);
                } catch (error) {
                  console.error(`Error sending queued logs for deployment ${deploymentId}:`, error);
                }
              }, 2000); // Increased delay to 2 seconds to ensure client is ready
            } else {
              console.log(`Queue exists but is empty for deployment ${deploymentId}`);
            }
          } else {
            console.log(`No queued logs found for deployment ${deploymentId}`);
          }
        } catch (error) {
          console.error(`Error sending initial message for deployment ${deploymentId}:`, error);
        }
        
        // Set up a keepalive interval
        const keepaliveInterval = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(`: keepalive ${new Date().toISOString()}\n\n`));
          } catch (error) {
            console.error(`Error sending keepalive for deployment ${deploymentId}:`, error);
            clearInterval(keepaliveInterval);
          }
        }, 5000); // Send a keepalive message every 5 seconds
        
        // Clean up when the request is aborted
        request.signal.addEventListener('abort', () => {
          console.log(`SSE connection aborted for deployment ${deploymentId}`);
          clearInterval(keepaliveInterval);
          
          // Remove the controller from active connections
          if (activeConnections.has(normalizedDeploymentId)) {
            activeConnections.get(normalizedDeploymentId)!.delete(controller);
            console.log(`Removed connection. Remaining connections for deployment ${deploymentId}: ${activeConnections.get(normalizedDeploymentId)!.size}`);
            
            // Clean up the map entry if there are no more connections
            if (activeConnections.get(normalizedDeploymentId)!.size === 0) {
              activeConnections.delete(normalizedDeploymentId);
              console.log(`No more connections for deployment ${deploymentId}, removed from active connections map`);
            }
          }
        });
      }
    });
    
    // Return the stream as an SSE response
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable buffering for Nginx
      }
    });
  } catch (error) {
    console.error('Error in SSE connection handler:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}