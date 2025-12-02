"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";

export function DocsShortcut() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key.toLowerCase() === "d" && !e.metaKey && !e.ctrlKey) {
        window.open("https://docs.valyu.ai", "_blank");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <motion.a
      href="https://docs.valyu.ai"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
    >
      <span className="flex items-center justify-center w-5 h-5 text-xs font-semibold border rounded bg-muted">
        D
      </span>
      <span>Docs</span>
    </motion.a>
  );
}
