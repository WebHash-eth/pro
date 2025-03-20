import mongoose, { Schema, Document } from 'mongoose';

// Define the log entry interface
export interface IDeploymentLogEntry {
  type: 'info' | 'error' | 'success';
  message: string;
  timestamp: Date;
}

export interface IDeployment extends Document {
  userId: string;
  repositoryName: string;
  repositoryFullName: string;
  branch: string;
  cid: string;
  gatewayUrl: string;
  projectType: string;
  status: 'success' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  sizeInMB?: string;
  buildCommand?: string;
  outputDirectory?: string;
  error?: string;
  connectedDomains?: string[]; // Array of ENS domain names
  deploymentId?: string; // Reference to the deployment ID used for logs
  accessUrls?: Record<string, string>; // Different access URLs
  logs?: IDeploymentLogEntry[]; // Array of log entries
}

// Define the log entry schema
const DeploymentLogEntrySchema = new Schema({
  type: { 
    type: String, 
    required: true, 
    enum: ['info', 'error', 'success'],
    default: 'info'
  },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false }); // No need for _id in embedded documents

const DeploymentSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    repositoryName: { type: String, required: true },
    repositoryFullName: { type: String, required: true },
    branch: { type: String, required: true },
    cid: { type: String, required: true },
    gatewayUrl: { type: String, required: true },
    projectType: { type: String, required: true, enum: ['static', 'react', 'nextjs', 'other'], default: 'static' },
    status: { type: String, enum: ['success', 'failed'], default: 'success' },
    sizeInMB: { type: String },
    buildCommand: { type: String },
    outputDirectory: { type: String },
    error: { type: String },
    connectedDomains: [{ type: String }], // Array of ENS domain names
    deploymentId: { type: String, index: true }, // Reference to the deployment ID used for logs
    accessUrls: { type: Map, of: String }, // Different access URLs
    logs: [DeploymentLogEntrySchema], // Array of log entries
  },
  { timestamps: true }
);

// Create a compound index for userId and cid
DeploymentSchema.index({ userId: 1, cid: 1 });

// Check if the model is already defined to prevent overwriting during hot reloads
const Deployment = mongoose.models.Deployment || mongoose.model<IDeployment>('Deployment', DeploymentSchema);

export default Deployment;