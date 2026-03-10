import OpenAI from "openai";
import { logger } from "../utils/logger";
import { buildCacheKey, getCached, setCached } from "./llmCacheService";

export interface LlmConfig {
  apiKey: string;
  baseURL: string;
  generalModel: string;
  boostModel: string;
  embeddingModel?: string;
}

export type ModelTier = "general" | "boost";

export class LlmService {
  private client: OpenAI;
  private generalModel: string;
  private boostModel: string;
  private embeddingModel: string;

  constructor(config: LlmConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
    this.generalModel = config.generalModel;
    this.boostModel = config.boostModel;
    this.embeddingModel = config.embeddingModel || "text-embedding-004";
  }

  private getModel(tier: ModelTier): string {
    return tier === "boost" ? this.boostModel : this.generalModel;
  }

  async chat(messages: OpenAI.ChatCompletionMessageParam[], options?: {
    tier?: ModelTier; temperature?: number; maxTokens?: number;
    responseFormat?: { type: "json_object" | "text" };
  }): Promise<string> {
    const tier = options?.tier || "general";
    const model = this.getModel(tier);
    const cacheParams = {
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens,
      responseFormat: options?.responseFormat,
    };
    const cacheKey = buildCacheKey(model, messages, cacheParams);

    const cached = await getCached(cacheKey);
    if (cached !== null) {
      logger.debug({ tier, model, cacheKey }, "LLM cache hit");
      return cached;
    }

    const response = await this.client.chat.completions.create({
      model, messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      response_format: options?.responseFormat,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("LLM returned empty response");
    logger.debug({ tier, model, tokens: response.usage }, "LLM chat");

    await setCached(cacheKey, content);
    return content;
  }

  async chatJson<T = Record<string, unknown>>(messages: OpenAI.ChatCompletionMessageParam[], options?: {
    tier?: ModelTier; temperature?: number; maxTokens?: number;
  }): Promise<T> {
    const content = await this.chat(messages, { ...options, responseFormat: { type: "json_object" } });
    try {
      return JSON.parse(content) as T;
    } catch {
      throw new Error(`LLM returned invalid JSON: ${content.slice(0, 200)}`);
    }
  }

  async *chatStream(messages: OpenAI.ChatCompletionMessageParam[], options?: {
    tier?: ModelTier; temperature?: number; maxTokens?: number;
  }): AsyncGenerator<string> {
    const tier = options?.tier || "general";
    const stream = await this.client.chat.completions.create({
      model: this.getModel(tier), messages,
      temperature: options?.temperature ?? 0.7, max_tokens: options?.maxTokens, stream: true,
    });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({ model: this.embeddingModel, input: texts, dimensions: 768 });
    return response.data.map((d) => d.embedding);
  }

  async embedSingle(text: string): Promise<number[]> {
    const embeddings = await this.embed([text]);
    return embeddings[0];
  }
}

let instance: LlmService | null = null;
export function getLlmService(): LlmService {
  if (!instance) {
    instance = new LlmService({
      apiKey: process.env.LLM_API_KEY || "",
      baseURL: process.env.LLM_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/",
      generalModel: process.env.LLM_MODEL_GENERAL || "gemini-2.5-flash",
      boostModel: process.env.LLM_MODEL_BOOST || "gemini-2.5-flash",
      embeddingModel: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
    });
  }
  return instance;
}
