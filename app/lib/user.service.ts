import connectToDatabase from './mongodb';
import User, { IUser } from '../models/User';
import { Session } from 'next-auth';
import mongoose from 'mongoose';

/**
 * Get or create a user based on their GitHub session information
 * @param session NextAuth session
 * @returns The user document from the database
 */
export async function getOrCreateUser(session: Session | null): Promise<IUser | null> {
  if (!session || !session.user) {
    return null;
  }

  try {
    // Connect to the database
    await connectToDatabase();

    // Extract user information from the session
    const { email, name, image } = session.user;
    
    // Get the GitHub ID from the token if available
    // Note: This assumes you've extended the session to include a GitHub ID
    const githubId = (session as any).githubId || 'unknown';

    if (!email) {
      console.error('No email found in session');
      return null;
    }

    // Try to find the user by email
    let user = await User.findOne({ email });

    // If user doesn't exist, create a new one
    if (!user) {
      console.log(`Creating new user with email: ${email}`);
      user = new User({
        email,
        githubId,
        name,
        avatarUrl: image,
      });
      await user.save();
    } else {
      // Update user information if it has changed
      let isUpdated = false;

      if (name && user.name !== name) {
        user.name = name;
        isUpdated = true;
      }

      if (image && user.avatarUrl !== image) {
        user.avatarUrl = image;
        isUpdated = true;
      }

      // Update GitHub ID if it was previously unknown
      if (githubId !== 'unknown' && user.githubId === 'unknown') {
        user.githubId = githubId;
        isUpdated = true;
      }

      if (isUpdated) {
        await user.save();
      }
    }

    return user;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    return null;
  }
}

/**
 * Get a user by their ID
 * @param userId MongoDB ObjectId of the user
 * @returns The user document from the database
 */
export async function getUserById(userId: string): Promise<IUser | null> {
  if (!userId) {
    return null;
  }

  try {
    // Connect to the database
    await connectToDatabase();

    // Check if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      // If not, try to find by email (for backward compatibility)
      return await User.findOne({ email: userId });
    }

    // Find the user by ID
    return await User.findById(userId);
  } catch (error) {
    console.error('Error in getUserById:', error);
    return null;
  }
}

/**
 * Get a user by their email
 * @param email Email of the user
 * @returns The user document from the database
 */
export async function getUserByEmail(email: string): Promise<IUser | null> {
  if (!email) {
    return null;
  }

  try {
    // Connect to the database
    await connectToDatabase();

    // Find the user by email
    return await User.findOne({ email });
  } catch (error) {
    console.error('Error in getUserByEmail:', error);
    return null;
  }
}
