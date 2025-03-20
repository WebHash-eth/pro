"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface ThemeAwareLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function ThemeAwareLogo({ width = 140, height = 30, className = "" }: ThemeAwareLogoProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Only show the logo after component has mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div 
        style={{ width: `${width}px`, height: `${height}px` }} 
        className={`${className} bg-transparent`} 
      />
    );
  }

  // Use different logo based on theme
  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const logoSrc = currentTheme === "dark" ? "/logo.svg" : "/logo-light.svg";

  return (
    <Image 
      src={logoSrc} 
      alt="WebHash Pro Logo" 
      width={width} 
      height={height} 
      className={className} 
      priority
    />
  );
}
