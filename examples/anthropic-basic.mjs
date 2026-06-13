import {
  extractAnthropicUsage,
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
    if (payload.provider !== "anthropic" || payload.model !== "claude-3-5-sonnet") {
      throw new Error("unexpected telemetry payload")
    }
    return new Response("{}", { status: 202 })
  },
})

await client.observeCall({
  provider: "anthropic",
  model: "claude-3-5-sonnet",
  call: () => ({
    id: "msg_anthropic_example",
    model: "claude-3-5-sonnet",
    usage: {
      input_tokens: 8,
      output_tokens: 4,
    },
  }),
  extractUsage: extractAnthropicUsage,
  fireAndForget: false,
  featureId: "agent_reply",
})
