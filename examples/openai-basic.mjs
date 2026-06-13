import {
  extractOpenAIUsage,
  initFromEnv,
} from "@cloptima/llm-observability"

const INGEST_URL = "https://sdk-ingest.example.cloptima.ai/sdk/events"

const client = initFromEnv({
  env: {
    CLOPTIMA_LLM_OBSERVABILITY_INGEST_URL: INGEST_URL,
    CLOPTIMA_LLM_OBSERVABILITY_API_KEY: "cloptima_pat_example",
    CLOPTIMA_LLM_OBSERVABILITY_APP_ID: "support-api",
    CLOPTIMA_LLM_OBSERVABILITY_ENVIRONMENT: "dev",
  },
  fetchImpl: async (_url, init) => {
    const payload = JSON.parse(String(init.body))
    if (payload.provider !== "openai" || payload.model !== "gpt-4.1-mini") {
      throw new Error("unexpected telemetry payload")
    }
    return new Response("{}", { status: 202 })
  },
})

await client.observeCall({
  provider: "openai",
  model: "gpt-4.1-mini",
  call: () => ({
    id: "chatcmpl-openai-example",
    model: "gpt-4.1-mini",
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    },
  }),
  extractUsage: extractOpenAIUsage,
  fireAndForget: false,
  featureId: "customer_summary",
})
