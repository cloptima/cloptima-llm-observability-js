import {
  createInstrumentedFetch,
  initFromEnv,
} from "@cloptima/llm-observability"

const INGEST_URL = "https://sdk-ingest.example.cloptima.ai/sdk/events"

let sawTelemetry = false
const client = initFromEnv({
  env: {
    CLOPTIMA_LLM_OBSERVABILITY_INGEST_URL: INGEST_URL,
    CLOPTIMA_LLM_OBSERVABILITY_API_KEY: "cloptima_pat_example",
    CLOPTIMA_LLM_OBSERVABILITY_APP_ID: "support-api",
    CLOPTIMA_LLM_OBSERVABILITY_ENVIRONMENT: "dev",
  },
  fetchImpl: async (_url, init) => {
    const payload = JSON.parse(String(init.body))
    sawTelemetry = payload.metadata.integration_mode === "shared_fetch"
    return new Response("{}", { status: 202 })
  },
})

const fetchWithUsage = createInstrumentedFetch(client, {
  provider: "openai",
  model: "gpt-4o-mini",
  metadata: {
    integration_mode: "shared_fetch",
  },
  fireAndForget: false,
  fetchImpl: async () => new Response(JSON.stringify({
    id: "chatcmpl-fetch-wrapper-example",
    model: "gpt-4o-mini",
    usage: {
      prompt_tokens: 5,
      completion_tokens: 2,
      total_tokens: 7,
    },
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }),
})

await fetchWithUsage("https://api.openai.com/v1/chat/completions", { method: "POST" })
if (!sawTelemetry) {
  throw new Error("telemetry was not emitted")
}
