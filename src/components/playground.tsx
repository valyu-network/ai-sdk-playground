"use client";

import { useState, useEffect, useCallback, useId, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, ChevronDown, Sparkles, Check, X } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  // {
  //   id: "companyResearch",
  //   name: "Company Research",
  //   samplePrompt: "Research the company Holistic AI",
  // },
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

type Mode = "stream" | "generate" | "stream-object" | "object";

const MODES: { id: Mode; name: string; description: string }[] = [
  { id: "stream", name: "Stream Text", description: "Stream text response" },
  { id: "generate", name: "Generate Text", description: "Generate full response" },
  { id: "stream-object", name: "Stream Object", description: "Stream structured data" },
  { id: "object", name: "Generate Object", description: "Generate structured data" },
];

// Tool-specific default schemas for object generation
const TOOL_SCHEMAS: Record<string, { name: string; description: string; schema: string }> = {
  webSearch: {
    name: "Web Search Results",
    description: "Structured web search findings",
    schema: `z.object({
  query: z.string().describe("The search query"),
  summary: z.string().describe("Executive summary of findings"),
  results: z.array(z.object({
    title: z.string(),
    source: z.string().describe("Website or publication name"),
    url: z.string().optional(),
    keyPoints: z.array(z.string()),
    relevance: z.enum(["high", "medium", "low"]),
  })),
  conclusion: z.string(),
})`,
  },
  financeSearch: {
    name: "Financial Data",
    description: "Stock prices, market data, financial metrics",
    schema: `z.object({
  query: z.string(),
  securities: z.array(z.object({
    ticker: z.string(),
    name: z.string(),
    prices: z.array(z.object({
      date: z.string(),
      open: z.number().optional(),
      close: z.number().optional(),
      high: z.number().optional(),
      low: z.number().optional(),
      volume: z.number().optional(),
    })),
    metrics: z.object({
      marketCap: z.string().optional(),
      peRatio: z.number().optional(),
      dividendYield: z.string().optional(),
    }).optional(),
  })),
  analysis: z.string(),
  dataSource: z.string(),
})`,
  },
  paperSearch: {
    name: "Research Papers",
    description: "Academic paper summaries and citations",
    schema: `z.object({
  query: z.string(),
  papers: z.array(z.object({
    title: z.string(),
    authors: z.array(z.string()),
    year: z.number().optional(),
    journal: z.string().optional(),
    doi: z.string().optional(),
    abstract: z.string(),
    keyFindings: z.array(z.string()),
    methodology: z.string().optional(),
    citations: z.number().optional(),
  })),
  synthesis: z.string().describe("Overall synthesis of the research"),
  gaps: z.array(z.string()).describe("Research gaps identified"),
})`,
  },
  bioSearch: {
    name: "Biomedical Data",
    description: "Clinical trials, drug info, medical research",
    schema: `z.object({
  query: z.string(),
  trials: z.array(z.object({
    trialId: z.string().describe("NCT number or trial identifier"),
    title: z.string(),
    phase: z.string().optional(),
    status: z.string(),
    condition: z.string(),
    intervention: z.string(),
    sponsor: z.string().optional(),
    enrollment: z.number().optional(),
    primaryOutcome: z.string().optional(),
    results: z.string().optional(),
  })),
  drugs: z.array(z.object({
    name: z.string(),
    mechanism: z.string(),
    indication: z.string(),
    efficacy: z.string().optional(),
    safetyProfile: z.string().optional(),
  })).optional(),
  summary: z.string(),
})`,
  },
  patentSearch: {
    name: "Patent Data",
    description: "Patent filings, claims, and IP analysis",
    schema: `z.object({
  query: z.string(),
  patents: z.array(z.object({
    patentNumber: z.string(),
    title: z.string(),
    assignee: z.string(),
    inventors: z.array(z.string()),
    filingDate: z.string(),
    publicationDate: z.string().optional(),
    status: z.string(),
    abstract: z.string(),
    claims: z.array(z.string()).describe("Key patent claims"),
    classifications: z.array(z.string()).optional(),
  })),
  landscape: z.string().describe("Patent landscape analysis"),
  keyPlayers: z.array(z.object({
    company: z.string(),
    patentCount: z.number(),
    focus: z.string(),
  })).optional(),
})`,
  },
  secSearch: {
    name: "SEC Filing Data",
    description: "SEC filings, financial statements, disclosures",
    schema: `z.object({
  query: z.string(),
  filings: z.array(z.object({
    accessionNumber: z.string(),
    formType: z.string().describe("10-K, 10-Q, 8-K, etc."),
    company: z.string(),
    cik: z.string(),
    filingDate: z.string(),
    periodOfReport: z.string().optional(),
    sections: z.array(z.object({
      name: z.string().describe("Section name like MD&A, Risk Factors"),
      summary: z.string(),
      keyPoints: z.array(z.string()),
    })),
  })),
  financialHighlights: z.object({
    revenue: z.string().optional(),
    netIncome: z.string().optional(),
    eps: z.string().optional(),
    guidance: z.string().optional(),
  }).optional(),
  riskFactors: z.array(z.string()).optional(),
  analysis: z.string(),
})`,
  },
  economicsSearch: {
    name: "Economic Data",
    description: "Economic indicators, statistics, trends",
    schema: `z.object({
  query: z.string(),
  indicators: z.array(z.object({
    name: z.string().describe("CPI, GDP, Unemployment Rate, etc."),
    values: z.array(z.object({
      date: z.string(),
      value: z.number(),
      unit: z.string().optional(),
    })),
    source: z.string(),
    frequency: z.string().optional(),
    trend: z.enum(["increasing", "decreasing", "stable"]).optional(),
  })),
  analysis: z.string(),
  forecast: z.string().optional(),
  correlations: z.array(z.object({
    indicator1: z.string(),
    indicator2: z.string(),
    relationship: z.string(),
  })).optional(),
})`,
  },
  companyResearch: {
    name: "Company Profile",
    description: "Comprehensive company research",
    schema: `z.object({
  company: z.object({
    name: z.string(),
    ticker: z.string().optional(),
    industry: z.string(),
    founded: z.string().optional(),
    headquarters: z.string().optional(),
    employees: z.number().optional(),
    website: z.string().optional(),
  }),
  description: z.string(),
  products: z.array(z.string()),
  financials: z.object({
    revenue: z.string().optional(),
    valuation: z.string().optional(),
    funding: z.string().optional(),
  }).optional(),
  leadership: z.array(z.object({
    name: z.string(),
    title: z.string(),
  })).optional(),
  competitors: z.array(z.string()).optional(),
  swot: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    opportunities: z.array(z.string()),
    threats: z.array(z.string()),
  }).optional(),
})`,
  },
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
  const [mode, setMode] = useState<Mode>(
    (searchParams.get("mode") as Mode) || "stream"
  );
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [objectResult, setObjectResult] = useState<Record<string, unknown> | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [schemaType, setSchemaType] = useState<"default" | "custom">(
    (searchParams.get("schema") as "default" | "custom") || "default"
  );
  const [schemaPrompt, setSchemaPrompt] = useState(
    searchParams.get("schemaPrompt") || ""
  );
  const [generatingSchema, setGeneratingSchema] = useState(false);
  // Editable schema - initialized from URL or tool default
  const [editableSchema, setEditableSchema] = useState<string>(() => {
    const urlSchema = searchParams.get("schemaCode");
    if (urlSchema) {
      try {
        return decodeURIComponent(urlSchema);
      } catch {
        return "";
      }
    }
    return "";
  });

  const isObjectMode = mode === "stream-object" || mode === "object";

  // Validate schema syntax
  const schemaValidation = useMemo(() => {
    if (!editableSchema.trim()) {
      return { valid: false, error: "Schema is empty" };
    }
    try {
      // Try to parse the schema as a function that returns a Zod type
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      new Function("z", `return ${editableSchema}`);
      return { valid: true, error: null };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : "Invalid syntax" };
    }
  }, [editableSchema]);

  // Initialize editable schema when tool changes or on mount
  useEffect(() => {
    const urlSchema = searchParams.get("schemaCode");
    if (urlSchema) {
      try {
        setEditableSchema(decodeURIComponent(urlSchema));
      } catch {
        setEditableSchema(TOOL_SCHEMAS[tool]?.schema || "");
      }
    } else if (schemaType === "default") {
      setEditableSchema(TOOL_SCHEMAS[tool]?.schema || "");
    }
  }, [tool]);

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
    if (isObjectMode) {
      params.set("schema", schemaType);
      if (schemaType === "custom" && schemaPrompt) {
        params.set("schemaPrompt", schemaPrompt);
      }
      // Save schema if it's been modified from default
      if (editableSchema) {
        const defaultSchema = TOOL_SCHEMAS[tool]?.schema || "";
        if (editableSchema !== defaultSchema || schemaType === "custom") {
          params.set("schemaCode", encodeURIComponent(editableSchema));
        }
      }
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [tool, model, prompt, maxNumResults, mode, schemaType, schemaPrompt, editableSchema, isObjectMode, router]);

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

  const generateSchemaFromPrompt = async () => {
    if (!schemaPrompt.trim()) return;
    setGeneratingSchema(true);
    try {
      const response = await fetch("/api/generate-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: schemaPrompt }),
      });
      const data = await response.json();
      if (data.error) {
        console.error("Schema generation error:", data.error);
      } else {
        setEditableSchema(data.schema);
      }
    } catch (error) {
      console.error("Schema generation failed:", error);
    } finally {
      setGeneratingSchema(false);
    }
  };

  const handleSchemaTypeChange = (newType: "default" | "custom") => {
    setSchemaType(newType);
    if (newType === "default") {
      // Reset to tool default
      setEditableSchema(TOOL_SCHEMAS[tool]?.schema || "");
    } else {
      // Keep current or clear for custom
      if (!editableSchema) {
        setEditableSchema("");
      }
    }
  };

  const resetSchemaToDefault = () => {
    setEditableSchema(TOOL_SCHEMAS[tool]?.schema || "");
  };

  const getSchemaForRequest = () => {
    return editableSchema || null;
  };

  const handleRun = async () => {
    if (!prompt.trim()) return;
    setMessages([]);
    setGenerateResult(null);
    setObjectResult(null);

    if (mode === "stream") {
      sendMessage({ text: prompt });
    } else {
      setGenerateLoading(true);
      try {
        const schema = isObjectMode ? getSchemaForRequest() : null;
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", parts: [{ type: "text", text: prompt }] }],
            tool,
            model,
            maxNumResults,
            mode,
            schema,
            schemaPrompt: schemaType === "custom" ? schemaPrompt : undefined,
          }),
        });
        const data = await response.json();
        if (data.error) {
          setGenerateResult(`Error: ${data.error}`);
        } else if (isObjectMode) {
          setObjectResult(data.object);
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
                  <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Schema Selection - Only shown for object modes */}
              {isObjectMode && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label>Schema</Label>
                    <div className="flex items-center gap-2">
                      <Select value={schemaType} onValueChange={handleSchemaTypeChange}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">
                            {TOOL_SCHEMAS[tool]?.name || "Default Schema"}
                          </SelectItem>
                          <SelectItem value="custom">
                            AI Generate Schema
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {schemaType === "default" && editableSchema !== TOOL_SCHEMAS[tool]?.schema && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={resetSchemaToDefault}
                          className="text-xs"
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Custom schema prompt input */}
                  {schemaType === "custom" && (
                    <div className="space-y-2">
                      <Label htmlFor="schemaPrompt">Describe your schema</Label>
                      <div className="flex gap-2">
                        <Input
                          id="schemaPrompt"
                          value={schemaPrompt}
                          onChange={(e) => setSchemaPrompt(e.target.value)}
                          placeholder="e.g., 'product details with name, price, features'"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          onClick={generateSchemaFromPrompt}
                          disabled={generatingSchema || !schemaPrompt.trim()}
                        >
                          {generatingSchema ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          <span className="ml-1">Generate</span>
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Editable schema textarea */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="schemaCode" className="text-xs text-muted-foreground">
                        Zod Schema (editable)
                      </Label>
                      <div className="flex items-center gap-1.5">
                        {schemaValidation.valid ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-green-500" />
                            <span className="text-xs text-green-500">Valid</span>
                          </>
                        ) : (
                          <>
                            <X className="h-3.5 w-3.5 text-red-500" />
                            <span className="text-xs text-red-500">Invalid</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Textarea
                      id="schemaCode"
                      value={editableSchema}
                      onChange={(e) => setEditableSchema(e.target.value)}
                      placeholder="z.object({ ... })"
                      className={`font-mono text-xs min-h-[150px] max-h-[300px] resize-y ${
                        !schemaValidation.valid && editableSchema.trim() ? "border-red-500/50" : ""
                      }`}
                    />
                    {!schemaValidation.valid && schemaValidation.error && editableSchema.trim() && (
                      <p className="text-xs text-red-500">{schemaValidation.error}</p>
                    )}
                  </div>
                </div>
              )}

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
                disabled={isLoading || !prompt.trim() || (isObjectMode && !schemaValidation.valid)}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    Run with {selectedModel?.name || "AI"}
                    <span className="ml-2 hidden sm:inline-flex items-center gap-0.5 text-xs opacity-70">
                      <span className="flex items-center justify-center w-5 h-5 font-semibold border rounded bg-primary-foreground/10">
                        ⌘
                      </span>
                      <span className="flex items-center justify-center w-5 h-5 font-semibold border rounded bg-primary-foreground/10">
                        ↵
                      </span>
                    </span>
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Response - Stream Mode */}
          {mode === "stream" && lastAssistantMessage && (
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

          {/* Response - Object Modes */}
          {isObjectMode && objectResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
                <h3 className="font-semibold mb-1">Structured Response</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  If output doesn&apos;t match schema, unfortunately it is the LLM&apos;s fault
                </p>
                <pre className="p-4 bg-muted rounded text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(objectResult, null, 2)}
                </pre>
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
              schema={isObjectMode ? getSchemaForRequest() : undefined}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
