import {
  streamText,
  generateText,
  stepCountIs,
  convertToModelMessages,
  UIMessage,
} from "ai";
import {
  webSearch,
  financeSearch,
  paperSearch,
  bioSearch,
  patentSearch,
  secSearch,
  economicsSearch,
  companyResearch,
} from "@valyu/ai-sdk";

const TOOLS_MAP = {
  webSearch,
  financeSearch,
  paperSearch,
  bioSearch,
  patentSearch,
  secSearch,
  economicsSearch,
  companyResearch,
} as const;

type ToolName = keyof typeof TOOLS_MAP;

const GROQ_MODELS = ["openai/gpt-oss-120b"];

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const SYSTEM_PROMPT = `Today is ${today}. Answer using search results. Place citations immediately after each statement like "fact [1]" or "claim [2][3]", not grouped at the end. Citation numbers correspond to search result order. Write in well formatted MD.`;

export async function POST(request: Request) {
  const { messages, tool, model, maxNumResults = 3, mode } = await request.json();

  const toolName = tool as ToolName;
  const toolFn = TOOLS_MAP[toolName];

  if (!toolFn) {
    return Response.json({ error: "Invalid tool" }, { status: 400 });
  }

  const toolInstance = toolName === "companyResearch"
    ? toolFn()
    : toolFn({ maxNumResults });
  const tools = { [toolName]: toolInstance };

  const providerOptions = GROQ_MODELS.includes(model)
    ? { gateway: { order: ["groq"] } }
    : undefined;

  try {
    if (mode === "streaming") {
      const result = streamText({
        model,
        system: SYSTEM_PROMPT,
        messages: convertToModelMessages(messages as UIMessage[]),
        tools,
        providerOptions,
        stopWhen: stepCountIs(10),
      });

      return result.toUIMessageStreamResponse();
    } else {
      const { text } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        messages: convertToModelMessages(messages as UIMessage[]),
        tools,
        providerOptions,
        stopWhen: stepCountIs(10),
      });

      return Response.json({ text });
    }
  } catch (error) {
    console.error("AI SDK Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
