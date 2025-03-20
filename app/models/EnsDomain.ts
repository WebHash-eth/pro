import mongoose, { Schema, Document } from 'mongoose';

export interface IEnsDomain extends Document {
  userId?: string;
  domainName: string;
  walletAddress: string;
  actualOwner?: string; // The verified owner from the blockchain
  isConnected: boolean;
  deploymentId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
  network: string; // e.g., 'mainnet'
}

const EnsDomainSchema: Schema = new Schema(
  {
    userId: { type: String, index: true },
    domainName: { type: String, required: true },
    walletAddress: { type: String, required: true, index: true },
    actualOwner: { type: String }, // The verified owner from the blockchain
    isConnected: { type: Boolean, default: false },
    deploymentId: { type: Schema.Types.ObjectId, ref: 'Deployment' },
    lastSyncedAt: { type: Date },
    network: { type: String, required: true, default: 'mainnet' },
  },
  { timestamps: true }
);

// Create compound indexes
EnsDomainSchema.index({ userId: 1, domainName: 1 }, { unique: false });
EnsDomainSchema.index({ walletAddress: 1, domainName: 1 }, { unique: true });
EnsDomainSchema.index({ deploymentId: 1 });

// Check if the model is already defined to prevent overwriting during hot reloads
const EnsDomain = mongoose.models.EnsDomain || mongoose.model<IEnsDomain>('EnsDomain', EnsDomainSchema);

export default EnsDomain; 