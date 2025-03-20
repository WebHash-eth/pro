import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export interface IEnvironmentVariable extends Document {
  userId: string;
  repositoryFullName: string;
  key: string;
  value: string; // This will store encrypted values
  isSecret: boolean;
  createdAt: Date;
  updatedAt: Date;
  encrypt(text: string): string;
  decrypt(encryptedText: string): string;
}

// Get encryption key from environment variable or generate a secure one
// In production, this should be set in environment variables
const ENCRYPTION_KEY = process.env.ENV_ENCRYPTION_KEY || 
  crypto.randomBytes(32).toString('hex'); // 256-bit key
const IV_LENGTH = 16; // For AES, this is always 16

const EnvironmentVariableSchema = new Schema<IEnvironmentVariable>(
  {
    userId: { type: String, required: true, index: true },
    repositoryFullName: { type: String, required: true, index: true },
    key: { type: String, required: true },
    value: { type: String, required: true },
    isSecret: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Create a compound index for userId + repositoryFullName + key
EnvironmentVariableSchema.index({ userId: 1, repositoryFullName: 1, key: 1 }, { unique: true });

// Method to encrypt values before saving
EnvironmentVariableSchema.methods.encrypt = function(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

// Method to decrypt values when retrieving
EnvironmentVariableSchema.methods.decrypt = function(encryptedText: string): string {
  const textParts = encryptedText.split(':');
  const iv = Buffer.from(textParts[0], 'hex');
  const encryptedData = textParts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// Middleware to encrypt values before saving
EnvironmentVariableSchema.pre('save', function(this: IEnvironmentVariable, next) {
  if (this.isModified('value')) {
    this.value = this.encrypt(this.value);
  }
  next();
});

// Check if the model is already defined to prevent overwriting during hot reloads
const EnvironmentVariable = mongoose.models.EnvironmentVariable || 
  mongoose.model<IEnvironmentVariable>('EnvironmentVariable', EnvironmentVariableSchema);

export default EnvironmentVariable; 