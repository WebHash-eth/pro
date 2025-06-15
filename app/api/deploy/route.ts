import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { auth } from "@/lib/auth";
import { getIPFSGatewayURL } from "@/app/lib/ipfs.utils";
import { uploadTarGzToIPFS } from "@/app/lib/ipfs.service";
import { Octokit } from "octokit";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import connectToDatabase from "@/app/lib/mongodb";
import Deployment from "@/app/models/Deployment";
import * as tar from "tar";
import { createGzip } from "zlib";
import { pipeline } from "stream/promises";
import { createReadStream, createWriteStream } from "fs";
import {
  DeploymentLogger,
  generateDeploymentId,
} from "@/app/lib/deployment-logger";
import { WebhashClient } from "webhash";

const execAsync = promisify(exec);

// Set a timeout for the IPFS upload (15 minutes for larger projects)
const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;

// Function to get directory size in MB
function getDirectorySizeInMB(directoryPath: string): number {
  let totalSize = 0;

  function getAllFilesSync(dirPath: string) {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        getAllFilesSync(filePath);
      } else {
        totalSize += stats.size;
      }
    }
  }

  getAllFilesSync(directoryPath);
  return totalSize / (1024 * 1024); // Convert bytes to MB
}

/**
 * Creates a tar.gz archive of a directory
 * @param sourceDir Directory to archive
 * @param outputPath Path where the archive will be saved
 * @returns Promise that resolves when the archive is created
 */
async function createTarGzArchive(
  sourceDir: string,
  outputPath: string
): Promise<string> {
  console.log(`Creating tar.gz archive of ${sourceDir} at ${outputPath}`);

  try {
    // Create a gzip stream
    const gzip = createGzip();

    // Create a write stream to the output file
    const output = createWriteStream(outputPath);

    // Create a tar stream that reads from the source directory
    const tarStream = tar.create(
      {
        cwd: sourceDir,
        gzip: false, // We're piping to gzip separately
      },
      ["."] // Archive everything in the source directory
    );

    // Pipe the tar stream through gzip to the output file
    await pipeline(tarStream, gzip, output);

    console.log(`Archive created successfully at ${outputPath}`);
    return outputPath;
  } catch (error: any) {
    console.error(`Error creating tar.gz archive: ${error.message}`);
    throw new Error(`Failed to create tar.gz archive: ${error.message}`);
  }
}

/**
 * Uploads a directory to IPFS with a timeout
 * @param directoryPath Directory to upload
 * @param apiKey API key for authentication
 * @param timeoutMs Timeout in milliseconds
 * @returns Promise that resolves with the upload response
 */
async function uploadToIPFSWithTimeout(
  directoryPath: string,
  apiKey: string,
  timeoutMs = 300000 // 5 minutes default timeout
): Promise<any> {
  return new Promise(async (resolve, reject) => {
    // Set a timeout
    const timeout = setTimeout(() => {
      reject(
        new Error(`IPFS upload timed out after ${timeoutMs / 1000} seconds`)
      );
    }, timeoutMs);

    try {
      console.log(`Creating tar.gz archive of ${directoryPath}`);

      // Create a temporary file for the tar.gz archive
      const archivePath = path.join(
        os.tmpdir(),
        `webhash-${Date.now()}.tar.gz`
      );

      // Create the tar.gz archive
      await createTarGzArchive(directoryPath, archivePath);

      console.log(`Uploading tar.gz archive to IPFS: ${archivePath}`);

      // Get the file size before uploading
      const fileSize = fs.statSync(archivePath).size.toString();

      // Upload the tar.gz archive to IPFS
      const result = await uploadTarGzToIPFS(archivePath, apiKey);

      // Clean up the temporary archive file
      fs.unlinkSync(archivePath);

      // Clear the timeout
      clearTimeout(timeout);

      // Resolve with the result in the format expected by the rest of the code
      resolve({
        data: {
          Hash: result.cid,
          Name: path.basename(directoryPath),
          Size: fileSize,
        },
      });
    } catch (error: any) {
      // Clear the timeout
      clearTimeout(timeout);

      // Reject with the error
      reject(error);
    }
  });
}

// Function to ensure React app has proper index.html for IPFS
async function prepareReactAppForIPFS(
  outputPath: string,
  projectType: string
): Promise<void> {
  // Check if this is a React or Next.js app
  if (projectType !== "react" && projectType !== "nextjs") {
    return; // Only process React and Next.js apps
  }

  console.log(`Preparing ${projectType} app for IPFS deployment...`);
  console.log(`Output path: ${outputPath}`);

  // List all files in the output directory for debugging
  const listFilesRecursively = (dir: string, basePath: string = ""): void => {
    const files = fs.readdirSync(dir);
    console.log(`Files in ${basePath || "/"}: ${files.join(", ")}`);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const relativePath = basePath ? path.join(basePath, file) : file;

      if (fs.statSync(filePath).isDirectory()) {
        listFilesRecursively(filePath, relativePath);
      }
    }
  };

  console.log("Listing all files in output directory:");
  listFilesRecursively(outputPath);

  // Check if index.html exists at the root
  const indexPath = path.join(outputPath, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.log("No index.html found at root. Looking in subdirectories...");

    // Try to find index.html in subdirectories
    let indexFound = false;
    const files = fs.readdirSync(outputPath);
    for (const file of files) {
      const filePath = path.join(outputPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        const subIndexPath = path.join(filePath, "index.html");
        if (fs.existsSync(subIndexPath)) {
          console.log(
            `Found index.html in ${file} directory. Moving to root...`
          );
          // Read the index.html content
          const indexContent = fs.readFileSync(subIndexPath, "utf8");

          // Fix asset paths to include the subdirectory
          const fixedContent = indexContent.replace(
            /(src|href)="(?!http|\/\/|#)/g,
            `$1="${file}/`
          );

          // Write to root
          fs.writeFileSync(indexPath, fixedContent);
          console.log(
            `Created root index.html with fixed paths to ${file}/ directory`
          );
          indexFound = true;
          break;
        }
      }
    }

    if (!indexFound) {
      console.log("No index.html found. Creating a wrapper...");

      // Find the most likely directory for the app
      let appDir = "";
      if (fs.existsSync(path.join(outputPath, "build"))) {
        appDir = "build";
      } else if (fs.existsSync(path.join(outputPath, "dist"))) {
        appDir = "dist";
      } else if (fs.existsSync(path.join(outputPath, "out"))) {
        appDir = "out";
      }

      // Create a simple index.html that redirects to the app
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React App on IPFS</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      text-align: center;
      background-color: #f7f7f7;
    }
    .container {
      max-width: 800px;
      padding: 2rem;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    h1 {
      color: #333;
    }
    p {
      color: #666;
      margin-bottom: 1.5rem;
    }
    .button {
      display: inline-block;
      background-color: #0070f3;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      text-decoration: none;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    .button:hover {
      background-color: #0051a2;
    }
    code {
      background-color: #f1f1f1;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: monospace;
    }
  </style>
  <script>
    // Auto-redirect to the app directory
    window.onload = function() {
      const appPath = "${appDir ? appDir + "/" : ""}index.html";
      console.log("Redirecting to: " + appPath);
      window.location.href = appPath;
    }
  </script>
</head>
<body>
  <div class="container">
    <h1>React App on IPFS</h1>
    <p>This React application is hosted on IPFS. If you're not automatically redirected, click the button below:</p>
    <a class="button" href="${
      appDir ? appDir + "/" : ""
    }index.html">Open React App</a>
  </div>
</body>
</html>
      `;
      fs.writeFileSync(indexPath, html);
      console.log(
        `Created root index.html with auto-redirect to ${
          appDir || "root"
        } directory`
      );
    }
  } else {
    console.log("index.html found at root. Checking for path issues...");

    // Read the index.html content
    const indexContent = fs.readFileSync(indexPath, "utf8");
    console.log("Index.html content length:", indexContent.length);

    // Check if we need to fix the base path for IPFS
    if (!indexContent.includes('<base href="/">')) {
      console.log("Adding base href to index.html for IPFS compatibility...");

      // Add base href tag after head tag
      const fixedContent = indexContent.replace(
        /<head>/i,
        '<head>\n  <base href="/">'
      );

      // Write the fixed content back
      fs.writeFileSync(indexPath, fixedContent);
      console.log("Added base href tag to index.html");
    }

    // Check for common issues in the HTML
    if (indexContent.includes('href="/') || indexContent.includes('src="/')) {
      console.log("Found absolute paths in index.html. Fixing...");

      // Fix absolute paths to be relative
      const fixedContent = indexContent
        .replace(/href="\//g, 'href="')
        .replace(/src="\//g, 'src="');

      // Write the fixed content back
      fs.writeFileSync(indexPath, fixedContent);
      console.log("Fixed absolute paths in index.html");
    }
  }

  // Create a .dnslink file to help with IPFS DNS linking
  const dnslinkPath = path.join(outputPath, ".dnslink");
  fs.writeFileSync(
    dnslinkPath,
    "This site is best viewed through a proper IPFS gateway with DNSLink support."
  );

  // Create a _redirects file for Fleek compatibility
  const redirectsPath = path.join(outputPath, "_redirects");
  fs.writeFileSync(redirectsPath, "/* /index.html 200");
  console.log("Added _redirects file for SPA routing support");

  console.log("React app prepared for IPFS deployment");
}

export async function POST(request: NextRequest) {
  // Generate a unique deployment ID
  const deploymentId = generateDeploymentId();
  const logger = new DeploymentLogger(deploymentId);

  try {
    await logger.info(`Starting deployment process with ID: ${deploymentId}`);
    const session = await getServerSession(auth);

    if (!session || !session.accessToken) {
      await logger.error("Unauthorized: No valid session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user ID from the session
    const userId =
      session.userId || session.user?.email || session.user?.id || "unknown";

    const { repoFullName, branch, buildCommand, outputDirectory, projectType } =
      await request.json();

    if (!repoFullName || !branch) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Get the API key from environment variables
    const apiKey = process.env.IPFS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "IPFS API key not configured on the server" },
        { status: 500 }
      );
    }

    // Create a temporary directory for the repository
    const tempDir = path.join(os.tmpdir(), `webhash-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Return the deployment ID immediately so the client can start listening for logs
    await logger.info("Deployment started");

    // Process the deployment in the background
    (async () => {
      try {
        // Clone the repository
        const [owner, repo] = repoFullName.split("/");
        const octokit = new Octokit({ auth: session.accessToken });

        // First check if the repository exists and is accessible
        try {
          await logger.info(`Verifying access to repository ${repoFullName}`);

          // Get the repository URL
          const repoData = await octokit.request("GET /repos/{owner}/{repo}", {
            owner,
            repo,
            headers: {
              "X-GitHub-Api-Version": "2022-11-28",
            },
          });

          await logger.info(`Repository access verified: ${repoFullName}`);

          // Use the authenticated clone URL
          const cloneUrl = `https://${session.accessToken}@github.com/${owner}/${repo}.git`;

          // Clone the repository
          try {
            await logger.info(
              `Cloning repository ${repoFullName} branch ${branch}...`
            );
            await execAsync(
              `git clone --branch ${branch} ${cloneUrl} ${tempDir}`
            );
            await logger.success("Repository cloned successfully");
          } catch (error) {
            await logger.error(
              `Error cloning repository: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            return;
          }
        } catch (error) {
          await logger.error(
            `Error accessing repository: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          return;
        }

        // Detect project type if not specified
        let detectedProjectType = projectType;
        if (!detectedProjectType) {
          await logger.info("Detecting project type...");

          // Check for package.json to determine if it's a Node.js project
          if (fs.existsSync(path.join(tempDir, "package.json"))) {
            try {
              const packageJson = JSON.parse(
                fs.readFileSync(path.join(tempDir, "package.json"), "utf8")
              );

              // Check for Next.js
              if (packageJson.dependencies && packageJson.dependencies.next) {
                await logger.info(
                  "Next.js project detected. Only static exports are supported on IPFS."
                );
                await logger.info(
                  "Server components, API routes, and server-side rendering will not work."
                );
                detectedProjectType = "react"; // Treat Next.js as React for simplicity
              }
              // Check for React
              else if (
                packageJson.dependencies &&
                packageJson.dependencies.react
              ) {
                await logger.info("React project detected");
                detectedProjectType = "react";
              }
              // Generic Node.js project
              else {
                await logger.info(
                  "Node.js project detected. Only static content will work on IPFS."
                );
                detectedProjectType = "static";
              }
            } catch (error) {
              await logger.error(
                `Error parsing package.json: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
              detectedProjectType = "static";
            }
          } else {
            await logger.info("Static website detected");
            detectedProjectType = "static";
          }
        } else {
          await logger.info(`Project type specified: ${detectedProjectType}`);
        }

        // Check for Next.js app and warn about limitations
        if (
          fs.existsSync(path.join(tempDir, "app")) ||
          fs.existsSync(path.join(tempDir, "pages"))
        ) {
          const hasApiDir =
            fs.existsSync(path.join(tempDir, "app/api")) ||
            fs.existsSync(path.join(tempDir, "pages/api"));

          if (hasApiDir) {
            await logger.info(
              "WARNING: API routes detected. These will not function on IPFS as it's static hosting only."
            );
          }

          if (fs.existsSync(path.join(tempDir, "next.config.js"))) {
            await logger.info(
              "Next.js project detected. Some features may not work on IPFS."
            );
          }
        }

        // Install dependencies for Node.js projects
        if (detectedProjectType !== "static") {
          try {
            await logger.info("Installing dependencies...");

            // Check for yarn.lock or package-lock.json to determine package manager
            const hasYarnLock = fs.existsSync(path.join(tempDir, "yarn.lock"));
            const hasNpmLock = fs.existsSync(
              path.join(tempDir, "package-lock.json")
            );
            const hasPnpmLock = fs.existsSync(
              path.join(tempDir, "pnpm-lock.yaml")
            );

            let installCommand = "npm install";
            if (hasYarnLock) {
              installCommand = "yarn install";
              await logger.info("Using yarn package manager");
            } else if (hasPnpmLock) {
              installCommand = "pnpm install";
              await logger.info("Using pnpm package manager");
            } else {
              await logger.info("Using npm package manager");
            }

            await logger.info(`Running: ${installCommand}`);
            await execAsync(`cd ${tempDir} && ${installCommand}`);
            await logger.success("Dependencies installed successfully");
          } catch (error: unknown) {
            await logger.error(
              `Error installing dependencies: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            return;
          }
        }

        // Fetch environment variables for the repository
        await logger.info("Fetching environment variables...");
        try {
          // Fetch environment variables from our API
          const envResponse = await fetch(
            `${process.env.NEXTAUTH_URL}/api/env-variables/decrypt?repository=${repoFullName}`,
            {
              headers: {
                Cookie: request.headers.get("cookie") || "", // Forward the session cookie
              },
            }
          );

          if (envResponse.ok) {
            const envVariables = await envResponse.json();

            // Check if we have any environment variables
            if (Object.keys(envVariables).length > 0) {
              await logger.info(
                `Found ${
                  Object.keys(envVariables).length
                } environment variables for this repository`
              );

              // Create a .env file in the repository
              const envFilePath = path.join(tempDir, ".env");
              let envFileContent = "";

              // Add each variable to the .env file
              for (const [key, value] of Object.entries(envVariables)) {
                envFileContent += `${key}=${value}\n`;
              }

              // Write the .env file
              fs.writeFileSync(envFilePath, envFileContent);
              await logger.success(
                "Environment variables injected successfully"
              );

              // For React apps, also create a .env.production file
              if (detectedProjectType === "react") {
                // Create .env.production for React apps (CRA requires REACT_APP_ prefix)
                const envProdPath = path.join(tempDir, ".env.production");
                let envProdContent = "";

                for (const [key, value] of Object.entries(envVariables)) {
                  // Add REACT_APP_ prefix if not already present
                  const prodKey = key.startsWith("REACT_APP_")
                    ? key
                    : `REACT_APP_${key}`;
                  envProdContent += `${prodKey}=${value}\n`;
                }

                fs.writeFileSync(envProdPath, envProdContent);
                await logger.info("Created .env.production for React app");
              }
            } else {
              await logger.info(
                "No environment variables found for this repository"
              );
            }
          } else {
            await logger.info(
              "Failed to fetch environment variables, continuing without them"
            );
          }
        } catch (error) {
          await logger.error(
            `Error fetching environment variables: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          await logger.info(
            "Continuing deployment without environment variables"
          );
        }

        // Determine build command if not provided
        let effectiveBuildCommand = buildCommand;
        if (!effectiveBuildCommand && detectedProjectType !== "static") {
          try {
            await logger.info("Determining build command from package.json...");
            const packageJson = JSON.parse(
              fs.readFileSync(path.join(tempDir, "package.json"), "utf8")
            );

            if (packageJson.scripts) {
              if (packageJson.scripts.build) {
                effectiveBuildCommand = "npm run build";
                await logger.info(
                  `Found build script: ${effectiveBuildCommand}`
                );
              } else if (
                packageJson.scripts.export &&
                detectedProjectType === "nextjs"
              ) {
                effectiveBuildCommand = "npm run export";
                await logger.info(
                  `Found export script: ${effectiveBuildCommand}`
                );
              } else {
                await logger.info("No build script found in package.json");
              }
            }
          } catch (error) {
            await logger.error(
              `Error determining build command: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        } else if (effectiveBuildCommand) {
          await logger.info(
            `Using provided build command: ${effectiveBuildCommand}`
          );
        } else {
          await logger.info("No build command needed for static website");
        }

        // Run build command if provided or determined
        if (effectiveBuildCommand && detectedProjectType !== "static") {
          try {
            await logger.info(
              `Running build command: ${effectiveBuildCommand}`
            );

            // Check for Next.js specific errors before building
            const isNextJs = fs.existsSync(
              path.join(tempDir, "next.config.js")
            );
            if (isNextJs) {
              // Add a warning about Next.js limitations
              await logger.info(
                "WARNING: Next.js detected. Only static exports will work on IPFS."
              );
              await logger.info(
                "Server components, API routes, and server-side rendering will not function."
              );

              // Check for common Next.js issues
              const hasApiRoutes =
                fs.existsSync(path.join(tempDir, "app/api")) ||
                fs.existsSync(path.join(tempDir, "pages/api"));
              if (hasApiRoutes) {
                await logger.info(
                  "WARNING: API routes detected in Next.js app. These will not function on IPFS."
                );
              }

              // Try to modify next.config.js to enable static export
              const nextConfigPath = path.join(tempDir, "next.config.js");
              if (fs.existsSync(nextConfigPath)) {
                try {
                  await logger.info(
                    "Modifying next.config.js to enable static export..."
                  );

                  // Read the existing config
                  let nextConfigContent = fs.readFileSync(
                    nextConfigPath,
                    "utf8"
                  );

                  // Check if output: 'export' is already set
                  if (
                    !nextConfigContent.includes("output: 'export'") &&
                    !nextConfigContent.includes('output: "export"')
                  ) {
                    // Simple approach: add output: 'export' to the module.exports object
                    if (nextConfigContent.includes("module.exports")) {
                      // Replace the module.exports opening bracket with one that includes output: 'export'
                      nextConfigContent = nextConfigContent.replace(
                        /module\.exports\s*=\s*{/,
                        "module.exports = {\n  output: 'export',"
                      );

                      // Write the modified config back
                      fs.writeFileSync(nextConfigPath, nextConfigContent);
                      await logger.success(
                        "Modified next.config.js to enable static export"
                      );
                    } else {
                      // If we can't find module.exports, create a new config file
                      const newConfig = `
                        /** @type {import('next').NextConfig} */
                        const nextConfig = {
                          output: 'export',
                        };
                        
                        module.exports = nextConfig;
                      `;
                      fs.writeFileSync(nextConfigPath, newConfig);
                      await logger.success(
                        "Created new next.config.js with static export enabled"
                      );
                    }
                  } else {
                    await logger.info(
                      "Static export already enabled in next.config.js"
                    );
                  }
                } catch (error) {
                  await logger.error(
                    `Error modifying next.config.js: ${
                      error instanceof Error ? error.message : String(error)
                    }`
                  );
                  await logger.info("Continuing with build anyway...");
                }
              }
            }

            // Execute the build command
            await execAsync(`cd ${tempDir} && npx ${effectiveBuildCommand}`);
            await logger.success("Build completed successfully");
          } catch (error: unknown) {
            await logger.error(
              `Error running build command: ${
                error instanceof Error ? error.message : String(error)
              }`
            );

            // Check for Next.js specific errors
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            if (
              errorMessage.includes("<Html>") ||
              errorMessage.includes("next/document")
            ) {
              await logger.error(
                "Build failed: This appears to be a Next.js app with server components."
              );
              await logger.error(
                "Next.js apps with server components, API routes, or server-side rendering cannot be deployed to IPFS as-is."
              );
              await logger.error(
                "IPFS only supports static content. Consider using a static site generator or a client-side only React app."
              );
              return;
            }

            return;
          }
        }

        // Determine the output directory path based on project type
        let effectiveOutputDirectory = outputDirectory;
        if (!effectiveOutputDirectory) {
          logger.info("Determining output directory...");
          if (detectedProjectType === "nextjs") {
            // Check for Next.js export directory first, then build directory
            if (fs.existsSync(path.join(tempDir, "out"))) {
              effectiveOutputDirectory = "out";
              logger.info("Using 'out' directory for Next.js export");
            } else {
              effectiveOutputDirectory = ".next";
              logger.info("Using '.next' directory for Next.js build");
            }
          } else if (detectedProjectType === "react") {
            // Common React output directories
            if (fs.existsSync(path.join(tempDir, "dist"))) {
              effectiveOutputDirectory = "dist";
              logger.info("Using 'dist' directory for React app");
            } else if (fs.existsSync(path.join(tempDir, "build"))) {
              effectiveOutputDirectory = "build";
              logger.info("Using 'build' directory for React app");
            } else {
              effectiveOutputDirectory = ".";
              logger.info("Using root directory for React app");
            }
          } else {
            // Default to root for static sites
            effectiveOutputDirectory = ".";
            logger.info("Using root directory for static website");
          }
        } else {
          logger.info(
            `Using specified output directory: ${effectiveOutputDirectory}`
          );

          // Check if the specified output directory exists
          if (!fs.existsSync(path.join(tempDir, effectiveOutputDirectory))) {
            logger.info(
              `Specified output directory '${effectiveOutputDirectory}' not found. Attempting to auto-detect...`
            );

            // Fallback to auto-detection
            if (detectedProjectType === "react") {
              if (fs.existsSync(path.join(tempDir, "dist"))) {
                effectiveOutputDirectory = "dist";
                logger.info("Using 'dist' directory for React app");
              } else if (fs.existsSync(path.join(tempDir, "build"))) {
                effectiveOutputDirectory = "build";
                logger.info("Using 'build' directory for React app");
              }
            } else if (detectedProjectType === "nextjs") {
              if (fs.existsSync(path.join(tempDir, "out"))) {
                effectiveOutputDirectory = "out";
                logger.info("Using 'out' directory for Next.js export");
              }
            }
          }
        }

        const outputPath = path.join(tempDir, effectiveOutputDirectory);

        // Check if the output directory exists
        if (!fs.existsSync(outputPath)) {
          logger.error(
            `Output directory '${effectiveOutputDirectory}' not found. Please check your build configuration.`
          );
          return;
        }

        // For Next.js static exports, ensure we're using the 'out' directory
        if (
          detectedProjectType === "nextjs" &&
          effectiveOutputDirectory === ".next"
        ) {
          // Check if we need to export the Next.js app for static hosting
          try {
            await logger.info("Exporting Next.js app for static hosting...");
            await execAsync(`cd ${tempDir} && npx next export`);

            if (fs.existsSync(path.join(tempDir, "out"))) {
              effectiveOutputDirectory = "out";
              await logger.success("Next.js export completed successfully");
            }
          } catch (error) {
            await logger.error(
              `Error exporting Next.js app: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
            // Continue with .next directory if export fails
          }
        }

        // Final output path after potential adjustments
        const finalOutputPath = path.join(tempDir, effectiveOutputDirectory);

        // Check for node_modules in the output directory and remove them if found
        const nodeModulesPath = path.join(finalOutputPath, "node_modules");
        if (fs.existsSync(nodeModulesPath)) {
          await logger.info(
            "Removing node_modules from output directory to reduce size..."
          );
          fs.rmSync(nodeModulesPath, { recursive: true, force: true });
          await logger.success("Removed node_modules from output directory");
        }

        // Prepare React app for IPFS if needed
        await logger.info("Preparing app for IPFS deployment...");
        await prepareReactAppForIPFS(finalOutputPath, detectedProjectType);
        await logger.success("App prepared for IPFS deployment");

        // Upload to WebHash using the SDK
        try {
          await logger.info(
            `Uploading directory ${finalOutputPath} to WebHash...`
          );
          await logger.info(
            `This may take a while depending on the size of your project.`
          );

          // List files to be uploaded (for debugging)
          const files = fs.readdirSync(finalOutputPath);
          await logger.info(
            `Files to upload (${files.length} items): ${files
              .slice(0, 10)
              .join(", ")}${files.length > 10 ? "..." : ""}`
          );

          // Check directory size
          const dirSizeMB = getDirectorySizeInMB(finalOutputPath);
          await logger.info(
            `Output directory size: ${dirSizeMB.toFixed(2)} MB`
          );

          // Warn if directory is large
          if (dirSizeMB > 100) {
            await logger.info(
              `WARNING: Large directory size (${dirSizeMB.toFixed(
                2
              )} MB) may cause upload timeouts`
            );
          }

          // Get the private key from environment variables
          const privateKey = process.env.WEBHASH_PRIVATE_KEY;
          if (!privateKey) {
            await logger.error(
              "WebHash private key not configured on the server"
            );
            return;
          }

          // Upload with WebHash SDK
          await logger.info("Starting WebHash upload...");
          const response = await uploadToWebHash(finalOutputPath, privateKey);

          // Get the IPFS gateway URL
          const cid = response.data.Hash;
          const gatewayUrl = getIPFSGatewayURL(cid);

          await logger.success(`Upload successful. CID: ${cid}`);
          await logger.success(`Gateway URL: ${gatewayUrl}`);

          // Save the deployment to the database
          await connectToDatabase();
          const deployment = new Deployment({
            userId: userId,
            repositoryName: repo,
            repositoryFullName: repoFullName,
            branch,
            cid,
            gatewayUrl,
            projectType: detectedProjectType,
            buildCommand: effectiveBuildCommand,
            outputDirectory: effectiveOutputDirectory,
            status: "success",
            sizeInMB: dirSizeMB.toFixed(2),
            deploymentId,
            transactionReceipt: response.data.transactionReceipt, // Optionally store receipt
          });

          await deployment.save();
          await logger.success(
            `Deployment completed successfully with CID: ${cid} and saved to database with ID: ${deployment._id}`
          );

          // Wait for all logs to be stored
          await logger.waitForPendingLogs();

          // Return the deployment information
          return NextResponse.json({
            success: true,
            deploymentId,
            cid,
            ipfsUrl: "",
            gatewayUrl,
            mongoDbId: deployment._id.toString(),
          });
        } catch (error) {
          await logger.error(
            `Error uploading to WebHash: ${
              error instanceof Error ? error.message : String(error)
            }`
          );

          // Store failed deployment in database
          try {
            await connectToDatabase();

            const deployment = new Deployment({
              userId: userId,
              repositoryName: repo,
              repositoryFullName: repoFullName,
              branch,
              cid: "failed",
              gatewayUrl: "failed",
              projectType: detectedProjectType,
              buildCommand: effectiveBuildCommand,
              outputDirectory: effectiveOutputDirectory,
              status: "failed",
              error: error instanceof Error ? error.message : String(error),
              deploymentId,
            });

            await deployment.save();
            await logger.info(
              `Failed deployment saved to database with ID: ${deployment._id}`
            );

            // Wait for all logs to be stored
            await logger.waitForPendingLogs();
          } catch (dbError) {
            await logger.error(
              `Error saving failed deployment to database: ${
                dbError instanceof Error ? dbError.message : String(dbError)
              }`
            );
          }

          // Check if it's a timeout error and provide more helpful guidance
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (errorMessage.includes("timed out")) {
            await logger.error(
              "Your project may be too large for direct upload. Try reducing the build size by optimizing assets or removing unnecessary files."
            );
          }
        }
      } finally {
        // Clean up the temporary directory
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
          await logger.info(`Cleaned up temporary directory: ${tempDir}`);

          // Wait for all logs to be stored
          await logger.waitForPendingLogs();
        } catch (cleanupError) {
          await logger.error(
            `Error cleaning up temporary directory: ${
              cleanupError instanceof Error
                ? cleanupError.message
                : String(cleanupError)
            }`
          );
        }
      }
    })().catch(async (error) => {
      await logger.error(
        `Unhandled error in deployment process: ${
          error instanceof Error ? error.message : String(error)
        }`
      );

      // Wait for all logs to be stored
      await logger.waitForPendingLogs();
    });

    // Return the deployment ID immediately
    return NextResponse.json({
      success: true,
      message: "Deployment started",
      deploymentId,
    });
  } catch (error: unknown) {
    await logger.error(
      `Error starting deployment: ${
        error instanceof Error ? error.message : String(error)
      }`
    );

    // Wait for all logs to be stored
    await logger.waitForPendingLogs();

    return NextResponse.json(
      {
        error: `Failed to deploy to IPFS: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}

/**
 * Uploads a directory to WebHash using the SDK
 * @param directoryPath Directory to upload
 * @param privateKey Wallet private key for signing
 * @returns Promise that resolves with the upload response
 */
async function uploadToWebHash(
  directoryPath: string,
  privateKey: string
): Promise<any> {
  const client = new WebhashClient(privateKey);
  // Optionally, you can pass an uploader address as the second argument
  const result = await client.uploadDir(directoryPath /*, uploader */);
  // The last item in result.response is the base directory info
  const baseDirInfo = result.response.at(-1);
  return {
    data: {
      Hash: baseDirInfo?.Hash,
      Name: baseDirInfo?.Name,
      Size: baseDirInfo?.Size,
      transactionReceipt: result.transactionReceipt,
    },
  };
}
