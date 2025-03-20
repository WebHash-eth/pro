"use client";

import { useState } from "react";
import { X, Menu, Home, Github, Server, Globe, Key, Cog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ThemeAwareLogo } from "./theme-aware-logo";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleNavigation = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open mobile menu">
        <Menu className="h-6 w-6" />
      </Button>
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
          
          {/* Navigation Panel */}
          <div className="fixed left-0 top-0 h-full w-3/4 max-w-xs bg-background shadow-lg z-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-14 items-center border-b px-4">
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close mobile menu">
                <X className="h-6 w-6" />
              </Button>
              <div className="ml-4">
                <button onClick={() => handleNavigation("/")} className="flex items-center font-semibold">
                  <ThemeAwareLogo width={140} height={30} className="w-[140px] h-[30px]" />
                </button>
              </div>
            </div>
            <nav className="flex-1 py-4 overflow-y-auto">
              <div className="px-3 py-2">
                <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
                  Navigation
                </h2>
                <div className="space-y-1">
                  <button 
                    onClick={() => handleNavigation("/dashboard")}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground w-full text-left"
                  >
                    <Home className="h-5 w-5" />
                    Dashboard
                  </button>
                  <button 
                    onClick={() => handleNavigation("/dashboard/repositories")}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground w-full text-left"
                  >
                    <Github className="h-5 w-5" />
                    Repositories
                  </button>
                  <button 
                    onClick={() => handleNavigation("/dashboard/deployments")}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground w-full text-left"
                  >
                    <Server className="h-5 w-5" />
                    Deployments
                  </button>
                  <button 
                    onClick={() => handleNavigation("/dashboard/domains")}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground w-full text-left"
                  >
                    <Globe className="h-5 w-5" />
                    ENS Domains
                  </button>
                  <button 
                    onClick={() => handleNavigation("/dashboard/env-variables")}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground w-full text-left"
                  >
                    <Key className="h-5 w-5" />
                    Environment Variables
                  </button>
                  <button 
                    onClick={() => handleNavigation("/dashboard/settings")}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground w-full text-left"
                  >
                    <Cog className="h-5 w-5" />
                    Settings
                  </button>
                </div>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
