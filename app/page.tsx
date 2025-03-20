"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";


export default function Home() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      // We don't need to reset loading state as the page will redirect
      await signIn("github", { callbackUrl: "/dashboard" });
    } catch (error) {
      console.error("Error signing in:", error);
      setIsLoading(false); // Only reset on error
    }
    // Remove the finally block to keep loading state active until redirect
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white relative overflow-hidden p-4 sm:p-6 md:p-8">
      {/* Background grid */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_70%,transparent_100%)] before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_30%_30%_at_50%_50%,rgba(79,70,229,0.15),transparent_100%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]"></div>
      </div>
      
      {/* Glowing accent lines */}
      <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent"></div>
      <div className="absolute top-[52%] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
      
      <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
        <div className="mb-6 sm:mb-8 md:mb-12">
        <Image 
            src="/logo.svg" 
            alt="WebHash Pro Logo" 
            width={240} 
            height={50} 
            className="w-[180px] h-[37px] sm:w-[240px] sm:h-[50px] md:w-[304px] md:h-[63px]" 
            priority
          />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-center mb-8 sm:mb-12 md:mb-16 max-w-4xl">
          <div className="whitespace-normal sm:whitespace-nowrap">Deploy your apps and websites</div>
          <div>to the <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500">permanent web</span></div>
        </h1>
        
        <Card className="w-full max-w-md bg-black/40 border border-gray-800 backdrop-blur-sm shadow-[0_0_15px_rgba(79,70,229,0.15)] rounded-xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500"></div>
          <CardHeader className="space-y-1 border-b border-gray-800/50 pb-4 sm:pb-6">
            <CardTitle className="text-xl sm:text-2xl font-bold text-white">Sign in</CardTitle>
            <CardDescription className="text-sm text-gray-400">
              Connect with your GitHub account to deploy your projects to IPFS
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4 sm:pt-6">
            <Button
              className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium py-4 sm:py-6 transition-all duration-300 shadow-lg hover:shadow-indigo-500/20 rounded-md"
              onClick={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  Sign in with GitHub
                </span>
              )}
            </Button>
          </CardContent>
          <CardFooter className="flex flex-col items-center justify-center text-center text-xs sm:text-sm text-gray-500 border-t border-gray-800/50 pt-4 sm:pt-6">
            <p>
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </CardFooter>
        </Card>
        
        {/* Floating elements for visual interest */}
        <div className="absolute -bottom-10 -left-10 w-24 h-24 sm:w-40 sm:h-40 bg-indigo-900/10 rounded-full blur-3xl"></div>
        <div className="absolute -top-10 -right-10 w-24 h-24 sm:w-40 sm:h-40 bg-blue-900/10 rounded-full blur-3xl"></div>
      </div>
      
      {/* Animated dots */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
        {Array.from({ length: 20 }).map((_, i) => (
          <div 
            key={i}
            className="absolute rounded-full"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 4 + 1}px`,
              height: `${Math.random() * 4 + 1}px`,
              backgroundColor: i % 2 === 0 ? '#6366f1' : '#3b82f6',
              animation: `floatParticle ${Math.random() * 10 + 10}s linear infinite`,
              opacity: Math.random() * 0.7 + 0.3,
            }}
          />
        ))}
      </div>
     
      {/* Add CSS for animations. */}
      <style jsx global>{`
        @keyframes floatParticle {
          0% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-40px) translateX(-10px); }
          75% { transform: translateY(-20px) translateX(10px); }
          100% { transform: translateY(0) translateX(0); }
        }
      `}</style>
    </main>
  );
}
