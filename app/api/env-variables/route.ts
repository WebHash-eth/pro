import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { auth } from "@/lib/auth";
import connectToDatabase from "@/app/lib/mongodb";
import EnvironmentVariable from "@/app/models/EnvironmentVariable";
import { getUserByEmail } from "@/app/lib/user.service";
import { IUser } from "@/app/models/User";

// GET - Fetch environment variables for a repository
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(auth);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Get the user ID from the session (MongoDB ObjectId) or fall back to email for backward compatibility
    let userId = session.userId;
    
    // If userId is not available in the session (for existing users before the update),
    // try to find the user by email and get their MongoDB ObjectId
    if (!userId && session.user?.email) {
      const user = await getUserByEmail(session.user.email) as IUser | null;
      if (user && user._id) {
        userId = user._id.toString();
      } else {
        // If no user is found, fall back to using the email (for backward compatibility)
        userId = session.user.email || session.user?.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found" },
        { status: 400 }
      );
    }

    // Get repository from query parameters
    const searchParams = request.nextUrl.searchParams;
    const repositoryFullName = searchParams.get("repository");

    if (!repositoryFullName) {
      return NextResponse.json(
        { error: "Repository name is required" },
        { status: 400 }
      );
    }

    // Fetch environment variables for the user and repository
    const envVariables = await EnvironmentVariable.find({ 
      userId, 
      repositoryFullName 
    });

    // Return only keys and isSecret flags, not the encrypted values for security
    const safeEnvVariables = envVariables.map(env => ({
      id: env._id,
      key: env.key,
      isSecret: env.isSecret,
      createdAt: env.createdAt,
      updatedAt: env.updatedAt
    }));

    return NextResponse.json(safeEnvVariables);
  } catch (error) {
    console.error("Error fetching environment variables:", error);
    return NextResponse.json(
      { error: "Failed to fetch environment variables" },
      { status: 500 }
    );
  }
}

// POST - Create or update environment variables
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(auth);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Get the user ID from the session (MongoDB ObjectId) or fall back to email for backward compatibility
    let userId = session.userId;
    
    // If userId is not available in the session (for existing users before the update),
    // try to find the user by email and get their MongoDB ObjectId
    if (!userId && session.user?.email) {
      const user = await getUserByEmail(session.user.email) as IUser | null;
      if (user && user._id) {
        userId = user._id.toString();
      } else {
        // If no user is found, fall back to using the email (for backward compatibility)
        userId = session.user.email || session.user?.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found" },
        { status: 400 }
      );
    }

    const { repositoryFullName, variables } = await request.json();

    if (!repositoryFullName || !variables || !Array.isArray(variables)) {
      return NextResponse.json(
        { error: "Repository name and variables array are required" },
        { status: 400 }
      );
    }

    // Process each variable
    const results = await Promise.all(
      variables.map(async (variable: { key: string; value: string; isSecret?: boolean }) => {
        const { key, value, isSecret = true } = variable;

        if (!key || value === undefined) {
          return { key, status: "error", message: "Key and value are required" };
        }

        try {
          // Check if the variable already exists
          const existingVar = await EnvironmentVariable.findOne({
            userId,
            repositoryFullName,
            key
          });

          if (existingVar) {
            // Update existing variable
            existingVar.value = value;
            existingVar.isSecret = isSecret;
            await existingVar.save();
            return { key, status: "updated" };
          } else {
            // Create new variable
            const newVar = new EnvironmentVariable({
              userId,
              repositoryFullName,
              key,
              value,
              isSecret
            });
            await newVar.save();
            return { key, status: "created" };
          }
        } catch (error) {
          console.error(`Error saving variable ${key}:`, error);
          return { key, status: "error", message: "Failed to save variable" };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error saving environment variables:", error);
    return NextResponse.json(
      { error: "Failed to save environment variables" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an environment variable
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(auth);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Connect to the database
    await connectToDatabase();

    // Get the user ID from the session (MongoDB ObjectId) or fall back to email for backward compatibility
    let userId = session.userId;
    
    // If userId is not available in the session (for existing users before the update),
    // try to find the user by email and get their MongoDB ObjectId
    if (!userId && session.user?.email) {
      const user = await getUserByEmail(session.user.email) as IUser | null;
      if (user && user._id) {
        userId = user._id.toString();
      } else {
        // If no user is found, fall back to using the email (for backward compatibility)
        userId = session.user.email || session.user?.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID not found" },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const repositoryFullName = searchParams.get("repository");
    const key = searchParams.get("key");

    if (!repositoryFullName || !key) {
      return NextResponse.json(
        { error: "Repository name and key are required" },
        { status: 400 }
      );
    }

    // Delete the variable
    const result = await EnvironmentVariable.deleteOne({
      userId,
      repositoryFullName,
      key
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Environment variable not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting environment variable:", error);
    return NextResponse.json(
      { error: "Failed to delete environment variable" },
      { status: 500 }
    );
  }
}