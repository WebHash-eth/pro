import mongoose, { Schema, Document } from 'mongoose';

export interface IDeploymentLog extends Document {
  deploymentId: string;
  type: 'info' | 'error' | 'success';
  message: string;
  timestamp: Date;
}

const DeploymentLogSchema: Schema = new Schema(
  {
    deploymentId: { type: String, required: true, index: true },
    type: { 
      type: String, 
      required: true, 
      enum: ['info', 'error', 'success'],
      default: 'info'
    },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: false } // We'll use the timestamp field directly
);

// Create an index for faster querying
DeploymentLogSchema.index({ deploymentId: 1, timestamp: 1 });

// Check if the model is already defined to prevent overwriting during hot reloads
const DeploymentLog = mongoose.models.DeploymentLog || mongoose.model<IDeploymentLog>('DeploymentLog', DeploymentLogSchema);

export default DeploymentLog; 