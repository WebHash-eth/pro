import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  githubId: string;
  name?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    githubId: { type: String, required: true, unique: true },
    name: { type: String },
    avatarUrl: { type: String },
  },
  { timestamps: true }
);

// We're going to remove the error handling middleware completely
// and handle errors directly in the auth.ts file

// Check if the model is already defined to prevent overwriting during hot reloads
const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
