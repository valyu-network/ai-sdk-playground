"use client";

import { Suspense } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Playground } from "@/components/playground";
import { ThemeToggle } from "@/components/theme-toggle";
import { DocsShortcut } from "@/components/docs-shortcut";
import SocialLinks from "@/components/social-links";

function PlaygroundPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
          {/* Logo - Left */}
          <motion.a
            href="https://valyu.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Image
              src="/valyu.png"
              alt="Valyu"
              width={100}
              height={32}
              className="h-6 sm:h-8 w-auto dark:invert"
              priority
            />
          </motion.a>

          {/* Right side - Docs + Theme toggle */}
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <DocsShortcut />
            <ThemeToggle />
          </motion.div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
          <Playground />
        </Suspense>
      </main>

      {/* Social Links - Fixed bottom right */}
      <motion.div
        className="fixed bottom-7 sm:bottom-9 right-2 sm:right-4 z-30 hidden sm:flex flex-col items-end gap-3"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1, duration: 0.5, ease: "easeOut" }}
      >
        <SocialLinks />
      </motion.div>
    </div>
  );
}

export default function Page() {
  return <PlaygroundPage />;
}
