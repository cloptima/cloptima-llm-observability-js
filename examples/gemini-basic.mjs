import {
  extractGeminiUsage,
  initFromEnv,
} from "@cloptima/llm-observability"

const client = initFromEnv({
  env: {
    CLOPTIMA_LLM_OBSERVABILITY_API_KEY: "cloptima_pat_example",
    CLOPTIMA_LLM_OBSERVABILITY_APP_ID: "support-api",
    CLOPTIMA_LLM_OBSERVABILITY_ENVIRONMENT: "dev",
  },
  fetchImpl: async (_url, init) => {
    const payload = JSON.parse(String(init.body))
    if (payload.provider !== "gemini" || payload.model !== "gemini-2.5-pro") {
      throw new Error("unexpected telemetry payload")
    }
    return new Response("{}", { status: 202 })
  },
})

await client.observeCall({
  provider: "gemini",
  model: "gemini-2.5-pro",
  call: () => ({
    responseId: "gemini-example",
    modelVersion: "gemini-2.5-pro",
    usageMetadata: {
      promptTokenCount: 6,
      responseTokenCount: 3,
      totalTokenCount: 9,
    },
  }),
  extractUsage: extractGeminiUsage,
  fireAndForget: false,
  featureId: "message_classification",
})
