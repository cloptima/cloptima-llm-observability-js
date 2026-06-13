# Cloptima LLM Observability JS SDK

Capture LLM usage telemetry from your application and send it to Cloptima for cost reporting, attribution, and analytics.

Use this SDK when you want visibility into LLM usage without replacing your existing provider clients, retry policies, authentication, or application-level security controls.

## Install

```bash
npm install @cloptima/llm-observability
```

## Configuration

Required environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `CLOPTIMA_LLM_OBSERVABILITY_INGEST_URL` | Yes | HTTPS endpoint for SDK event ingestion |
| `CLOPTIMA_LLM_OBSERVABILITY_API_KEY` | Yes | Cloptima API key for telemetry writes |
| `CLOPTIMA_LLM_OBSERVABILITY_APP_ID` | Yes | Application or service identifier |
| `CLOPTIMA_LLM_OBSERVABILITY_ENVIRONMENT` | Yes | Deployment environment such as `dev`, `staging`, or `prod` |
| `CLOPTIMA_LLM_OBSERVABILITY_TEAM_ID` | No | Team or ownership group |
| `CLOPTIMA_LLM_OBSERVABILITY_ENABLED` | No | Explicitly enable or disable the SDK |
| `CLOPTIMA_LLM_OBSERVABILITY_DELIVERY_MODE` | No | `cloptima_http`, `otlp_http`, or `dual` |
| `CLOPTIMA_LLM_OBSERVABILITY_OTLP_URL` | No | Custom OTLP endpoint |
| `CLOPTIMA_LLM_OBSERVABILITY_OTLP_SERVICE_NAME` | No | OTLP service name |
| `CLOPTIMA_LLM_OBSERVABILITY_OTLP_SERVICE_VERSION` | No | OTLP service version |

The SDK sends bearer-authenticated HTTPS requests to the configured Cloptima ingest endpoint.

## Quick start

Use `observeCall(...)` at the point where your application already invokes an LLM provider or an internal AI helper.

```ts
import {
  extractOpenAIUsage,
  initFromEnv,
} from "@cloptima/llm-observability";

const cloptima = initFromEnv();

const result = await cloptima.observeCall({
  provider: "openai",
  model: "gpt-4.1-mini",
  call: () => summaryService.generate(prompt),
  extractUsage: extractOpenAIUsage,
  featureId: "summaries",
  workflowId: "support-agent",
  teamId: "customer-support",
  fireAndForget: false,
});
```

This integration style works well because it:

- keeps your existing provider integration intact
- captures the most accurate model and feature context
- avoids SDK-specific coupling throughout your codebase
- works well with existing wrappers and shared AI services

## Async and streaming calls

If your application already works with async responses or streaming, use the matching async primitives directly:

```ts
const response = await cloptima.observeCall({
  provider: "anthropic",
  model: "claude-3-5-sonnet",
  call: () => assistantClient.reply(messages),
  featureId: "chat_reply",
});

for await (const chunk of cloptima.observeStreamCall({
  provider: "openai",
  model: "gpt-4.1-mini",
  call: () => streamClient.stream(prompt),
  featureId: "live_answer",
})) {
  process.stdout.write(JSON.stringify(chunk));
}
```

## Shared fetch integration

If your application centralizes outbound LLM calls behind a shared `fetch` layer, instrument that boundary instead:

```ts
import {
  createInstrumentedFetch,
  initFromEnv,
} from "@cloptima/llm-observability";

const cloptima = initFromEnv();

const fetchWithUsage = createInstrumentedFetch(cloptima, {
  provider: "openai",
  model: "gpt-4o-mini",
  fireAndForget: false,
  metadata: { integration_mode: "shared_fetch" },
});
```

This is useful for broad coverage, but it has less application context than `observeCall(...)`. Prefer the boundary helper when you already know the provider, model, and feature at the call site.

## OTLP mode

The SDK supports three delivery modes:

- `cloptima_http`
- `otlp_http`
- `dual`

Use `otlp_http` or `dual` when you want OpenTelemetry-compatible output in addition to, or instead of, direct Cloptima delivery.

## Attribution fields

The most useful fields for reporting and ownership are:

- `appId`
- `environment`
- `teamId`
- `featureId`
- `workflowId`
- `costCenter`
- `businessUnit`
- `tenantId`
- `customerSegment`
- `cloudAccountId`
- `clusterId`
- `repositoryId`

You can pass them through `defaultAttribution`, or directly on `observeCall(...)` / `observeStreamCall(...)`.

## Metadata controls

Use `metadataPrivacy` to control what custom metadata is retained:

- `metadata_only`
- `allowlisted_metadata`
- `strict_finops`
- `debug_observability`

Sensitive-looking keys such as prompts, messages, credentials, and secrets are treated conservatively by default.

## Validation helpers

These helpers are useful when you want to inspect payloads locally before sending traffic to Cloptima:

- `previewEventPayload(...)`
- `previewBatchPayload(...)`
- `previewOtlpRequest(...)`
- `validatePayload(...)`

They return payload previews in memory and do not send network traffic.

## Examples

See the `examples/` directory for:

- OpenAI boundary instrumentation
- Anthropic boundary instrumentation
- Gemini boundary instrumentation
- custom wrapper instrumentation
- fetch wrapper instrumentation

## Public API

Stable core surface:

- `CloptimaLLMObservability`
- `initFromEnv`
- `disabledClient`
- `observe`
- `observeCall`
- `observeStream`
- `observeStreamCall`
- `record`
- `recordBatch`
- `recordAsync`
- provider usage extractors

Additional helper surface:

- `instrumentFetchLLMUsage`
- `createInstrumentedFetch`
- `instrumentOpenAICompatibleResponse`
- `instrumentOpenAICompatibleStream`
- `instrumentExpressRequestContext`
- `instrumentNextJsRouteContext`

## Troubleshooting

No telemetry arrives:

- verify `CLOPTIMA_LLM_OBSERVABILITY_INGEST_URL`
- verify the API key is valid for SDK event ingestion
- check `client.isEnabled()`
- inspect a sample event with `validatePayload(previewEventPayload(...))`

Configuration behavior:

- `initFromEnv()` returns a disabled pass-through client when configuration is absent
- if you explicitly enable the SDK with incomplete config, initialization stays non-blocking by default unless `strict` is set

## Payload contracts

- single event schema: `cloptima.llm.event.v1`
- batch schema: `cloptima.llm.batch.v1`

SDK envelopes also include `sdk_delivery_stats` for delivery monitoring.

## Support

- Issues: `https://github.com/cloptima/cloptima-llm-observability-js/issues`
- Security: see `SECURITY.md`
- Product support: `hello@cloptima.ai`
