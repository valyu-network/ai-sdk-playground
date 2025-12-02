import {
  streamText,
  generateText,
  streamObject,
  generateObject,
  stepCountIs,
  convertToModelMessages,
  UIMessage,
} from "ai";
import { z } from "zod";
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

const OBJECT_SYSTEM_PROMPT = `Today is ${today}. Use the search results to provide accurate, structured data. Extract and organize information according to the requested schema.`;

// Parse a Zod schema string into an actual Zod schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseZodSchema(schemaString: string): z.ZodType<any> {
  // Create a safe evaluation context with Zod
  const evalContext = { z };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const schemaFn = new Function("z", `return ${schemaString}`);
  return schemaFn(evalContext.z);
}

export async function POST(request: Request) {
  const { messages, tool, model, maxNumResults = 3, mode, schema, schemaPrompt } = await request.json();

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

  const isObjectMode = mode === "stream-object" || mode === "object";

  try {
    if (mode === "stream") {
      const result = streamText({
        model,
        system: SYSTEM_PROMPT,
        messages: convertToModelMessages(messages as UIMessage[]),
        tools,
        providerOptions,
        stopWhen: stepCountIs(10),
      });

      return result.toUIMessageStreamResponse();
    } else if (mode === "generate") {
      const { text } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        messages: convertToModelMessages(messages as UIMessage[]),
        tools,
        providerOptions,
        stopWhen: stepCountIs(10),
      });

      return Response.json({ text });
    } else if (isObjectMode) {
      // Step 1: Use generateText with tools to get search results
      const userQuery = ((messages as UIMessage[])[0]?.parts?.find((p: { type: string }) => p.type === "text") as { type: "text"; text: string } | undefined)?.text || "";

      const searchResult = await generateText({
        model,
        system: "You are a search assistant. Use the available search tools to find relevant information for the user's query.",
        messages: convertToModelMessages(messages as UIMessage[]),
        tools,
        providerOptions,
        stopWhen: stepCountIs(5),
      });

      // Extract BOTH the raw tool results AND the text summary
      // Tool results contain the actual data from the API
      const toolResultsData = searchResult.steps
        ?.flatMap(step => step.toolResults || [])
        ?.map(tr => "result" in tr ? tr.result : tr.output) || [];

      const rawResults = toolResultsData.length > 0
        ? JSON.stringify(toolResultsData, null, 2)
        : "";

      const searchContext = rawResults
        ? `Raw Search Data:\n${rawResults}\n\nLLM Summary:\n${searchResult.text || ""}`
        : searchResult.text || "No search results available.";

      // Parse schema or use no-schema mode
      let zodSchema;
      let useNoSchema = false;

      if (schema) {
        try {
          zodSchema = parseZodSchema(schema);
        } catch (e) {
          console.error("Failed to parse schema:", e);
          useNoSchema = true;
        }
      } else {
        useNoSchema = true;
      }

      const objectPrompt = `Based on the following search results, extract and structure the information according to the schema. Follow the schema field names exactly.

Search Results:
${searchContext}

Original Query: ${userQuery}
${schemaPrompt ? `\nDesired Structure: ${schemaPrompt}` : ""}`;

      if (mode === "stream-object") {
        if (useNoSchema) {
          const result = streamObject({
            model,
            output: "no-schema",
            system: OBJECT_SYSTEM_PROMPT,
            prompt: objectPrompt,
            providerOptions,
          });

          let finalObject = {};
          for await (const partialObject of result.partialObjectStream) {
            finalObject = partialObject as Record<string, unknown>;
          }
          return Response.json({ object: finalObject });
        } else {
          const result = streamObject({
            model,
            schema: zodSchema!,
            system: OBJECT_SYSTEM_PROMPT + " You MUST follow the exact field names specified in the schema.",
            prompt: objectPrompt,
            providerOptions,
          });

          let finalObject = {};
          for await (const partialObject of result.partialObjectStream) {
            finalObject = partialObject as Record<string, unknown>;
          }
          return Response.json({ object: finalObject });
        }
      } else {
        // generate object
        if (useNoSchema) {
          const { object } = await generateObject({
            model,
            output: "no-schema",
            system: OBJECT_SYSTEM_PROMPT,
            prompt: objectPrompt,
            providerOptions,
          });

          return Response.json({ object });
        } else {
          const { object } = await generateObject({
            model,
            schema: zodSchema!,
            system: OBJECT_SYSTEM_PROMPT + " You MUST follow the exact field names specified in the schema.",
            prompt: objectPrompt,
            providerOptions,
          });

          return Response.json({ object });
        }
      }
    }

    return Response.json({ error: "Invalid mode" }, { status: 400 });
  } catch (error) {
    console.error("AI SDK Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
