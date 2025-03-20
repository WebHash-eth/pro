"use client";

import { Cog, Github, Home, Key, Globe, Server } from "lucide-react";

export const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Repositories",
    href: "/dashboard/repositories",
    icon: Github,
  },
  {
    title: "Deployments",
    href: "/dashboard/deployments",
    icon: Server,
  },
  {
    title: "ENS Domains",
    href: "/dashboard/domains",
    icon: Globe,
  },
  {
    title: "Environment Variables",
    href: "/dashboard/env-variables",
    icon: Key,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Cog,
  },
];
