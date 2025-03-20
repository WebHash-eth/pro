"use client";

import { Home, Github, Server, Globe, Key, Cog } from "lucide-react";

export function SidebarNav() {
  return (
    <nav className="flex-1 py-4 overflow-hidden">
      <div className="px-3 py-2">
        <div className="space-y-1">
          <a
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <Home className="h-5 w-5" />
            Dashboard
          </a>
          <a
            href="/dashboard/repositories"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <Github className="h-5 w-5" />
            Repositories
          </a>
          <a
            href="/dashboard/deployments"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <Server className="h-5 w-5" />
            Deployments
          </a>
          <a
            href="/dashboard/domains"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <Globe className="h-5 w-5" />
            ENS Domains
          </a>
          <a
            href="/dashboard/env-variables"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <Key className="h-5 w-5" />
            Environment Variables
          </a>
          <a
            href="/dashboard/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <Cog className="h-5 w-5" />
            Settings
          </a>
        </div>
      </div>
    </nav>
  );
}
