import { sendLogUpdate } from '@/app/api/deployment-logs/route';
import Deployment from '@/app/models/Deployment';
import connectToDatabase from '@/app/lib/mongodb';

// Generate a unique deployment ID
export function generateDeploymentId(): string {
  return `deploy_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Interface for log entries
interface LogEntry {
  type: 'info' | 'error' | 'success';
  message: string;
  timestamp: Date;
}

// Class to handle deployment logging
export class DeploymentLogger {
  private deploymentId: string;
  private pendingLogs: Promise<void>[] = [];
  private logBatch: LogEntry[] = [];
  private batchSize: number = 10;
  private batchTimeout: NodeJS.Timeout | null = null;
  private flushInterval: number = 2000; // 2 seconds
  
  constructor(deploymentId: string, batchSize: number = 10, flushInterval: number = 2000) {
    this.deploymentId = deploymentId;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
  }
  
  // Log an informational message
  async info(message: string): Promise<void> {
    console.log(`[INFO] [${this.deploymentId}] ${message}`);
    
    const log = {
      type: 'info' as const,
      message,
      timestamp: new Date()
    };
    
    // Send to SSE for real-time updates
    try {
      sendLogUpdate(this.deploymentId, {
        ...log,
        timestamp: log.timestamp.toISOString()
      });
    } catch (error) {
      console.error(`Error sending log update via SSE: ${error}`);
    }
    
    // Add to batch for database storage
    this.addLogToBatch(log);
  }
  
  // Log an error message
  async error(message: string): Promise<void> {
    console.error(`[ERROR] [${this.deploymentId}] ${message}`);
    
    const log = {
      type: 'error' as const,
      message,
      timestamp: new Date()
    };
    
    // Send to SSE for real-time updates
    try {
      sendLogUpdate(this.deploymentId, {
        ...log,
        timestamp: log.timestamp.toISOString()
      });
    } catch (error) {
      console.error(`Error sending log update via SSE: ${error}`);
    }
    
    // Add to batch for database storage
    this.addLogToBatch(log);
  }
  
  // Log a success message
  async success(message: string): Promise<void> {
    console.log(`[SUCCESS] [${this.deploymentId}] ${message}`);
    
    const log = {
      type: 'success' as const,
      message,
      timestamp: new Date()
    };
    
    // Send to SSE for real-time updates
    try {
      sendLogUpdate(this.deploymentId, {
        ...log,
        timestamp: log.timestamp.toISOString()
      });
    } catch (error) {
      console.error(`Error sending log update via SSE: ${error}`);
    }
    
    // Add to batch for database storage
    this.addLogToBatch(log);
  }
  
  // Add a log to the batch and flush if needed
  private addLogToBatch(log: LogEntry): void {
    this.logBatch.push(log);
    
    // Flush if batch is full
    if (this.logBatch.length >= this.batchSize) {
      this.flushLogBatch();
    } 
    // Set a timeout to flush if not already set
    else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.flushLogBatch(), this.flushInterval);
    }
  }
  
  // Flush the log batch to the database
  private async flushLogBatch(): Promise<void> {
    if (this.logBatch.length === 0) return;
    
    // Clear the timeout if it exists
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    // Create a copy of the current batch and clear it
    const logsToStore = [...this.logBatch];
    this.logBatch = [];
    
    // Store the logs in the database
    const dbPromise = (async () => {
      try {
        await connectToDatabase();
        
        // Find deployment by deploymentId and append logs
        // Using $each to add multiple items to the array at once
        const result = await Deployment.updateOne(
          { deploymentId: this.deploymentId },
          { 
            $push: { 
              logs: { 
                $each: logsToStore,
                $slice: -1000 // Keep only the most recent 1000 logs to prevent excessive growth
              } 
            } 
          }
        );
        
        if (result.matchedCount === 0) {
          console.warn(`No deployment found with ID ${this.deploymentId} to store logs`);
        } else {
          console.log(`Stored ${logsToStore.length} logs for deployment ${this.deploymentId}`);
        }
      } catch (error) {
        console.error(`Error storing logs in database: ${error}`);
      }
    })();
    
    this.pendingLogs.push(dbPromise);
  }
  
  // Wait for all pending logs to be stored in the database
  async waitForPendingLogs(): Promise<void> {
    // Flush any remaining logs in the batch
    if (this.logBatch.length > 0) {
      await this.flushLogBatch();
    }
    
    // Wait for all pending database operations to complete
    await Promise.all(this.pendingLogs);
    this.pendingLogs = [];
  }
} 