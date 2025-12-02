"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, Search, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ToolCallDisplayProps {
  toolName: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: { query?: string };
  errorText?: string;
}

const TOOL_LABELS: Record<string, string> = {
  webSearch: "Web Search",
  financeSearch: "Finance Search",
  paperSearch: "Paper Search",
  bioSearch: "Bio Search",
  patentSearch: "Patent Search",
  secSearch: "SEC Search",
  economicsSearch: "Economics Search",
  companyResearch: "Company Research",
};

export function ToolCallDisplay({
  toolName,
  state,
  input,
  errorText,
}: ToolCallDisplayProps) {
  const isLoading = state === "input-streaming" || state === "input-available";
  const isComplete = state === "output-available";
  const isError = state === "output-error";
  const label = TOOL_LABELS[toolName] || toolName;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-4 mb-4 bg-muted/30 border-muted">
        <div className="flex items-start gap-3">
          {/* Valyu Logo */}
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-background border flex items-center justify-center overflow-hidden">
              <Image
                src="/valyu.png"
                alt="Valyu"
                width={24}
                height={24}
                className="object-contain dark:invert"
              />
            </div>
            {isLoading && (
              <motion.div
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-background border flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="w-2.5 h-2.5 text-muted-foreground" />
              </motion.div>
            )}
            {isComplete && (
              <motion.div
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <CheckCircle2 className="w-2.5 h-2.5 text-white" />
              </motion.div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {label}
              </span>
              {isLoading && (
                <span className="text-xs text-muted-foreground">
                  Searching...
                </span>
              )}
              {isComplete && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  Complete
                </span>
              )}
              {isError && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  Error
                </span>
              )}
            </div>

            {/* Query display */}
            {input?.query && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2"
              >
                <div className="text-xs text-muted-foreground mb-1">Query:</div>
                <div className="text-sm text-foreground bg-background/50 rounded px-2 py-1.5 font-mono">
                  {input.query}
                </div>
              </motion.div>
            )}

            {/* Error display */}
            {isError && errorText && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                {errorText}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
