import {
  extractOpenAIUsage,
  initFromEnv,
} from "@cloptima/llm-observability"

const client = initFromEnv({
  env: {
    CLOPTIMA_LLM_OBSERVABILITY_API_KEY: "cloptima_pat_example",
    CLOPTIMA_LLM_OBSERVABILITY_APP_ID: "creative-api",
    CLOPTIMA_LLM_OBSERVABILITY_ENVIRONMENT: "dev",
    CLOPTIMA_LLM_OBSERVABILITY_TEAM_ID: "studio",
  },
  fetchImpl: async (url, init) => {
    const payload = JSON.parse(String(init.body))
    const units = payload.extra_usage_units || {}
    if (String(url) !== "https://api.cloptima.ai/v1/ai/integrations/sdk/events") {
      throw new Error("unexpected telemetry endpoint")
    }
    if (payload.provider !== "openai" || payload.model !== "gpt-4.1-mini") {
      throw new Error("unexpected telemetry payload")
    }
    if (
      units.input_audio !== 24 ||
      units.input_image !== 12 ||
      units.output_image !== 8 ||
      units.output_video !== 4 ||
      Object.keys(units).length !== 4
    ) {
      throw new Error("expected normalized multimodal token usage")
    }
    return new Response("{}", { status: 202 })
  },
})

await client.observeCall({
  provider: "openai",
  model: "gpt-4.1-mini",
  call: () => ({
    id: "chatcmpl-multimodal-example",
    model: "gpt-4.1-mini",
    usage: {
      prompt_tokens: 240,
      completion_tokens: 80,
      total_tokens: 320,
      prompt_tokens_details: {
        audio_tokens: 24,
        image_tokens: 12,
      },
      completion_tokens_details: {
        image_tokens: 8,
        video_tokens: 4,
      },
    },
  }),
  extractUsage: extractOpenAIUsage,
  fireAndForget: false,
  featureId: "creative_generation",
  metadata: {
    integration_mode: "multimodal_tokens",
  },
})

await client.flush()
