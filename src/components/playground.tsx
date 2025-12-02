"use client";

import { useState, useEffect, useCallback, useId, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Play, Loader2, ChevronDown } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ModelSelector,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorLogo,
  ModelSelectorName,
} from "@/components/ai-elements/model-selector";
import { CodeSnippet } from "@/components/code-snippet";
import { ToolCallDisplay } from "@/components/tool-call-display";
import { CitedText, extractCitationsFromToolResults } from "@/components/cited-text";

const TOOLS = [
  {
    id: "webSearch",
    name: "Web Search",
    samplePrompt: "Latest data center projects for AI inference workloads?",
  },
  {
    id: "financeSearch",
    name: "Finance Search",
    samplePrompt:
      "What was the stock price of Apple from the beginning of 2020 to 14th feb?",
  },
  {
    id: "paperSearch",
    name: "Paper Search",
    samplePrompt:
      "Psilocybin effects on cellular lifespan and longevity in mice?",
  },
  {
    id: "bioSearch",
    name: "Bio Search",
    samplePrompt:
      "Summarise top completed Phase 3 metastatic melanoma trial comparing nivolumab+ipilimumab vs monotherapy",
  },
  {
    id: "patentSearch",
    name: "Patent Search",
    samplePrompt:
      "Find patents published in 2025 for high energy laser weapon systems",
  },
  {
    id: "secSearch",
    name: "SEC Search",
    samplePrompt: "Summarise MD&A section of Tesla's latest 10-k filling",
  },
  {
    id: "economicsSearch",
    name: "Economics Search",
    samplePrompt: "What is CPI vs unemployment since 2020 in the US?",
  },
  {
    id: "companyResearch",
    name: "Company Research",
    samplePrompt: "Research the company Holistic AI",
  },
];

// Models organized by provider for the selector
const MODELS_BY_PROVIDER = {
  google: [
    { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro" },
  ],
  openai: [
    { id: "openai/gpt-5.1-instant", name: "GPT-5.1 Instant" },
    { id: "openai/gpt-oss-120b", name: "GPT OSS 120B", note: "via Groq" },
  ],
  anthropic: [
    { id: "anthropic/claude-opus-4.5", name: "Claude Opus 4.5" },
  ],
  xai: [
    { id: "xai/grok-4", name: "Grok 4" },
  ],
  amazon: [
    { id: "amazon/nova-pro", name: "Nova Pro" },
  ],
} as const;

// Flat list for easy lookup
const ALL_MODELS = Object.entries(MODELS_BY_PROVIDER).flatMap(([provider, models]) =>
  models.map((m) => ({ ...m, provider }))
);

const PROVIDER_NAMES: Record<string, string> = {
  google: "Google",
  openai: "OpenAI",
  anthropic: "Anthropic",
  xai: "xAI",
  amazon: "Amazon",
};

export function Playground() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const baseId = useId();

  const [tool, setTool] = useState(searchParams.get("tool") || "webSearch");
  const [model, setModel] = useState(
    searchParams.get("model") || "openai/gpt-oss-120b"
  );
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [prompt, setPrompt] = useState(searchParams.get("prompt") || "");
  const [maxNumResults, setMaxNumResults] = useState(
    Number(searchParams.get("maxResults")) || 3
  );
  const [mode, setMode] = useState<"streaming" | "generate">(
    (searchParams.get("mode") as "streaming" | "generate") || "streaming"
  );
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);

  // Unique chat ID per config to reinitialize useChat with updated transport
  const chatId = useMemo(
    () => `${baseId}-${tool}-${model}-${maxNumResults}-${mode}`,
    [baseId, tool, model, maxNumResults, mode]
  );

  // Transport with current config
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          tool,
          model,
          maxNumResults,
          mode,
        },
      }),
    [tool, model, maxNumResults, mode]
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: chatId,
    transport,
  });

  const isLoading = status === "streaming" || status === "submitted" || generateLoading;

  // Set initial sample prompt on mount
  useEffect(() => {
    if (!searchParams.get("prompt")) {
      const selectedTool = TOOLS.find((t) => t.id === tool);
      if (selectedTool) {
        setPrompt(selectedTool.samplePrompt);
      }
    }
  }, []);

  const updateUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set("tool", tool);
    params.set("model", model);
    if (prompt) params.set("prompt", prompt);
    params.set("maxResults", String(maxNumResults));
    params.set("mode", mode);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [tool, model, prompt, maxNumResults, mode, router]);

  useEffect(() => {
    updateUrl();
  }, [updateUrl]);

  const handleToolChange = (newTool: string) => {
    setTool(newTool);
    const selectedTool = TOOLS.find((t) => t.id === newTool);
    if (selectedTool) {
      setPrompt(selectedTool.samplePrompt);
    }
    setMessages([]);
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    setMessages([]);
    setModelSelectorOpen(false);
  };

  const handleRun = async () => {
    if (!prompt.trim()) return;
    setMessages([]);
    setGenerateResult(null);

    if (mode === "streaming") {
      sendMessage({ text: prompt });
    } else {
      setGenerateLoading(true);
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", parts: [{ type: "text", text: prompt }] }],
            tool,
            model,
            maxNumResults,
            mode,
          }),
        });
        const data = await response.json();
        if (data.error) {
          setGenerateResult(`Error: ${data.error}`);
        } else {
          setGenerateResult(data.text);
        }
      } catch (error) {
        setGenerateResult(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setGenerateLoading(false);
      }
    }
  };

  const selectedModel = ALL_MODELS.find((m) => m.id === model);

  const lastAssistantMessage = messages.filter((m) => m.role === "assistant").pop();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Main content */}
      <div className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Title */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Valyu AI SDK Playground</h1>
            <p className="text-muted-foreground">
              Test{" "}
              <a
                href="https://www.npmjs.com/package/@valyu/ai-sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                @valyu/ai-sdk
              </a>{" "}
              tools with AI SDK v5
            </p>
          </div>

          {/* Configuration */}
          <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="grid gap-4 sm:gap-6">
              {/* Tool & Model Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tool">Search Tool</Label>
                  <Select value={tool} onValueChange={handleToolChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tool" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOOLS.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <ModelSelector open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                    <ModelSelectorTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between font-normal"
                      >
                        <div className="flex items-center gap-2">
                          {selectedModel && (
                            <ModelSelectorLogo
                              provider={selectedModel.provider}
                              className="size-4"
                            />
                          )}
                          <span>{selectedModel?.name || "Select a model"}</span>
                        </div>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </ModelSelectorTrigger>
                    <ModelSelectorContent>
                      <ModelSelectorInput placeholder="Search models..." />
                      <ModelSelectorList>
                        <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                        {Object.entries(MODELS_BY_PROVIDER).map(([provider, models]) => (
                          <ModelSelectorGroup key={provider} heading={PROVIDER_NAMES[provider]}>
                            {models.map((m) => (
                              <ModelSelectorItem
                                key={m.id}
                                value={m.id}
                                onSelect={() => handleModelChange(m.id)}
                                className="flex items-center gap-2"
                              >
                                <ModelSelectorLogo provider={provider} className="size-4" />
                                <ModelSelectorName>{m.name}</ModelSelectorName>
                                {"note" in m && (
                                  <span className="text-xs text-muted-foreground">{m.note}</span>
                                )}
                              </ModelSelectorItem>
                            ))}
                          </ModelSelectorGroup>
                        ))}
                      </ModelSelectorList>
                    </ModelSelectorContent>
                  </ModelSelector>
                </div>
              </div>

              {/* Options Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Max Results - hidden for companyResearch which doesn't support it */}
                {tool !== "companyResearch" && (
                  <div className="space-y-2">
                    <Label htmlFor="maxResults">Max Results</Label>
                    <Select
                      value={String(maxNumResults)}
                      onValueChange={(v) => setMaxNumResults(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 5, 10, 15, 20].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} results
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className={`space-y-2 ${tool === "companyResearch" ? "md:col-span-2" : ""}`}>
                  <Label>Mode</Label>
                  <div className="flex items-center gap-3 h-9">
                    <span
                      className={`text-sm ${mode === "generate" ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      Generate
                    </span>
                    <Switch
                      checked={mode === "streaming"}
                      onCheckedChange={(checked) =>
                        setMode(checked ? "streaming" : "generate")
                      }
                    />
                    <span
                      className={`text-sm ${mode === "streaming" ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      Stream
                    </span>
                  </div>
                </div>
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <Label htmlFor="prompt">Prompt</Label>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your prompt..."
                  className="min-h-[100px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleRun();
                    }
                  }}
                />
              </div>

              {/* Run Button */}
              <Button
                onClick={handleRun}
                disabled={isLoading || !prompt.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run with {selectedModel?.name || "AI"}
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Response - Streaming Mode */}
          {mode === "streaming" && lastAssistantMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
                <h3 className="font-semibold mb-3">Response</h3>
                <div className="space-y-4">
                  {(() => {
                    const citations = extractCitationsFromToolResults(
                      lastAssistantMessage.parts as Array<{
                        type: string;
                        output?: unknown;
                        state?: string;
                      }>
                    );

                    return lastAssistantMessage.parts.map((part, index) => {
                      if (part.type === "text") {
                        const textContent = typeof part.text === "string"
                          ? part.text
                          : JSON.stringify(part.text, null, 2);
                        return (
                          <CitedText
                            key={index}
                            text={textContent}
                            citations={citations}
                            isAnimating={isLoading}
                          />
                        );
                      }

                      if (part.type === "dynamic-tool") {
                        return (
                          <ToolCallDisplay
                            key={part.toolCallId}
                            toolName={part.toolName}
                            state={part.state}
                            input={part.input as { query?: string }}
                            errorText={
                              part.state === "output-error"
                                ? part.errorText
                                : undefined
                            }
                          />
                        );
                      }

                      if (part.type.startsWith("tool-")) {
                        const toolPart = part as {
                          type: string;
                          toolCallId: string;
                          toolName?: string;
                          state: "input-streaming" | "input-available" | "output-available" | "output-error";
                          input?: { query?: string };
                          errorText?: string;
                        };
                        const toolName = toolPart.type.replace("tool-", "");
                        return (
                          <ToolCallDisplay
                            key={toolPart.toolCallId}
                            toolName={toolName}
                            state={toolPart.state}
                            input={toolPart.input as { query?: string }}
                            errorText={
                              toolPart.state === "output-error"
                                ? toolPart.errorText
                                : undefined
                            }
                          />
                        );
                      }

                      return null;
                    });
                  })()}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Response - Generate Mode */}
          {mode === "generate" && generateResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
                <h3 className="font-semibold mb-3">Response</h3>
                <CitedText
                  text={generateResult}
                  citations={[]}
                  isAnimating={false}
                />
              </Card>
            </motion.div>
          )}

          {/* Code Snippet */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <CodeSnippet
              tool={tool}
              prompt={prompt || TOOLS.find((t) => t.id === tool)?.samplePrompt || ""}
              model={model}
              maxNumResults={maxNumResults}
              mode={mode}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
