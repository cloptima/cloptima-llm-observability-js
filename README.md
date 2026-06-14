# Cloptima LLM Observability JS SDK

Capture LLM usage telemetry from your application and send it to Cloptima for cost reporting, attribution, and analytics.

This SDK is designed for teams that want observability without replacing their existing provider clients, wrappers, retries, auth, or application security controls.

## Install

```bash
npm install @cloptima/llm-observability
```

## Quick start

Required configuration:

- `CLOPTIMA_LLM_OBSERVABILITY_API_KEY`
- `CLOPTIMA_LLM_OBSERVABILITY_APP_ID`

Recommended while testing:

- `CLOPTIMA_LLM_OBSERVABILITY_ENVIRONMENT=dev`

```ts
import { extractOpenAIUsage, initFromEnv } from "@cloptima/llm-observability";

const cloptima = initFromEnv();

const result = await cloptima.observeCall({
  provider: "openai",
  model: "gpt-4.1-mini",
  call: () => summaryService.generate(prompt),
  extractUsage: extractOpenAIUsage,
  featureId: "summary_generation",
  workflowId: "support_agent",
  fireAndForget: false,
});
```

By default, the SDK sends bearer-authenticated HTTPS requests to Cloptima at `https://api.cloptima.ai/v1/ai/integrations/sdk/events`.

If the required configuration is missing, `initFromEnv()` returns a disabled pass-through client so local development and tests do not break.

## Choose your integration path

### Call-site or wrapper boundary

This is the default path for most teams.

Use it when you already know the provider, model, and business context at the point where your code calls an LLM or an existing AI wrapper.

- `observeCall(...)` for direct integration
- `createObservedCall(...)` for reusable wrappers
- `wrapObservedService(...)` to instrument customer-owned service classes

```ts
import {
  extractOpenAIUsage,
  initFromEnv,
  wrapObservedService,
} from "@cloptima/llm-observability";

class SummaryService {
  async generateSummary(prompt: string) {
    return openai.responses.create({ model: "gpt-4.1-mini", input: prompt });
  }
}

const cloptima = initFromEnv();
const summaryService = wrapObservedService(cloptima, new SummaryService(), {
  generateSummary: {
    kind: "call",
    options: {
      provider: "openai",
      model: "gpt-4.1-mini",
      extractUsage: extractOpenAIUsage,
      fireAndForget: false,
    },
    resolveOverrides: () => ({
      attribution: {
        featureId: "summary_generation",
      },
    }),
  },
});
```

### Context-first attribution

Use context helpers when you want workflow or feature attribution to apply across nested calls without threading more parameters through your own service signatures.

- `runWithAttribution(...)`
- `withWorkflow(...)`
- `withTask(...)`

```ts
await cloptima.withWorkflow("support_agent", async () => {
  await cloptima.withTask("draft_reply", async () => {
    await summaryService.generateSummary(prompt);
  }, { teamId: "customer-support" });
}, { tenantId: "acme-prod" });
```

Per-call attribution still works and overrides context when needed.

### Shared transport integration

If your application centralizes outbound LLM calls behind `fetch`, instrument that shared boundary:

```ts
import { createInstrumentedFetch, initFromEnv } from "@cloptima/llm-observability";

const cloptima = initFromEnv();

const fetchWithUsage = createInstrumentedFetch(cloptima, {
  provider: "openai",
  model: "gpt-4o-mini",
  fireAndForget: false,
});
```

This gives broad coverage, but it has less business context than call-site or wrapper-boundary integration.

### OTLP delivery to Cloptima

Use `otlp_http` when your enterprise prefers OpenTelemetry-compatible payloads but still wants to send that telemetry to Cloptima.

- `cloptima_http` is the default delivery mode
- `otlp_http` sends OpenTelemetry-compatible payloads to Cloptima's OTLP receiver

```bash
CLOPTIMA_LLM_OBSERVABILITY_DELIVERY_MODE=otlp_http
CLOPTIMA_LLM_OBSERVABILITY_OTLP_SERVICE_NAME=agent-api
CLOPTIMA_LLM_OBSERVABILITY_OTLP_SERVICE_VERSION=2026.06.14
```

If you already operate an OTEL collector and emit GenAI spans, you can also send OTLP data to Cloptima without using this SDK. Use the SDK OTLP mode when you want application-managed instrumentation that still fits an OTLP-shaped delivery contract.

## Built-in extractors and compatibility

Built-in usage extractors cover:

- OpenAI
- Azure OpenAI
- Anthropic
- Gemini
- Vertex AI
- Bedrock

If a provider response shape drifts, you do not need to replace the whole extractor path. Compose or patch it instead:

- `tryExtractUsage(...)`
- `composeUsageExtractors(...)`
- `withUsageOverrides(...)`
- `createMappedUsageExtractor(...)`
- `listSupportedProviders()`

## Attribution fields

Common ownership and reporting fields:

- `appId`
- `environment`
- `teamId`
- `featureId`
- `workflowId`
- `costCenter`
- `businessUnit`
- `product`
- `tenantId`
- `endCustomerId`
- `customerSegment`
- `release`

Set defaults once in `defaultAttribution`, set them in context, or override them per call.

## Metadata and privacy

Use `metadataPrivacy` to control how custom metadata is retained:

- `metadata_only`
- `allowlisted_metadata`
- `strict_finops`
- `debug_observability`

Sensitive-looking keys such as prompts, messages, credentials, and secrets are treated conservatively by default.

## Validation and local previews

Use these helpers in local tests, CI, or rollout checks:

- `previewEventPayload(...)`
- `previewBatchPayload(...)`
- `previewOtlpRequest(...)`
- `validatePayload(...)`

They build or validate payloads in memory and do not send network traffic.

## Examples

Public examples live in `examples/`:

- `basic.mjs`: direct call-site integration
- `custom-wrapper.mjs`: existing service wrapper integration
- `workflow-context.mjs`: context-first attribution without signature bloat
- `fetch-wrapper.mjs`: shared `fetch` integration
- `otlp-basic.mjs`: OTLP-compatible delivery to Cloptima
- `openai-basic.mjs`, `anthropic-basic.mjs`, `gemini-basic.mjs`: provider-specific extractor examples

## Troubleshooting

No telemetry arrives:

- verify the API key is valid for Cloptima telemetry ingestion
- check `client.isEnabled()`
- inspect a sample event with `validatePayload(previewEventPayload(...))`

Unexpected provider response shape:

- start with the closest built-in extractor
- patch field differences with `withUsageOverrides(...)` or `createMappedUsageExtractor(...)`
- compare against `listSupportedProviders()` if you need a supported-provider snapshot

## Support

- Issues: `https://github.com/cloptima/cloptima-llm-observability-js/issues`
- Security: see `SECURITY.md`
- Product support: `hello@cloptima.ai`
