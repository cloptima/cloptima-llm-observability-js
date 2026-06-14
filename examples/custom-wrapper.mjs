import {
  extractOpenAIUsage,
  initFromEnv,
  wrapObservedService,
} from "@cloptima/llm-observability"

class SummaryService {
  generateSummary(prompt) {
    return {
      id: "chatcmpl-wrapper-example",
      model: "gpt-4.1-mini",
      input: prompt,
      usage: {
        prompt_tokens: 12,
        completion_tokens: 7,
        total_tokens: 19,
      },
    }
  }
}

const cloptima = initFromEnv({
  env: {
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
const summaryService = wrapObservedService(cloptima, new SummaryService(), {
  generateSummary: {
    kind: "call",
    options: {
      provider: "openai",
      model: "gpt-4.1-mini",
      extractUsage: extractOpenAIUsage,
      fireAndForget: false,
      metadata: {
        integration_mode: "shared_service",
      },
    },
    resolveOverrides: (prompt) => ({
      attribution: {
        featureId: "support_summary",
      },
      metadata: {
        prompt_length: prompt.length,
      },
    }),
  },
})

await summaryService.generateSummary("Summarize the customer thread.")
