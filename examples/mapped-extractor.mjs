import {
  createMappedUsageExtractor,
  initFromEnv,
} from "@cloptima/llm-observability"

const client = initFromEnv({
  env: {
    CLOPTIMA_LLM_OBSERVABILITY_API_KEY: "cloptima_pat_example",
    CLOPTIMA_LLM_OBSERVABILITY_APP_ID: "creative-api",
    CLOPTIMA_LLM_OBSERVABILITY_ENVIRONMENT: "dev",
  },
  fetchImpl: async (url, init) => {
    const payload = JSON.parse(String(init.body))
    if (String(url) !== "https://api.cloptima.ai/v1/ai/integrations/sdk/events") {
      throw new Error("unexpected telemetry endpoint")
    }
    if (payload.provider !== "vertex_ai" || payload.model !== "gemini-2.5-flash-image-preview") {
      throw new Error("unexpected provider mapping")
    }
    if (payload.provider_request_id !== "vertex-custom-1") {
      throw new Error("expected provider request id from mapped payload")
    }
    if (payload.vendor_reported_cost_usd !== 0.0842) {
      throw new Error("expected provider-reported cost to be preserved")
    }
    if (JSON.stringify(payload.extra_usage_units) !== JSON.stringify({ output_image: 96 })) {
      throw new Error("expected mapped multimodal usage units")
    }
    return new Response("{}", { status: 202 })
  },
})

const extractUsage = createMappedUsageExtractor({
  defaults: {
    provider: "vertex_ai",
  },
  fields: {
    providerRequestId: "response.id",
    model: "response.modelVersion",
    vendorReportedCostUsd: "billing.costUsd",
  },
  numberFields: {
    inputTokens: "usage.promptTokenCount",
    outputTokens: "usage.responseTokenCount",
    totalTokens: "usage.totalTokenCount",
  },
  extraUsageUnits: {
    output_image: "usage.outputImageTokenCount",
  },
  metadata: {
    provider_region: "response.region",
  },
})

await client.observeCall({
  provider: "vertex_ai",
  model: "gemini-2.5-flash-image-preview",
  call: () => ({
    response: {
      id: "vertex-custom-1",
      modelVersion: "gemini-2.5-flash-image-preview",
      region: "us-central1",
    },
    usage: {
      promptTokenCount: 1200,
      responseTokenCount: 96,
      totalTokenCount: 1296,
      outputImageTokenCount: 96,
    },
    billing: {
      costUsd: "0.0842",
    },
  }),
  extractUsage,
  fireAndForget: false,
  workflowId: "creative_asset_pipeline",
  featureId: "thumbnail_generation",
})

await client.flush()
