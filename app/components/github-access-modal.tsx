"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GitHubLogoIcon } from "@radix-ui/react-icons";

interface GitHubAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GitHubAccessModal({ isOpen, onClose }: GitHubAccessModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestAccess = () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get the current URL for the callback
      const baseUrl = window.location.origin;
      const callbackUrl = `${baseUrl}/dashboard`;
      
      // Directly navigate to our reauthorize endpoint which will redirect to GitHub
      window.location.href = `/api/github/reauthorize?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      
    } catch (error) {
      console.error("Error requesting GitHub access:", error);
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant Additional Repository Access</DialogTitle>
          <DialogDescription>
            You need to authorize WebHash to access additional repositories on your GitHub account.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 text-red-800 dark:text-red-300">
              <p className="text-sm">{error}</p>
            </div>
          )}
          
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-4">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-amber-800 dark:text-amber-300">
                <p className="font-medium mb-1">Why do I need to do this?</p>
                <p>
                  When you first signed in, you may have only granted access to specific repositories. 
                  To access additional repositories, you need to update your GitHub permissions.
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium">What will happen:</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>You'll be redirected to GitHub to review and approve repository access</li>
              <li>You can select which repositories to grant access to</li>
              <li>After approval, you'll be redirected back to the dashboard</li>
              <li>Your previously selected repositories will remain accessible</li>
            </ul>
          </div>
        </div>
        
        <DialogFooter className="flex space-x-2 sm:justify-end">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleRequestAccess}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Redirecting...</span>
              </>
            ) : (
              <>
                <GitHubLogoIcon className="h-4 w-4" />
                <span>Authorize on GitHub</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
