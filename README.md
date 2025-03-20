# WebHash Pro

WebHash Pro is a web application that allows you to connect your GitHub account and deploy static websites, React frontends, and Next.js applications to IPFS (InterPlanetary File System). IPFS serves as a decentralized alternative to traditional cloud hosting services like AWS S3.

## Features

- **GitHub Integration**: Connect your GitHub account to access your repositories.
- **Multiple Project Types**: Deploy static websites, React frontends, and Next.js applications.
- **IPFS Deployment**: Host your applications on the decentralized web using a custom IPFS API.
- **Custom Build Commands**: Specify custom build commands for your projects.
- **Deployment History**: Keep track of your deployments and access them easily.
- **Environment Variables Management**: Securely store and manage environment variables for your deployments.

## Getting Started

### Prerequisites

- Node.js 18.x or later
- A GitHub account
- An IPFS API key
- MongoDB database (local or Atlas)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Rahamthunisa/webhash-pro-beta.git
   cd webhash-pro-beta
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file based on the example:
   ```bash
   cp .env.local.example .env.local
   ```

4. Set up GitHub OAuth:
   - Go to GitHub Developer Settings: https://github.com/settings/developers
   - Create a new OAuth App
   - Set the Authorization callback URL to `http://localhost:3000/api/auth/callback/github`
   - Copy the Client ID and Client Secret to your `.env.local` file

5. Get an IPFS API key:
   - Sign up at your custom IPFS service provider
   - Create an API key and add it to your `.env.local` file

6. Set up MongoDB:
   - Use a local MongoDB instance or create a MongoDB Atlas cluster
   - Add the connection string to your `.env.local` file as `MONGODB_URI`

7. Generate a NextAuth secret:
   ```bash
   openssl rand -base64 32
   ```
   - Add this as `NEXTAUTH_SECRET` in your `.env.local` file

8. Start the development server:
   ```bash
   npm run dev
   ```

9. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Sign in with your GitHub account.
2. Select a repository from your GitHub account.
3. Choose the branch you want to deploy.
4. Enter your IPFS API key.
5. Specify build commands and output directory if needed.
6. Click "Deploy to IPFS" to start the deployment process.
7. Once deployed, you'll receive a gateway URL to access your application.

## Deployment Types

### Static Websites

For static websites, simply select your repository and branch. The content will be deployed directly to IPFS.

### React Applications

For React applications, specify the build command (e.g., `npm run build`) and the output directory (usually `build`).

### Next.js Applications

For Next.js applications, make sure your project is configured for static export. Specify the build command (e.g., `npm run build`) and the output directory (usually `out`).

## Environment Variables

- `GITHUB_CLIENT_ID`: Your GitHub OAuth Client ID
- `GITHUB_CLIENT_SECRET`: Your GitHub OAuth Client Secret
- `NEXTAUTH_URL`: The base URL of your application (e.g., `http://localhost:3000`)
- `NEXTAUTH_SECRET`: A secret for NextAuth.js
- `IPFS_API_KEY`: Your IPFS API key
- `MONGODB_URI`: MongoDB connection string
- `ENV_ENCRYPTION_KEY`: (Optional) Key for encrypting environment variables

## Deploying to Vercel

This project is optimized for deployment on Vercel. Follow these steps to deploy:

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. Import your GitHub repository in Vercel:
   - Go to [Vercel](https://vercel.com) and sign in
   - Click "New Project" and import your GitHub repository
   - Configure the project settings:
     - Framework Preset: Next.js
     - Root Directory: ./
     - Build Command: npm run build
     - Output Directory: .next

3. Set up environment variables:
   - Add all the environment variables from your `.env.local` file to the Vercel project settings
   - Make sure to set `NEXTAUTH_URL` to your Vercel deployment URL

4. Deploy the project:
   - Click "Deploy" and wait for the build to complete
   - Your application will be available at the provided Vercel URL

5. Update GitHub OAuth callback:
   - Go back to your GitHub OAuth App settings
   - Update the Authorization callback URL to include your Vercel deployment URL
   - Format: `https://your-vercel-url.vercel.app/api/auth/callback/github`

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Next.js](https://nextjs.org/)
- [NextAuth.js](https://next-auth.js.org/)
- [IPFS](https://ipfs.tech/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [MongoDB](https://www.mongodb.com/)
- [Vercel](https://vercel.com/)
