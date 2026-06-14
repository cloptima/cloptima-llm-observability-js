import {
  extractOpenAIUsage,
  initFromEnv,
  wrapObservedService,
} from "@cloptima/llm-observability"

class DraftingService {
  async draftReply(prompt) {
    return {
      id: "chatcmpl-workflow-context",
      model: "gpt-4.1-mini",
      input: prompt,
      usage: {
        prompt_tokens: 18,
        completion_tokens: 9,
        total_tokens: 27,
      },
    }
  }
}

let sawWorkflow = false
const client = initFromEnv({
  env: {
    CLOPTIMA_LLM_OBSERVABILITY_API_KEY: "cloptima_pat_example",
    CLOPTIMA_LLM_OBSERVABILITY_APP_ID: "support-api",
    CLOPTIMA_LLM_OBSERVABILITY_ENVIRONMENT: "dev",
  },
  fetchImpl: async (_url, init) => {
    const payload = JSON.parse(String(init.body))
    sawWorkflow = payload.metadata?.workflow_id === "support_agent" && payload.metadata?.feature_id === "draft_reply"
    return new Response("{}", { status: 202 })
  },
})

const draftingService = wrapObservedService(client, new DraftingService(), {
  draftReply: {
    kind: "call",
    options: {
      provider: "openai",
      model: "gpt-4.1-mini",
      extractUsage: extractOpenAIUsage,
      fireAndForget: false,
    },
  },
})

await client.withWorkflow("support_agent", async () => {
  await client.withTask("draft_reply", async () => {
    await draftingService.draftReply("Draft a calm response to the customer.")
  }, { teamId: "customer-support" })
}, { tenantId: "acme-prod" })

if (!sawWorkflow) {
  throw new Error("workflow context was not emitted")
}
