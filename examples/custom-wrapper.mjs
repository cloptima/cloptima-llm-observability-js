import {
  extractOpenAIUsage,
  initFromEnv,
} from "@cloptima/llm-observability"

const INGEST_URL = "https://sdk-ingest.example.cloptima.ai/sdk/events"

class SummaryService {
  generateSummary() {
    return {
      id: "chatcmpl-wrapper-example",
      model: "gpt-4.1-mini",
      usage: {
        prompt_tokens: 12,
        completion_tokens: 7,
        total_tokens: 19,
      },
    }
  }
}

const summaryService = new SummaryService()
const cloptima = initFromEnv({
  env: {
    CLOPTIMA_LLM_OBSERVABILITY_INGEST_URL: INGEST_URL,
    CLOPTIMA_LLM_OBSERVABILITY_API_KEY: "cloptima_pat_example",
    CLOPTIMA_LLM_OBSERVABILITY_APP_ID: "support-api",
    CLOPTIMA_LLM_OBSERVABILITY_ENVIRONMENT: "dev",
  },
  fetchImpl: async (_url, init) => {
    const payload = JSON.parse(String(init.body))
    if (payload.metadata.integration_mode !== "shared_service") {
      throw new Error("unexpected integration mode")
    }
    return new Response("{}", { status: 202 })
  },
})

await cloptima.observeCall({
  provider: "openai",
  model: "gpt-4.1-mini",
  call: () => summaryService.generateSummary(),
  extractUsage: extractOpenAIUsage,
  fireAndForget: false,
  featureId: "support_summary",
  metadata: {
    integration_mode: "shared_service",
  },
})
