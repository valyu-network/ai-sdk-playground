"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CodeSnippetProps {
  tool: string;
  prompt: string;
  model: string;
  maxNumResults: number;
  mode: "streaming" | "generate";
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
}: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const toolImport = toolImportMap[tool] || "webSearch";
  const fnName = mode === "streaming" ? "streamText" : "generateText";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const systemPrompt = `Today is ${today}. Answer using search results. Place citations immediately after each statement like "fact [1]" or "claim [2][3]", not grouped at the end. Citation numbers correspond to search result order. Write in well formatted MD.`;

  const toolConfig = tool === "companyResearch"
    ? ""
    : maxNumResults !== 3
      ? `{ maxNumResults: ${maxNumResults} }`
      : "";

  const code = `import { ${fnName}, stepCountIs } from 'ai';
import { ${toolImport} } from '@valyu/ai-sdk';

const ${mode === "streaming" ? "result" : "{ text }"} = ${mode === "streaming" ? "" : "await "}${fnName}({
  model: '${model}',
  system: \`${systemPrompt}\`,
  prompt: '${prompt.replace(/'/g, "\\'")}',
  tools: {
    ${toolImport}: ${toolImport}(${toolConfig}),
  },
  stopWhen: stepCountIs(10),
});${
    mode === "streaming"
      ? `

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}`
      : `

console.log(text);`
  }`;

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="relative overflow-hidden !py-0 !gap-0">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <span className="text-sm font-medium text-muted-foreground">
          Backend Code
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
      <pre className="p-4 overflow-x-auto text-sm font-mono bg-card">
        <code className="text-foreground">{code}</code>
      </pre>
    </Card>
  );
}
