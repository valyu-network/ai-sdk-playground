import { generateObject } from "ai";
import { z } from "zod";

const GROQ_MODELS = ["openai/gpt-oss-120b"];

export async function POST(request: Request) {
  const { prompt } = await request.json();

  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  const model = "openai/gpt-oss-120b";
  const providerOptions = GROQ_MODELS.includes(model)
    ? { gateway: { order: ["groq"] } }
    : undefined;

  try {
    const { object } = await generateObject({
      model,
      schema: z.object({
        schema: z.string().describe("A valid Zod schema string that can be used with z.object()"),
      }),
      system: `You are a schema generator. Given a description of data structure, generate a valid Zod schema string.

Rules:
- Output ONLY the schema code, starting with z.object({...})
- Use appropriate Zod types: z.string(), z.number(), z.boolean(), z.array(), z.object(), z.enum([])
- Add .describe() to fields to help the AI understand what data to extract
- Keep schemas reasonably simple and focused
- Use snake_case or camelCase consistently for field names

Example output for "product with name and price":
z.object({
  name: z.string().describe("Product name"),
  price: z.number().describe("Product price in USD"),
  currency: z.string().default("USD"),
})`,
      prompt: `Generate a Zod schema for: ${prompt}`,
      providerOptions,
    });

    return Response.json({ schema: object.schema });
  } catch (error) {
    console.error("Schema generation error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
