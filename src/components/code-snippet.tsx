"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";

type Mode = "stream" | "generate" | "stream-object" | "object";

interface CodeSnippetProps {
  tool: string;
  prompt: string;
  model: string;
  maxNumResults: number;
  mode: Mode;
  schema?: string | null;
  schemaName?: string;
}

const toolImportMap: Record<string, string> = {
  webSearch: "webSearch",
  financeSearch: "financeSearch",
  paperSearch: "paperSearch",
  bioSearch: "bioSearch",
  patentSearch: "patentSearch",
  secSearch: "secSearch",
  economicsSearch: "economicsSearch",
  companyResearch: "companyResearch",
};

export function CodeSnippet({
  tool,
  prompt,
  model,
  maxNumResults,
  mode,
  schema,
}: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const toolImport = toolImportMap[tool] || "webSearch";
  const isObjectMode = mode === "stream-object" || mode === "object";

  const getFnName = () => {
    switch (mode) {
      case "stream": return "streamText";
      case "generate": return "generateText";
      case "stream-object": return "streamObject";
      case "object": return "generateObject";
    }
  };
  const fnName = getFnName();

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const systemPrompt = isObjectMode
    ? `Today is ${today}. Use the search results to provide accurate, structured data.`
    : `Today is ${today}. Answer using search results. Place citations immediately after each statement like "fact [1]" or "claim [2][3]", not grouped at the end. Citation numbers correspond to search result order. Write in well formatted MD.`;

  const toolConfig = tool === "companyResearch"
    ? ""
    : maxNumResults !== 3
      ? `{ maxNumResults: ${maxNumResults} }`
      : "";

  // Generate code based on mode
  const generateCode = () => {
    if (isObjectMode) {
      const schemaCode = schema
        ? `const schema = ${schema};`
        : `// No schema - will use 'no-schema' mode`;

      const schemaParam = schema
        ? `schema,`
        : `output: 'no-schema',`;

      const objectFn = mode === "stream-object" ? "streamObject" : "generateObject";

      return `import { generateText, ${objectFn}, stepCountIs } from 'ai';
import { ${toolImport} } from '@valyu/ai-sdk';
import { z } from 'zod';

${schemaCode}

// Step 1: Search for information using tools
const searchResult = await generateText({
  model: '${model}',
  system: 'Search for relevant information.',
  prompt: '${prompt.replace(/'/g, "\\'")}',
  tools: {
    ${toolImport}: ${toolImport}(${toolConfig}),
  },
  stopWhen: stepCountIs(5),
});

// Step 2: Structure the results
const ${mode === "stream-object" ? "result" : "{ object }"} = ${mode === "stream-object" ? "" : "await "}${objectFn}({
  model: '${model}',
  ${schemaParam}
  system: \`${systemPrompt}\`,
  prompt: \`Based on these search results, extract structured data:\\n\${searchResult.text}\`,
});${
        mode === "stream-object"
          ? `

for await (const partialObject of result.partialObjectStream) {
  console.clear();
  console.log(partialObject);
}`
          : `

console.log(JSON.stringify(object, null, 2));`
      }`;
    }

    // Text modes with tools
    return `import { ${fnName}, stepCountIs } from 'ai';
import { ${toolImport} } from '@valyu/ai-sdk';

const ${mode === "stream" ? "result" : "{ text }"} = ${mode === "stream" ? "" : "await "}${fnName}({
  model: '${model}',
  system: \`${systemPrompt}\`,
  prompt: '${prompt.replace(/'/g, "\\'")}',
  tools: {
    ${toolImport}: ${toolImport}(${toolConfig}),
  },
  stopWhen: stepCountIs(10),
});${
      mode === "stream"
        ? `

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}`
        : `

console.log(text);`
    }`;
  };

  const code = generateCode();

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="relative overflow-hidden !py-0 !gap-0">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <span
          className="text-sm font-medium text-muted-foreground cursor-default flex items-center gap-1"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          Backend Code
          <AnimatePresence>
            {isHovered && (
              <motion.span
                initial={{ opacity: 0, x: -10, width: 0 }}
                animate={{ opacity: 1, x: 0, width: "auto" }}
                exit={{ opacity: 0, x: -10, width: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="text-muted-foreground/70 overflow-hidden whitespace-nowrap"
              >
                (yes, it is this easy!)
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={copyToClipboard}
          className="h-8 px-2"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="ml-2">{copied ? "Copied!" : "Copy"}</span>
        </Button>
      </div>
      <pre className="p-3 sm:p-4 overflow-x-auto text-xs sm:text-sm font-mono bg-card">
        <code className="text-foreground">{code}</code>
      </pre>
    </Card>
  );
}
