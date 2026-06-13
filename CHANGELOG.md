# Changelog

## 0.1.2

- Simplified setup so customers only configure Cloptima credentials and attribution, with one advanced domain override for non-production environments.
- Clarified OTLP delivery as a supported way to send OpenTelemetry-compatible telemetry to Cloptima.
- Added clearer examples and onboarding guidance for both standard SDK delivery and OTLP delivery to Cloptima.

## 0.1.0

- Initial public beta release of the Cloptima JavaScript LLM observability SDK.
- Added `initFromEnv()` for environment-based setup and disabled pass-through behavior when the SDK is not configured.
- Added `observeCall(...)` and `observeStreamCall(...)` for instrumenting application-level LLM calls.
- Added `createInstrumentedFetch(...)` and `instrumentFetchLLMUsage(...)` for shared fetch integrations.
- Added payload preview and validation helpers for local testing and CI checks.
- Added OTLP preview support and example integrations.
