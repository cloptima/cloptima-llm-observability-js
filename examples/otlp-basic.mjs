import {
  extractOpenAIUsage,
  initFromEnv,
} from "@cloptima/llm-observability"

const client = initFromEnv({
  env: {
    CLOPTIMA_LLM_OBSERVABILITY_API_KEY: "cloptima_pat_example",
    CLOPTIMA_LLM_OBSERVABILITY_APP_ID: "support-api",
    CLOPTIMA_LLM_OBSERVABILITY_ENVIRONMENT: "dev",
    CLOPTIMA_LLM_OBSERVABILITY_DELIVERY_MODE: "otlp_http",
  },
  fetchImpl: async (url, init) => {
    const payload = JSON.parse(String(init.body))
    const span = payload.resourceSpans?.[0]?.scopeSpans?.[0]?.spans?.[0]
    if (String(url) !== "https://api.cloptima.ai/v1/ai/integrations/otlp/traces") {
      throw new Error("unexpected OTLP endpoint")
    }
    if (!span || span.name !== "llm.openai.gpt-4.1-mini") {
      throw new Error("unexpected OTLP telemetry payload")
    }
    return new Response("{}", { status: 202 })
  },
})

await client.observeCall({
  provider: "openai",
  model: "gpt-4.1-mini",
  call: () => ({
    id: "chatcmpl-otlp-example",
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
  metadata: {
    integration_mode: "otlp_http",
  },
})

await client.flush()
