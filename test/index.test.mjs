import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const buildDir = process.env.CLOPTIMA_LLM_OBSERVABILITY_TEST_BUILD || '/tmp/cloptima-llm-observability-js-test-build';
const DEFAULT_API_BASE_URL = 'https://api.cloptima.ai';
const TEST_API_BASE_URL = 'https://sdk-ingest.example.cloptima.ai';
const DEFAULT_INGEST_URL = `${DEFAULT_API_BASE_URL}/v1/ai/integrations/sdk/events`;
const DEFAULT_OTLP_URL = `${DEFAULT_API_BASE_URL}/v1/ai/integrations/otlp/traces`;
const TEST_INGEST_URL = `${TEST_API_BASE_URL}/v1/ai/integrations/sdk/events`;
const TEST_OTLP_URL = `${TEST_API_BASE_URL}/v1/ai/integrations/otlp/traces`;
const fixtureCandidates = [
  new URL('../../llm-observability-fixtures/provider_usage_replay.json', import.meta.url),
  new URL('../llm-observability-fixtures/provider_usage_replay.json', import.meta.url),
];
const providerUsageReplayFixture = fixtureCandidates.find((candidate) => existsSync(candidate));
if (!providerUsageReplayFixture) {
  throw new Error('provider_usage_replay.json fixture not found');
}
const providerUsageReplayFixtures = JSON.parse(readFileSync(providerUsageReplayFixture, 'utf8'));
const {
  CloptimaLLMObservability,
  bindObservedCall,
  bindObservedStream,
  composeUsageExtractors,
  createMappedUsageExtractor,
  createObservedCall,
  createObservedStream,
  createInstrumentedFetch,
  disabledClient,
  DisabledCloptimaLLMObservability,
  extractAnthropicStreamUsage,
  extractAnthropicUsage,
  extractBedrockStreamUsage,
  extractAzureOpenAIUsage,
  extractBedrockUsage,
  extractGeminiStreamUsage,
  extractGeminiUsage,
  instrumentExpressRequestContext,
  instrumentFetchLLMUsage,
  instrumentNextJsRouteContext,
  instrumentOpenAICompatibleResponse,
  instrumentOpenAICompatibleStream,
  extractOpenAIUsage,
  extractOpenAIStreamUsage,
  getProviderStreamUsageExtractor,
  getProviderUsageExtractor,
  listSupportedProviders,
  previewBatchPayload,
  previewEventPayload,
  previewOtlpRequest,
  PROVIDER_SUPPORT_MATRIX,
  PROVIDER_USAGE_EXTRACTORS,
  tryExtractUsage,
  extractVertexStreamUsage,
  extractVertexUsage,
  initFromEnv,
  isEnabled,
  validatePayload,
  withTask,
  withWorkflow,
  withUsageOverrides,
} = await import(`${buildDir}/src/index.js`);

function camelExpected(expected) {
  const mapped = {
    provider: expected.provider,
    providerRequestId: expected.provider_request_id,
    model: expected.model,
    inputTokens: expected.input_tokens,
    outputTokens: expected.output_tokens,
    totalTokens: expected.total_tokens,
    reasoningTokens: expected.reasoning_tokens,
    cachedInputTokens: expected.cached_input_tokens,
    extraUsageUnits: expected.extra_usage_units,
    cacheHit: expected.cache_hit,
    latencyMs: expected.latency_ms,
  };
  return Object.fromEntries(Object.entries(mapped).filter(([, value]) => value !== undefined));
}

function extractFixtureUsage(fixture) {
  if (fixture.provider === 'openai' && fixture.kind === 'stream') return extractOpenAIStreamUsage(fixture.payload);
  if (fixture.provider === 'openai') return extractOpenAIUsage(fixture.payload);
  if (fixture.provider === 'azure_openai') return extractAzureOpenAIUsage(fixture.payload);
  if (fixture.provider === 'anthropic' && fixture.kind === 'stream') return extractAnthropicStreamUsage(fixture.payload);
  if (fixture.provider === 'anthropic') return extractAnthropicUsage(fixture.payload);
  if (fixture.provider === 'gemini' && fixture.kind === 'stream') return extractGeminiStreamUsage(fixture.payload);
  if (fixture.provider === 'gemini') return extractGeminiUsage(fixture.payload);
  if (fixture.provider === 'vertex_ai' && fixture.kind === 'stream') return extractVertexStreamUsage(fixture.payload);
  if (fixture.provider === 'vertex_ai') return extractVertexUsage(fixture.payload);
  if (fixture.provider === 'bedrock' && fixture.kind === 'stream') return extractBedrockStreamUsage(fixture.payload);
  if (fixture.provider === 'bedrock') return extractBedrockUsage(fixture.payload);
  throw new Error(`unsupported fixture ${fixture.name}`);
}

function stripUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== undefined));
}

test('initFromEnv returns a silent disabled client when not configured', async () => {
  const client = initFromEnv({ env: {}, strict: true });

  assert.ok(client instanceof DisabledCloptimaLLMObservability);
  assert.equal(client.isEnabled(), false);
  assert.equal(isEnabled({ env: {} }), false);
  assert.equal(await client.observeCall({
    provider: 'openai',
    model: 'gpt-4o-mini',
    call: () => 'passthrough-result',
    featureId: 'summaries',
  }), 'passthrough-result');
});

test('entrypoint avoids a static node async_hooks import for broader runtime compatibility', () => {
  const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  const built = readFileSync(`${buildDir}/src/index.js`, 'utf8');

  assert.doesNotMatch(source, /import\s+\{\s*AsyncLocalStorage\s*\}\s+from\s+['"]node:async_hooks['"]/);
  assert.doesNotMatch(built, /import\s+\{\s*AsyncLocalStorage\s*\}\s+from\s+['"]node:async_hooks['"]/);
  assert.match(built, /StackAttributionContextStorage/);
});

test('initFromEnv can build a configured client from env', async () => {
  let body;
  const client = initFromEnv({
    env: {
      CLOPTIMA_LLM_OBSERVABILITY_API_BASE_URL: TEST_API_BASE_URL,
      CLOPTIMA_LLM_OBSERVABILITY_API_KEY: 'pat-env',
      CLOPTIMA_LLM_OBSERVABILITY_APP_ID: 'agent-api',
      CLOPTIMA_LLM_OBSERVABILITY_ENVIRONMENT: 'prod',
      CLOPTIMA_LLM_OBSERVABILITY_TEAM_ID: 'platform',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  assert.equal(client.isEnabled(), true);
  assert.equal(isEnabled({
    env: {
      CLOPTIMA_LLM_OBSERVABILITY_API_BASE_URL: TEST_API_BASE_URL,
      CLOPTIMA_LLM_OBSERVABILITY_API_KEY: 'pat-env',
      CLOPTIMA_LLM_OBSERVABILITY_APP_ID: 'agent-api',
      CLOPTIMA_LLM_OBSERVABILITY_ENVIRONMENT: 'prod',
    },
  }), true);

  await client.record({
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputTokens: 4,
  });

  assert.equal(body.metadata.app_id, 'agent-api');
  assert.equal(body.metadata.environment, 'prod');
  assert.equal(body.metadata.team_id, 'platform');
});

test('initFromEnv uses default ingest URL and production environment when omitted', async () => {
  let observedInput;
  let body;
  const client = initFromEnv({
    env: {
      CLOPTIMA_LLM_OBSERVABILITY_API_KEY: 'pat-env',
      CLOPTIMA_LLM_OBSERVABILITY_APP_ID: 'agent-api',
    },
    fetchImpl: async (input, init) => {
      observedInput = String(input);
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  assert.equal(client.isEnabled(), true);
  assert.equal(isEnabled({
    env: {
      CLOPTIMA_LLM_OBSERVABILITY_API_KEY: 'pat-env',
      CLOPTIMA_LLM_OBSERVABILITY_APP_ID: 'agent-api',
    },
  }), true);

  await client.record({
    provider: 'openai',
    model: 'gpt-4o-mini',
  });

  assert.equal(observedInput, DEFAULT_INGEST_URL);
  assert.equal(body.metadata.environment, 'production');
});

test('isEnabled requires api key and app id only', () => {
  assert.equal(isEnabled({
    env: {
      CLOPTIMA_LLM_OBSERVABILITY_APP_ID: 'agent-api',
    },
  }), false);
  assert.equal(isEnabled({
    env: {
      CLOPTIMA_LLM_OBSERVABILITY_API_KEY: 'pat-env',
    },
  }), false);
  assert.equal(isEnabled({
    env: {
      CLOPTIMA_LLM_OBSERVABILITY_API_KEY: 'pat-env',
      CLOPTIMA_LLM_OBSERVABILITY_APP_ID: 'agent-api',
    },
  }), true);
});

test('direct constructor derives the default OTLP URL from the default ingest URL', async () => {
  const observed = [];
  const client = new CloptimaLLMObservability({
    apiKey: 'pat-env',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'production',
    },
    deliveryMode: 'otlp_http',
    fetchImpl: async (input) => {
      observed.push(String(input));
      return new Response('{}', { status: 202 });
    },
  });

  await client.record({
    provider: 'openai',
    model: 'gpt-4o-mini',
  });

  assert.deepEqual(observed, [DEFAULT_OTLP_URL]);
});

test('direct constructor rejects the dormant dual delivery mode', () => {
  assert.throws(
    () => new CloptimaLLMObservability({
      apiKey: 'pat-env',
      defaultAttribution: {
        appId: 'agent-api',
        environment: 'production',
      },
      deliveryMode: 'dual',
    }),
    /temporarily disabled/,
  );
});

test('initFromEnv stays fail-open but diagnosable when explicitly enabled and misconfigured', async () => {
  const errors = [];
  const client = initFromEnv({
    env: {
      CLOPTIMA_LLM_OBSERVABILITY_ENABLED: 'true',
      CLOPTIMA_LLM_OBSERVABILITY_APP_ID: 'agent-api',
    },
    onInitError: (error) => errors.push(error.message),
  });

  assert.equal(client.isEnabled(), false);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /missing required configuration/i);
  assert.match(errors[0], /API_KEY/i);
  assert.match(client.getInitError()?.message || '', /missing required configuration/i);
});

test('disabledClient can be created directly', () => {
  const client = disabledClient(new Error('disabled'));

  assert.equal(client.isEnabled(), false);
  assert.equal(client.getInitError()?.message, 'disabled');
  assert.deepEqual(client.stats(), {
    queuedEvents: 0,
    droppedEvents: 0,
    deliveredEvents: 0,
    failedBatches: 0,
  });
});

test('disabledClient observeStreamCall passes through stream chunks without buffering side effects', async () => {
  const client = disabledClient();
  const observed = [];

  async function* source() {
    yield 'chunk-1';
    yield 'chunk-2';
  }

  for await (const chunk of client.observeStreamCall({
    provider: 'openai',
    model: 'gpt-4o-mini',
    call: () => source(),
  })) {
    observed.push(chunk);
  }

  assert.deepEqual(observed, ['chunk-1', 'chunk-2']);
});

test('record posts canonical SDK telemetry to Cloptima ingest', async () => {
  let observed;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    sdkVersion: '0.1.0',
    defaultAttribution: {
      teamId: 'platform',
      appId: 'checkout-api',
      environment: 'prod',
      businessUnit: 'revenue',
      costCenter: 'cc-checkout',
      product: 'checkout',
      customerSegment: 'enterprise',
      endCustomerId: 'acct-1',
      tenantId: 'tenant-1',
      release: '2026.05.1',
      actorId: 'svc-checkout',
      actorType: 'service',
    },
    fetchImpl: async (input, init) => {
      observed = { input, init };
      return new Response(JSON.stringify({ accepted: true }), { status: 202 });
    },
  });

  await client.record({
    provider: 'openai',
    model: 'gpt-4o-mini',
    sourceEventId: 'event-1',
    requestId: 'request-1',
    inputTokens: 10,
    outputTokens: 5,
    agentSessionId: 'agent-session-1',
    toolName: 'ticket_search',
    retryIndex: 1,
    metadata: { route: '/support' },
  });

  assert.equal(observed?.input, TEST_INGEST_URL);
  assert.equal(observed?.init?.method, 'POST');
  assert.equal(observed?.init?.headers.authorization, 'Bearer pat-test');
  const body = JSON.parse(String(observed?.init?.body));
  assert.equal(body.sdk_name, '@cloptima/llm-observability');
  assert.equal(body.sdk_version, '0.1.0');
  assert.equal(body.provider, 'openai');
  assert.equal(body.model, 'gpt-4o-mini');
  assert.equal(body.input_tokens, 10);
  assert.equal(body.output_tokens, 5);
  assert.equal(body.total_tokens, 15);
  assert.equal(body.metadata.team_id, 'platform');
  assert.equal(body.metadata.app_id, 'checkout-api');
  assert.equal(body.metadata.business_unit, 'revenue');
  assert.equal(body.metadata.cost_center, 'cc-checkout');
  assert.equal(body.metadata.product, 'checkout');
  assert.equal(body.metadata.customer_segment, 'enterprise');
  assert.equal(body.metadata.end_customer_id, 'acct-1');
  assert.equal(body.metadata.tenant_id, 'tenant-1');
  assert.equal(body.metadata.release, '2026.05.1');
  assert.equal(body.metadata.agent_session_id, 'agent-session-1');
  assert.equal(body.metadata.tool_name, 'ticket_search');
  assert.equal(body.metadata.retry_index, 1);
  assert.equal(body.metadata.route, '/support');
});

test('record derives source event ids from existing identifiers or generates one', async () => {
  const bodies = [];
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response('{}', { status: 202 });
    },
  });

  await client.record({
    provider: 'openai',
    model: 'gpt-4o-mini',
    requestId: 'request-derive-1',
  });
  await client.record({
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
  });

  assert.equal(bodies[0].schema_version, 'cloptima.llm.event.v1');
  assert.equal(bodies[0].sdk_delivery_stats.delivered_events, 0);
  assert.equal(bodies[0].source_event_id, 'request-derive-1');
  assert.equal(typeof bodies[1].source_event_id, 'string');
  assert.match(bodies[1].source_event_id, /^clop_evt_/);
});

test('recordBatch posts multiple events in one SDK ingest request', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  await client.recordBatch([
    { provider: 'openai', model: 'gpt-4o-mini', sourceEventId: 'event-1', inputTokens: 1 },
    { provider: 'anthropic', model: 'claude-3-5-sonnet', sourceEventId: 'event-2', outputTokens: 2 },
  ]);

  assert.equal(body.schema_version, 'cloptima.llm.batch.v1');
  assert.equal(body.batch_schema_version, 'cloptima.llm.batch.v1');
  assert.equal(body.sdk_delivery_stats.delivered_events, 0);
  assert.deepEqual(body.events.map((event) => event.source_event_id), ['event-1', 'event-2']);
  assert.equal(body.events[0].schema_version, 'cloptima.llm.event.v1');
  assert.equal(body.events[0].metadata.app_id, 'agent-api');
  assert.equal(body.events[1].metadata.environment, 'dev');
});

test('preview helpers build sanitized payloads and OTLP dry-run requests', () => {
  const payload = previewEventPayload({
    provider: 'openai',
    model: 'gpt-4o-mini',
    requestId: 'req-preview-1',
    metadata: {
      route: '/chat',
      prompt: 'secret prompt',
    },
  }, {
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
      teamId: 'platform',
    },
    metadataPrivacy: {
      mode: 'allowlisted_metadata',
      allowlistKeys: ['route'],
    },
    sdkVersion: '0.1.0',
  });

  const validation = validatePayload(payload);
  const otlp = previewOtlpRequest(payload, {
    sdkVersion: '0.1.0',
    serviceName: 'agent-api',
  });

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  assert.equal(payload.schema_version, 'cloptima.llm.event.v1');
  assert.equal(payload.metadata.app_id, 'agent-api');
  assert.equal(payload.metadata.route, '/chat');
  assert.equal(payload.metadata.prompt, undefined);
  assert.equal(otlp.resourceSpans[0].resource.attributes[0].value.stringValue, 'agent-api');
  assert.equal(otlp.resourceSpans[0].scopeSpans[0].spans[0].name, 'llm.openai.gpt-4o-mini');

  const batchPayload = previewBatchPayload([
    { provider: 'openai', model: 'gpt-4o-mini', sourceEventId: 'evt-1' },
    { provider: 'anthropic', model: 'claude-3-5-sonnet', sourceEventId: 'evt-2' },
  ], {
    defaultAttribution: { appId: 'agent-api', environment: 'dev' },
  });

  assert.equal(batchPayload.schema_version, 'cloptima.llm.batch.v1');
  assert.deepEqual(batchPayload.events.map((event) => event.source_event_id), ['evt-1', 'evt-2']);
});

test('validatePayload reports malformed event and batch payloads', () => {
  const invalid = validatePayload({
    schema_version: 'wrong',
    sdk_name: '',
    provider: '',
    model: '',
    metadata: 'bad',
    status: 'maybe',
    input_tokens: -1,
  });

  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes('schema_version')));
  assert.ok(invalid.errors.some((error) => error.includes('sdk_name')));
  assert.ok(invalid.errors.some((error) => error.includes('metadata')));

  const invalidBatch = validatePayload({
    schema_version: 'wrong-batch',
    events: ['bad-event'],
  });

  assert.equal(invalidBatch.valid, false);
  assert.ok(invalidBatch.errors.some((error) => error.includes('batch.schema_version')));
  assert.ok(invalidBatch.errors.some((error) => error.includes('events[0] must be an object')));
});

test('record posts OTLP JSON spans when otlp delivery mode is enabled', async () => {
  let observed;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    sdkVersion: '0.1.0',
    deliveryMode: 'otlp_http',
    otlpServiceName: 'checkout-api',
    otlpServiceVersion: '2026.06.1',
    defaultAttribution: {
      teamId: 'platform',
      appId: 'checkout-api',
      featureId: 'support-agent',
      environment: 'prod',
    },
    fetchImpl: async (input, init) => {
      observed = { input, init };
      return new Response('{}', { status: 202 });
    },
  });

  await client.record({
    provider: 'openai',
    model: 'gpt-4o-mini',
    sourceEventId: 'event-otlp-1',
    requestId: 'request-otlp-1',
    providerRequestId: 'chatcmpl-otlp-1',
    inputTokens: 10,
    outputTokens: 5,
    vendorReportedCostUsd: '0.0123',
    cacheHit: true,
  });

  assert.equal(observed?.input, TEST_OTLP_URL);
  const body = JSON.parse(String(observed?.init?.body));
  assert.equal(body.resourceSpans[0].resource.attributes[0].value.stringValue, 'checkout-api');
  assert.equal(body.resourceSpans[0].resource.attributes[1].value.stringValue, '2026.06.1');
  assert.equal(body.resourceSpans[0].scopeSpans[0].scope.name, '@cloptima/llm-observability');
  assert.equal(body.resourceSpans[0].scopeSpans[0].scope.version, '0.1.0');
  const span = body.resourceSpans[0].scopeSpans[0].spans[0];
  assert.equal(span.name, 'llm.openai.gpt-4o-mini');
  const attrs = Object.fromEntries(span.attributes.map((attribute) => [attribute.key, attribute.value]));
  assert.equal(attrs['gen_ai.system'].stringValue, 'openai');
  assert.equal(attrs['gen_ai.request.model'].stringValue, 'gpt-4o-mini');
  assert.equal(attrs['gen_ai.request.id'].stringValue, 'request-otlp-1');
  assert.equal(attrs['gen_ai.response.id'].stringValue, 'chatcmpl-otlp-1');
  assert.equal(attrs.source_event_id.stringValue, 'event-otlp-1');
  assert.equal(attrs['gen_ai.usage.input_tokens'].intValue, 10);
  assert.equal(attrs['gen_ai.usage.output_tokens'].intValue, 5);
  assert.equal(attrs['gen_ai.usage.total_tokens'].intValue, 15);
  assert.equal(attrs['gen_ai.usage.cost'].doubleValue, 0.0123);
  assert.equal(attrs.cache_hit.boolValue, true);
  assert.equal(attrs.team_id.stringValue, 'platform');
  assert.equal(attrs.app_id.stringValue, 'checkout-api');
  assert.equal(attrs.feature_id.stringValue, 'support-agent');
  assert.equal(attrs.environment.stringValue, 'prod');
});

test('record does not leak Cloptima authorization headers to non-Cloptima OTLP hosts', async () => {
  let observed;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: 'http://127.0.0.1:4318',
    apiKey: 'pat-test',
    deliveryMode: 'otlp_http',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (input, init) => {
      observed = { input, init };
      return new Response('{}', { status: 202 });
    },
  });

  await client.record({
    provider: 'openai',
    model: 'gpt-4o-mini',
    sourceEventId: 'event-otlp-local-1',
  });

  assert.equal(observed?.input, 'http://127.0.0.1:4318/v1/ai/integrations/otlp/traces');
  assert.equal(observed?.init?.headers.authorization, undefined);
});

test('record applies metadata privacy rules before ingest', async () => {
  let body;
  const drops = [];
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    metadataPrivacy: {
      mode: 'metadata_only',
      hashKeys: ['session_id'],
      maxValueLength: 8,
      onMetadataDrop: (info) => drops.push(info),
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  await client.record({
    provider: 'openai',
    model: 'gpt-4o-mini',
    metadata: {
      prompt: 'top secret prompt text',
      session_id: 'session-123',
      note: 'abcdefghijklmno',
      nested: { path: '/chat' },
    },
  });

  assert.equal(body.metadata.prompt, '[redacted]');
  assert.match(body.metadata.session_id, /^hash_/);
  assert.equal(body.metadata.note, 'abcdefgh…');
  assert.equal(body.metadata.nested.path, '/chat');
  assert.equal(body.metadata.app_id, 'agent-api');
  assert.equal(body.metadata.environment, 'dev');
  assert.ok(drops.some((entry) => entry.reason === 'redacted' && entry.keyPath === 'prompt'));
  assert.ok(drops.some((entry) => entry.reason === 'hashed' && entry.keyPath === 'session_id'));
});

test('record strict_finops mode keeps only finance-safe custom metadata keys', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    metadataPrivacy: {
      mode: 'strict_finops',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  await client.record({
    provider: 'openai',
    model: 'gpt-4o-mini',
    metadata: {
      route: '/chat',
      conversation_id: 'conv-1',
      prompt: 'should-not-leak',
    },
  });

  assert.equal(body.metadata.route, '/chat');
  assert.equal(body.metadata.conversation_id, undefined);
  assert.equal(body.metadata.prompt, undefined);
});

test('initFromEnv rejects the dormant dual delivery mode', () => {
  assert.throws(
    () => initFromEnv({
      env: {
        CLOPTIMA_LLM_OBSERVABILITY_API_KEY: 'pat-env',
        CLOPTIMA_LLM_OBSERVABILITY_APP_ID: 'agent-api',
        CLOPTIMA_LLM_OBSERVABILITY_DELIVERY_MODE: 'dual',
      },
    }),
    /temporarily disabled/,
  );
});

test('recordAsync uses bounded queue, batches events, retries, and flushes', async () => {
  const bodies = [];
  let calls = 0;
  const errors = [];
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    asyncBatchSize: 10,
    asyncFlushIntervalMs: 1000,
    asyncRetryCount: 1,
    asyncRetryBackoffMs: 0,
    onError: (error) => errors.push(error),
    fetchImpl: async (_input, init) => {
      calls += 1;
      bodies.push(JSON.parse(String(init?.body)));
      if (calls === 1) {
        return new Response('{}', { status: 500 });
      }
      return new Response('{}', { status: 202 });
    },
  });

  client.recordAsync({ provider: 'openai', model: 'gpt-4o-mini', sourceEventId: 'event-1' });
  client.recordAsync({ provider: 'anthropic', model: 'claude-3-5-sonnet', sourceEventId: 'event-2' });

  assert.equal(await client.flush(2000), true);
  assert.equal(calls, 2);
  assert.equal(errors.length, 0);
  assert.deepEqual(bodies[1].events.map((event) => event.source_event_id), ['event-1', 'event-2']);
  assert.equal(await client.close(2000), true);
});

test('recordAsync flush and close honor strict timeouts while transport is blocked', async () => {
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    asyncFlushIntervalMs: 0,
    fetchImpl: async () => new Promise(() => {}),
  });

  client.recordAsync({ provider: 'openai', model: 'gpt-4o-mini', sourceEventId: 'event-timeout' });

  assert.equal(await client.flush(10), false);
  assert.equal(await client.close(10), false);
  assert.deepEqual(client.getStats(), {
    queuedEvents: 0,
    droppedEvents: 0,
    deliveredEvents: 0,
    failedBatches: 0,
  });
});

test('recordAsync reports queue overflow and closed client errors', async () => {
  const errors = [];
  const drops = [];
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    asyncQueueMaxSize: 1,
    asyncFlushIntervalMs: 1000,
    onError: (error) => errors.push(error),
    onDrop: (event, reason) => drops.push([event.sourceEventId, reason]),
    fetchImpl: async () => new Response('{}', { status: 202 }),
  });

  client.recordAsync({ provider: 'openai', model: 'gpt-4o-mini', sourceEventId: 'event-1' });
  client.recordAsync({ provider: 'openai', model: 'gpt-4o-mini', sourceEventId: 'event-2' });
  assert.match(String(errors[0]?.message || errors[0]), /queue is full/);
  assert.deepEqual(drops[0], ['event-2', 'queue_full']);
  assert.equal(client.getStats().droppedEvents, 1);

  assert.equal(await client.close(2000), true);
  client.recordAsync({ provider: 'openai', model: 'gpt-4o-mini', sourceEventId: 'event-3' });
  assert.match(String(errors[1]?.message || errors[1]), /client is closed/);
  assert.deepEqual(drops[1], ['event-3', 'client_closed']);
  assert.equal(client.getStats().droppedEvents, 2);
});

test('observe records successful calls with extracted OpenAI usage', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  const response = await client.observe({
    provider: 'openai',
    model: 'gpt-4o-mini',
    fireAndForget: false,
    agent: {
      agentSessionId: 'agent-session-2',
      toolName: 'profile_lookup',
      retryIndex: '1',
      loopIteration: '2',
    },
    metadata: {
      retry_index: 'bad',
      loop_iteration: 'bad',
    },
    call: async () => ({
      id: 'chatcmpl-1',
      model: 'gpt-4o-mini',
      usage: {
        prompt_tokens: 7,
        completion_tokens: 3,
        total_tokens: 10,
        prompt_tokens_details: {
          cached_tokens: 2,
          cache_creation_input_tokens_5m: 4,
        },
        completion_tokens_details: {
          reasoning_tokens: 1,
        },
      },
    }),
    extractUsage: extractOpenAIUsage,
  });

  assert.equal(response.id, 'chatcmpl-1');
  assert.equal(body?.provider, 'openai');
  assert.equal(body?.provider_request_id, 'chatcmpl-1');
  assert.equal(body?.input_tokens, 7);
  assert.equal(body?.output_tokens, 3);
  assert.equal(body?.reasoning_tokens, 1);
  assert.equal(body?.cached_input_tokens, 2);
  assert.deepEqual(body?.extra_usage_units, { cache_write_5m: 4 });
  assert.equal(body?.metadata?.agent_session_id, 'agent-session-2');
  assert.equal(body?.metadata?.tool_name, 'profile_lookup');
  assert.equal(body?.metadata?.retry_index, 1);
  assert.equal(body?.metadata?.loop_iteration, 2);
});

test('observeCall accepts flat attribution fields and per-call metadata privacy overrides', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  const result = await client.observeCall({
    provider: 'openai',
    model: 'gpt-4o-mini',
    call: () => ({
      id: 'chatcmpl-flat-1',
      model: 'gpt-4o-mini',
      usage: {
        prompt_tokens: 9,
        completion_tokens: 4,
        total_tokens: 13,
      },
    }),
    extractUsage: extractOpenAIUsage,
    teamId: 'platform',
    featureId: 'summaries',
    workflowId: 'support-agent',
    metadata: {
      prompt: 'should-be-redacted',
      route: '/summaries',
    },
    metadataPrivacy: {
      mode: 'allowlisted_metadata',
      allowlistKeys: ['route'],
    },
    fireAndForget: false,
  });

  assert.equal(result.id, 'chatcmpl-flat-1');
  assert.equal(body.metadata.team_id, 'platform');
  assert.equal(body.metadata.feature_id, 'summaries');
  assert.equal(body.metadata.workflow_id, 'support-agent');
  assert.equal(body.metadata.route, '/summaries');
  assert.equal(body.metadata.prompt, undefined);
});

test('runWithAttribution applies ambient attribution and keeps explicit per-call overrides', async () => {
  const bodies = [];
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response('{}', { status: 202 });
    },
  });

  await client.runWithAttribution({
    teamId: 'platform',
    featureId: 'summaries',
    workflowId: 'ambient-workflow',
  }, async () => {
    await Promise.resolve();
    await client.record({
      provider: 'openai',
      model: 'gpt-4o-mini',
    });
    await client.observeCall({
      provider: 'openai',
      model: 'gpt-4o-mini',
      call: () => ({
        id: 'chatcmpl-context-1',
        model: 'gpt-4o-mini',
        usage: {
          prompt_tokens: 3,
          completion_tokens: 2,
          total_tokens: 5,
        },
      }),
      extractUsage: extractOpenAIUsage,
      workflowId: 'explicit-workflow',
      fireAndForget: false,
    });
  });

  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].metadata.team_id, 'platform');
  assert.equal(bodies[0].metadata.feature_id, 'summaries');
  assert.equal(bodies[0].metadata.workflow_id, 'ambient-workflow');
  assert.equal(bodies[1].metadata.team_id, 'platform');
  assert.equal(bodies[1].metadata.feature_id, 'summaries');
  assert.equal(bodies[1].metadata.workflow_id, 'explicit-workflow');
});

test('runWithAttribution preserves context for async generator callbacks', async () => {
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async () => new Response('{}', { status: 202 }),
  });

  const workflowIds = [];
  const stream = client.runWithAttribution({
    workflowId: 'ambient-stream',
  }, async function* () {
    await Promise.resolve();
    yield previewEventPayload({
      provider: 'openai',
      model: 'gpt-4o-mini',
    }, {
      defaultAttribution: {
        appId: 'agent-api',
        environment: 'dev',
      },
    }).metadata.workflow_id;
  });

  for await (const workflowId of stream) {
    workflowIds.push(workflowId);
  }

  assert.deepEqual(workflowIds, ['ambient-stream']);
});

test('withWorkflow and withTask set named attribution defaults while preserving explicit overrides', async () => {
  const bodies = [];
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response('{}', { status: 202 });
    },
  });

  await client.withWorkflow('order-checkout', async () => {
    await withTask('llm-summary', async () => {
      await client.record({
        provider: 'openai',
        model: 'gpt-4o-mini',
      });
    });

    await withTask('ignored-task-name', async () => {
      await client.record({
        provider: 'openai',
        model: 'gpt-4o-mini',
        featureId: 'explicit-feature',
      });
    });
  });

  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].metadata.workflow_id, 'order-checkout');
  assert.equal(bodies[0].metadata.feature_id, 'llm-summary');
  assert.equal(bodies[1].metadata.workflow_id, 'order-checkout');
  assert.equal(bodies[1].metadata.feature_id, 'explicit-feature');

  const preview = await withWorkflow('preview-workflow', async () => withTask('preview-task', () => (
    previewEventPayload(
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
      },
      {
        defaultAttribution: {
          appId: 'agent-api',
          environment: 'dev',
        },
      },
    )
  )));
  assert.equal(preview.metadata.workflow_id, 'preview-workflow');
  assert.equal(preview.metadata.feature_id, 'preview-task');
});

test('createObservedCall and createObservedStream reduce wrapper boilerplate and preserve overrides', async () => {
  const bodies = [];
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response('{}', { status: 202 });
    },
  });

  const observeOpenAI = createObservedCall(client, {
    provider: 'openai',
    model: 'gpt-4o-mini',
    extractUsage: extractOpenAIUsage,
    attribution: { featureId: 'wrapper-default' },
    metadata: { channel: 'sync' },
    fireAndForget: false,
  });

  const response = await observeOpenAI(
    () => ({
      id: 'chatcmpl-factory-1',
      model: 'gpt-4o-mini',
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
    }),
    {
      attribution: { workflowId: 'wrapper-invoke' },
      metadata: { operation: 'summarize' },
    },
  );

  const observeStream = createObservedStream(client, {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    extractUsage: extractAnthropicStreamUsage,
    metadata: { channel: 'stream' },
    fireAndForget: false,
  });

  const emitted = [];
  for await (const chunk of observeStream(async function* () {
    yield { message: { id: 'msg-factory-1', model: 'claude-3-5-sonnet' } };
    yield { usage: { input_tokens: 4, output_tokens: 2 } };
  }, {
    attribution: { workflowId: 'wrapper-stream' },
  })) {
    emitted.push(chunk);
  }

  assert.equal(response.id, 'chatcmpl-factory-1');
  assert.equal(emitted.length, 2);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].metadata.feature_id, 'wrapper-default');
  assert.equal(bodies[0].metadata.workflow_id, 'wrapper-invoke');
  assert.equal(bodies[0].metadata.channel, 'sync');
  assert.equal(bodies[0].metadata.operation, 'summarize');
  assert.equal(bodies[1].metadata.workflow_id, 'wrapper-stream');
  assert.equal(bodies[1].metadata.channel, 'stream');
});

test('bindObservedCall and bindObservedStream wrap existing service methods with per-invocation overrides', async () => {
  const bodies = [];
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response('{}', { status: 202 });
    },
  });

  class ProviderService {
    async generate(prompt, requestId) {
      return {
        id: `chatcmpl-${requestId}`,
        model: 'gpt-4o-mini',
        usage: { prompt_tokens: prompt.length, completion_tokens: 2, total_tokens: prompt.length + 2 },
      };
    }

    async *stream(prompt, requestId) {
      yield { message: { id: `msg-${requestId}`, model: 'claude-3-5-sonnet' } };
      yield { usage: { input_tokens: prompt.length, output_tokens: 1 } };
    }
  }

  const service = new ProviderService();
  const observedGenerate = bindObservedCall(
    client,
    service.generate.bind(service),
    {
      provider: 'openai',
      model: 'gpt-4o-mini',
      extractUsage: extractOpenAIUsage,
      metadata: { service: 'provider-service' },
      fireAndForget: false,
    },
    (_prompt, requestId) => ({
      requestId,
      attribution: { workflowId: `wf-${requestId}` },
    }),
  );
  const observedStream = bindObservedStream(
    client,
    service.stream.bind(service),
    {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      extractUsage: extractAnthropicStreamUsage,
      metadata: { service: 'provider-service-stream' },
      fireAndForget: false,
    },
    (_prompt, requestId) => ({
      requestId,
      attribution: { workflowId: `wf-${requestId}` },
    }),
  );

  const response = await observedGenerate('hello', 'req-123');
  const streamChunks = [];
  for await (const chunk of observedStream('hey', 'req-456')) {
    streamChunks.push(chunk);
  }

  assert.equal(response.id, 'chatcmpl-req-123');
  assert.equal(streamChunks.length, 2);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].request_id, 'req-123');
  assert.equal(bodies[0].metadata.workflow_id, 'wf-req-123');
  assert.equal(bodies[0].metadata.service, 'provider-service');
  assert.equal(bodies[1].request_id, 'req-456');
  assert.equal(bodies[1].metadata.workflow_id, 'wf-req-456');
  assert.equal(bodies[1].metadata.service, 'provider-service-stream');
});

test('wrapObservedService wraps multiple existing service methods together', async () => {
  const { wrapObservedService } = await import(`${buildDir}/src/index.js`);
  const bodies = [];
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response('{}', { status: 202 });
    },
  });

  class SharedAIService {
    plainHelper() {
      return 'helper-ok';
    }

    async summarize(text, requestId) {
      return {
        id: `chatcmpl-${requestId}`,
        model: 'gpt-4o-mini',
        usage: { prompt_tokens: text.length, completion_tokens: 2, total_tokens: text.length + 2 },
      };
    }

    async *streamReply(text, requestId) {
      yield { message: { id: `msg-${requestId}`, model: 'claude-3-5-sonnet' } };
      yield { usage: { input_tokens: text.length, output_tokens: 1 } };
    }
  }

  const wrapped = wrapObservedService(client, new SharedAIService(), {
    summarize: {
      kind: 'call',
      options: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        extractUsage: extractOpenAIUsage,
        fireAndForget: false,
      },
      resolveOverrides: (_text, requestId) => ({ requestId }),
    },
    streamReply: {
      kind: 'stream',
      options: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        extractUsage: extractAnthropicStreamUsage,
        fireAndForget: false,
      },
      resolveOverrides: (_text, requestId) => ({ requestId }),
    },
  });

  const response = await wrapped.summarize('hello', 'svc-1');
  const chunks = [];
  for await (const chunk of wrapped.streamReply('hey', 'svc-2')) {
    chunks.push(chunk);
  }

  assert.equal(response.id, 'chatcmpl-svc-1');
  assert.equal(chunks.length, 2);
  assert.equal(wrapped.plainHelper(), 'helper-ok');
  assert.equal(bodies[0].request_id, 'svc-1');
  assert.equal(bodies[1].request_id, 'svc-2');
});

test('createInstrumentedFetch wraps fetch and records openai-compatible usage', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  const wrappedFetch = createInstrumentedFetch(client, {
    provider: 'openai',
    model: 'gpt-4o-mini',
    fetchImpl: async () => new Response(JSON.stringify({
      id: 'chatcmpl-fetch-wrapper-1',
      model: 'gpt-4o-mini',
      usage: {
        prompt_tokens: 11,
        completion_tokens: 6,
        total_tokens: 17,
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
    metadata: { integration_mode: 'transport_wrapper' },
    fireAndForget: false,
  });

  const response = await wrappedFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
  });

  assert.equal(response.status, 200);
  assert.equal(body.provider, 'openai');
  assert.equal(body.model, 'gpt-4o-mini');
  assert.equal(body.provider_request_id, 'chatcmpl-fetch-wrapper-1');
  assert.equal(body.metadata.integration_mode, 'transport_wrapper');
  assert.equal(body.metadata.http_method, 'POST');
  assert.equal(body.metadata.http_url, 'https://api.openai.com/v1/chat/completions');
});

test('createInstrumentedFetch fails open when provider resolution is missing', async () => {
  const errors = [];
  let fetchCalls = 0;
  let recordCalls = 0;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, _init) => {
      recordCalls += 1;
      return new Response('{}', { status: 202 });
    },
  });

  const wrappedFetch = createInstrumentedFetch(client, {
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(null, { status: 204 });
    },
    onInstrumentationError: (error) => errors.push(String(error)),
  });

  const response = await wrappedFetch('https://provider.example.com/v1/chat', { method: 'POST' });

  assert.equal(response.status, 204);
  assert.equal(fetchCalls, 1);
  assert.equal(recordCalls, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /requires a provider/i);
});

test('createInstrumentedFetch short-circuits entirely when the client is disabled', async () => {
  let fetchCalls = 0;
  let resolveCalls = 0;
  const wrappedFetch = createInstrumentedFetch(disabledClient(), {
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(null, { status: 204 });
    },
    resolveOptions: () => {
      resolveCalls += 1;
      return { provider: 'openai' };
    },
  });

  const response = await wrappedFetch('https://provider.example.com/v1/chat', { method: 'POST' });

  assert.equal(response.status, 204);
  assert.equal(fetchCalls, 1);
  assert.equal(resolveCalls, 0);
});

test('instrumentOpenAICompatibleResponse records an existing response without wrapping the provider client', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  const existingResponse = {
    id: 'chatcmpl-helper-1',
    model: 'gpt-4o-mini',
    usage: {
      prompt_tokens: 4,
      completion_tokens: 6,
      total_tokens: 10,
    },
  };

  const response = await instrumentOpenAICompatibleResponse(client, existingResponse, {
    fireAndForget: false,
    metadata: { integration_mode: 'passive_helper' },
  });

  assert.equal(response, existingResponse);
  assert.equal(body?.provider, 'openai');
  assert.equal(body?.provider_request_id, 'chatcmpl-helper-1');
  assert.equal(body?.input_tokens, 4);
  assert.equal(body?.output_tokens, 6);
  assert.equal(body?.metadata?.integration_mode, 'passive_helper');
  assert.equal(body?.latency_ms, undefined);
});

test('instrumentOpenAICompatibleResponse accepts a disabled client and returns the original response', async () => {
  const existingResponse = {
    id: 'chatcmpl-helper-disabled-1',
    model: 'gpt-4o-mini',
    usage: {
      prompt_tokens: 4,
      completion_tokens: 6,
      total_tokens: 10,
    },
  };

  const response = await instrumentOpenAICompatibleResponse(disabledClient(), existingResponse, {
    provider: 'openai',
    model: 'gpt-4o-mini',
  });

  assert.equal(response, existingResponse);
});

test('instrumentOpenAICompatibleResponse measures real latency when given the provider promise directly', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  const response = await instrumentOpenAICompatibleResponse(
    client,
    new Promise((resolve) => {
      setTimeout(() => resolve({
        id: 'chatcmpl-helper-latency-1',
        model: 'gpt-4o-mini',
        usage: {
          prompt_tokens: 2,
          completion_tokens: 3,
          total_tokens: 5,
        },
      }), 15);
    }),
    {
      fireAndForget: false,
    },
  );

  assert.equal(response.id, 'chatcmpl-helper-latency-1');
  assert.equal(body?.provider_request_id, 'chatcmpl-helper-latency-1');
  assert.equal(typeof body?.latency_ms, 'number');
  assert.ok(body?.latency_ms >= 10);
});

test('instrumentOpenAICompatibleResponse records failed provider promises', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  await assert.rejects(
    instrumentOpenAICompatibleResponse(
      client,
      Promise.reject(new Error('provider promise failed')),
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        fireAndForget: false,
        metadata: { helper_mode: 'promise' },
      },
    ),
    /provider promise failed/,
  );

  assert.equal(body?.status, 'failed');
  assert.equal(body?.provider, 'openai');
  assert.equal(body?.model, 'gpt-4o-mini');
  assert.equal(body?.error_message, 'provider promise failed');
  assert.equal(body?.metadata?.helper_mode, 'promise');
  assert.equal(typeof body?.latency_ms, 'number');
});

test('instrumentFetchLLMUsage records raw fetch responses without wrapping provider clients', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  const providerResponse = new Response(JSON.stringify({
    id: 'chatcmpl-fetch-1',
    model: 'gpt-4o-mini',
    usage: {
      prompt_tokens: 9,
      completion_tokens: 4,
      total_tokens: 13,
    },
  }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'openai-request-id': 'provider-fetch-1',
    },
  });

  const response = await instrumentFetchLLMUsage(client, providerResponse, {
    provider: 'openai',
    method: 'POST',
    url: 'https://api.openai.com/v1/chat/completions',
    fireAndForget: false,
  });

  assert.equal(response.status, 200);
  assert.equal(body?.provider, 'openai');
  assert.equal(body?.provider_request_id, 'chatcmpl-fetch-1');
  assert.equal(body?.input_tokens, 9);
  assert.equal(body?.output_tokens, 4);
  assert.equal(body?.metadata?.http_method, 'POST');
  assert.equal(body?.metadata?.http_status_code, 200);
  assert.equal(body?.metadata?.response_json_parsed, true);
});

test('instrumentFetchLLMUsage measures latency from provider fetch promises', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  await instrumentFetchLLMUsage(client, new Promise((resolve) => {
    setTimeout(() => resolve(new Response(JSON.stringify({
      id: 'chatcmpl-fetch-latency-1',
      model: 'gpt-4o-mini',
      usage: {
        prompt_tokens: 3,
        completion_tokens: 2,
        total_tokens: 5,
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })), 15);
  }), {
    provider: 'openai',
    fireAndForget: false,
  });

  assert.equal(body?.provider_request_id, 'chatcmpl-fetch-latency-1');
  assert.equal(typeof body?.latency_ms, 'number');
  assert.ok(body?.latency_ms >= 10);
});

test('instrumentFetchLLMUsage records failed provider fetch promises', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  await assert.rejects(
    instrumentFetchLLMUsage(client, Promise.reject(new Error('network resolution failed')), {
      provider: 'openai',
      model: 'gpt-4o-mini',
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      fireAndForget: false,
      metadata: { helper_mode: 'fetch' },
    }),
    /network resolution failed/,
  );

  assert.equal(body?.status, 'failed');
  assert.equal(body?.provider, 'openai');
  assert.equal(body?.model, 'gpt-4o-mini');
  assert.equal(body?.error_message, 'network resolution failed');
  assert.equal(body?.metadata?.helper_mode, 'fetch');
  assert.equal(body?.metadata?.http_method, 'POST');
  assert.equal(body?.metadata?.http_url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(body?.metadata?.response_json_parsed, false);
  assert.equal(typeof body?.latency_ms, 'number');
});

test('createInstrumentedFetch reports malformed json responses through onInstrumentationError without failing the caller', async () => {
  const errors = [];
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  const wrappedFetch = createInstrumentedFetch(client, {
    provider: 'openai',
    model: 'gpt-4o-mini',
    fetchImpl: async () => new Response('{not-valid-json', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
    fireAndForget: false,
    onInstrumentationError: (error) => errors.push(String(error)),
  });

  const response = await wrappedFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
  });

  assert.equal(response.status, 200);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /could not parse json response/i);
  assert.equal(body?.metadata?.response_json_parsed, false);
  assert.equal(body?.metadata?.response_json_parse_failed, true);
});

test('observe records failed calls when requested synchronously', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  await assert.rejects(
    client.observe({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      fireAndForget: false,
      call: async () => {
        throw new Error('provider unavailable');
      },
    }),
    /provider unavailable/,
  );

  assert.equal(body?.status, 'failed');
  assert.equal(body?.provider, 'anthropic');
  assert.equal(body?.error_message, 'provider unavailable');
});

test('observeStream yields chunks and records final stream usage', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  async function* stream() {
    yield { id: 'chatcmpl-stream', model: 'gpt-4o-mini', choices: [{ delta: { content: 'hi' } }] };
    yield {
      id: 'chatcmpl-stream',
      model: 'gpt-4o-mini',
      usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
    };
  }

  const emitted = [];
  for await (const chunk of client.observeStream({
    provider: 'openai',
    model: 'gpt-4o-mini',
    fireAndForget: false,
    call: stream,
    extractUsage: extractOpenAIStreamUsage,
  })) {
    emitted.push(chunk);
  }

  assert.equal(emitted.length, 2);
  assert.equal(body?.status, 'succeeded');
  assert.equal(body?.provider_request_id, 'chatcmpl-stream');
  assert.equal(body?.input_tokens, 5);
  assert.equal(body?.output_tokens, 7);
  assert.equal(body?.metadata?.streamed, true);
});

test('instrumentOpenAICompatibleStream observes an existing stream and yields original chunks', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  async function* existingStream() {
    yield { id: 'chatcmpl-helper-stream', model: 'gpt-4o-mini', choices: [{ delta: { content: 'hello' } }] };
    yield {
      id: 'chatcmpl-helper-stream',
      model: 'gpt-4o-mini',
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
    };
  }

  const emitted = [];
  for await (const chunk of instrumentOpenAICompatibleStream(client, existingStream(), {
    fireAndForget: false,
    metadata: { integration_mode: 'passive_helper_stream' },
  })) {
    emitted.push(chunk);
  }

  assert.equal(emitted.length, 2);
  assert.equal(body?.provider_request_id, 'chatcmpl-helper-stream');
  assert.equal(body?.input_tokens, 2);
  assert.equal(body?.output_tokens, 3);
  assert.equal(body?.metadata?.integration_mode, 'passive_helper_stream');
  assert.equal(body?.metadata?.streamed, true);
});

test('instrumentExpressRequestContext extracts passive request metadata without changing attribution ownership', () => {
  const context = instrumentExpressRequestContext({
    method: 'post',
    path: '/v1/chat',
    route: { path: '/v1/chat' },
    ip: '10.0.0.1',
    headers: {
      'x-request-id': 'req-1',
      'x-trace-id': 'trace-1',
      host: 'api.example.com',
      'user-agent': 'jest',
      'x-org': 'growth',
    },
  }, {
    attribution: { teamId: 'platform' },
    includeHeaders: ['x-org'],
  });

  assert.equal(context.requestId, 'req-1');
  assert.equal(context.traceId, 'trace-1');
  assert.equal(context.attribution.teamId, 'platform');
  assert.equal(context.metadata.http_method, 'POST');
  assert.equal(context.metadata.http_route, '/v1/chat');
  assert.equal(context.metadata.client_ip, '10.0.0.1');
  assert.equal(context.metadata.http_header_x_org, 'growth');
});

test('instrumentNextJsRouteContext extracts request metadata from Request objects', () => {
  const request = new Request('https://app.example.com/api/ai?x=1', {
    method: 'PATCH',
    headers: {
      'x-request-id': 'req-next-1',
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00',
      'user-agent': 'next-test',
    },
  });

  const context = instrumentNextJsRouteContext(request, {
    includeHeaders: ['user-agent'],
  });

  assert.equal(context.requestId, 'req-next-1');
  assert.equal(context.traceId, '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00');
  assert.equal(context.metadata.http_method, 'PATCH');
  assert.equal(context.metadata.http_path, '/api/ai');
  assert.equal(context.metadata.http_host, 'app.example.com');
  assert.equal(context.metadata.http_header_user_agent, 'next-test');
});

test('instrumentOpenAICompatibleStream preserves azure_openai provider attribution', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  async function* existingStream() {
    yield { id: 'azure-stream-1', model: 'gpt-4o-mini' };
    yield {
      id: 'azure-stream-1',
      model: 'gpt-4o-mini',
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
    };
  }

  const emitted = [];
  for await (const chunk of instrumentOpenAICompatibleStream(client, existingStream(), {
    provider: 'azure_openai',
    fireAndForget: false,
  })) {
    emitted.push(chunk);
  }

  assert.equal(emitted.length, 2);
  assert.equal(body?.provider, 'azure_openai');
});

test('observeStream defaults to synchronous recording and bounds extractor chunks', async () => {
  let body;
  const observedChunkLengths = [];
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  function* stream() {
    yield { id: 'stream-cap-1', model: 'gpt-4o-mini' };
    yield { id: 'stream-cap-2', model: 'gpt-4o-mini' };
    yield {
      id: 'stream-cap-3',
      model: 'gpt-4o-mini',
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    };
  }

  const emitted = [];
  for await (const chunk of client.observeStream({
    provider: 'openai',
    model: 'gpt-4o-mini',
    call: stream,
    maxBufferedChunks: 2,
    extractUsage: (chunks) => {
      observedChunkLengths.push(chunks.length);
      return extractOpenAIStreamUsage(chunks);
    },
  })) {
    emitted.push(chunk);
  }

  assert.equal(emitted.length, 3);
  assert.deepEqual(observedChunkLengths, [2]);
  assert.equal(body?.provider_request_id, 'stream-cap-3');
  assert.equal(body?.input_tokens, 1);
});

test('observeStream records partial telemetry when stream fails after chunks', async () => {
  let body;
  const client = new CloptimaLLMObservability({
    apiBaseUrl: TEST_API_BASE_URL,
    apiKey: 'pat-test',
    defaultAttribution: {
      appId: 'agent-api',
      environment: 'dev',
    },
    fetchImpl: async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response('{}', { status: 202 });
    },
  });

  async function* stream() {
    yield { delta: 'first' };
    throw new Error('stream interrupted');
  }

  await assert.rejects(async () => {
    for await (const _chunk of client.observeStream({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      fireAndForget: false,
      call: stream,
    })) {
      // consume stream
    }
  }, /stream interrupted/);

  assert.equal(body?.status, 'partial');
  assert.equal(body?.metadata?.streamed, true);
  assert.equal(body?.metadata?.stream_chunks, 1);
});

test('cloud provider stream extractors normalize usage', () => {
  assert.deepEqual(
    extractGeminiStreamUsage([
      { responseId: 'gemini-stream-1', modelVersion: 'gemini-2.5-pro' },
      { usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 11, totalTokenCount: 18 } },
    ]),
    {
      provider: 'gemini',
      providerRequestId: 'gemini-stream-1',
      model: 'gemini-2.5-pro',
      inputTokens: 7,
      outputTokens: 11,
      totalTokens: 18,
      reasoningTokens: undefined,
      cachedInputTokens: undefined,
      cacheHit: undefined,
    },
  );
  assert.equal(
    extractVertexStreamUsage([
      { response_id: 'vertex-stream-1', model_version: 'gemini-2.5-pro' },
      { usage_metadata: { prompt_token_count: 2, candidates_token_count: 4, total_token_count: 6 } },
    ]).provider,
    'vertex_ai',
  );
  assert.deepEqual(
    extractBedrockStreamUsage([
      { requestId: 'bedrock-stream-1', modelId: 'anthropic.claude-3-5-sonnet', usage: { inputTokens: 5 } },
      { usage: { outputTokens: 9 } },
    ]),
    {
      provider: 'bedrock',
      providerRequestId: 'bedrock-stream-1',
      model: 'anthropic.claude-3-5-sonnet',
      inputTokens: 5,
      outputTokens: 9,
      totalTokens: 14,
    },
  );
});

test('extractAnthropicStreamUsage aggregates message stream events', () => {
  assert.deepEqual(
    extractAnthropicStreamUsage([
      {
        type: 'message_start',
        message: {
          id: 'msg-stream',
          model: 'claude-3-5-sonnet',
          usage: { input_tokens: 8, cache_read_input_tokens: 2 },
        },
      },
      { type: 'message_delta', usage: { output_tokens: 4, cache_creation_input_tokens: 3 } },
    ]),
    {
      provider: 'anthropic',
      providerRequestId: 'msg-stream',
      model: 'claude-3-5-sonnet',
      inputTokens: 8,
      outputTokens: 4,
      totalTokens: 12,
      cachedInputTokens: 2,
      extraUsageUnits: { cache_write: 3 },
      cacheHit: true,
    },
  );
});

test('provider usage extractors normalize common response shapes', () => {
  assert.deepEqual(
    extractAnthropicUsage({
      id: 'msg-1',
      model: 'claude-3-5-sonnet',
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 3,
        cache_creation_input_tokens: 7,
      },
    }),
    {
      provider: 'anthropic',
      providerRequestId: 'msg-1',
      model: 'claude-3-5-sonnet',
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      cachedInputTokens: 3,
      extraUsageUnits: { cache_write: 7 },
      cacheHit: true,
    },
  );
  assert.deepEqual(
    extractGeminiUsage({
      responseId: 'gemini-response-1',
      modelVersion: 'gemini-2.5-flash',
      usageMetadata: {
        promptTokenCount: 11,
        candidatesTokenCount: 13,
        totalTokenCount: 24,
        thoughtsTokenCount: 2,
        cachedContentTokenCount: 4,
      },
    }),
    {
      provider: 'gemini',
      providerRequestId: 'gemini-response-1',
      model: 'gemini-2.5-flash',
      inputTokens: 11,
      outputTokens: 13,
      totalTokens: 24,
      reasoningTokens: 2,
      cachedInputTokens: 4,
      cacheHit: true,
    },
  );
  assert.equal(
    extractVertexUsage({
      response_id: 'vertex-response-1',
      model_version: 'gemini-2.5-pro',
      usage_metadata: {
        prompt_token_count: 3,
        candidates_token_count: 4,
        total_token_count: 7,
      },
    }).provider,
    'vertex_ai',
  );
  assert.deepEqual(
    extractBedrockUsage({
      modelId: 'anthropic.claude-3-5-sonnet',
      usage: { inputTokens: 20, outputTokens: 6, totalTokens: 26 },
      metrics: { latencyMs: 321 },
      ResponseMetadata: { RequestId: 'bedrock-request-1' },
    }),
    {
      provider: 'bedrock',
      providerRequestId: 'bedrock-request-1',
      model: 'anthropic.claude-3-5-sonnet',
      inputTokens: 20,
      outputTokens: 6,
      totalTokens: 26,
      latencyMs: 321,
    },
  );
  assert.deepEqual(
    extractAzureOpenAIUsage({
      id: 'chatcmpl-azure',
      deployment_name: 'gpt-4o-mini-prod',
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    }),
    {
      providerRequestId: 'chatcmpl-azure',
      model: 'gpt-4o-mini-prod',
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
      reasoningTokens: undefined,
      cachedInputTokens: undefined,
      extraUsageUnits: undefined,
      cacheHit: undefined,
      provider: 'azure_openai',
    },
  );
});

test('provider extractors accept object-like responses and composition helpers', () => {
  class OpenAIModel {
    model_dump() {
      return {
        id: 'chatcmpl-model-dump',
        model: 'gpt-4o-mini',
        usage: {
          prompt_tokens: 8,
          completion_tokens: 5,
          total_tokens: 13,
        },
      };
    }
  }

  class GeminiModel {
    dict() {
      return {
        responseId: 'gemini-dict-1',
        modelVersion: 'gemini-2.5-flash',
        usageMetadata: {
          promptTokenCount: 6,
          responseTokenCount: 4,
          totalTokenCount: 10,
        },
      };
    }
  }

  class BedrockModel {
    toJSON() {
      return {
        request_id: 'bedrock-json-1',
        model_id: 'anthropic.claude-3-5-sonnet',
        usage: {
          input_tokens: 12,
          output_tokens: 3,
          total_tokens: 15,
        },
      };
    }
  }

  assert.deepEqual(
    stripUndefined(extractOpenAIUsage(new OpenAIModel())),
    {
      provider: 'openai',
      providerRequestId: 'chatcmpl-model-dump',
      model: 'gpt-4o-mini',
      inputTokens: 8,
      outputTokens: 5,
      totalTokens: 13,
    },
  );

  assert.deepEqual(
    stripUndefined(extractGeminiUsage(new GeminiModel())),
    {
      provider: 'gemini',
      providerRequestId: 'gemini-dict-1',
      model: 'gemini-2.5-flash',
      inputTokens: 6,
      outputTokens: 4,
      totalTokens: 10,
    },
  );

  assert.deepEqual(
    stripUndefined(extractBedrockUsage(new BedrockModel())),
    {
      provider: 'bedrock',
      providerRequestId: 'bedrock-json-1',
      model: 'anthropic.claude-3-5-sonnet',
      inputTokens: 12,
      outputTokens: 3,
      totalTokens: 15,
    },
  );

  const fallbackExtractor = composeUsageExtractors(
    () => ({}),
    extractOpenAIUsage,
  );
  assert.deepEqual(
    stripUndefined(fallbackExtractor(new OpenAIModel())),
    {
      provider: 'openai',
      providerRequestId: 'chatcmpl-model-dump',
      model: 'gpt-4o-mini',
      inputTokens: 8,
      outputTokens: 5,
      totalTokens: 13,
    },
  );

  assert.deepEqual(
    stripUndefined(tryExtractUsage(new GeminiModel(), () => ({}), extractGeminiUsage)),
    {
      provider: 'gemini',
      providerRequestId: 'gemini-dict-1',
      model: 'gemini-2.5-flash',
      inputTokens: 6,
      outputTokens: 4,
      totalTokens: 10,
    },
  );

  const overridden = withUsageOverrides(extractAnthropicUsage, (extracted) => ({
    ...extracted,
    outputTokens: 9,
  }));
  assert.deepEqual(
    stripUndefined(overridden({
      id: 'msg-override-1',
      model: 'claude-3-5-sonnet',
      usage: {
        input_tokens: 4,
        output_tokens: 2,
        total_tokens: 6,
      },
    })),
    {
      provider: 'anthropic',
      providerRequestId: 'msg-override-1',
      model: 'claude-3-5-sonnet',
      inputTokens: 4,
      outputTokens: 9,
      totalTokens: 6,
    },
  );
});

test('createMappedUsageExtractor maps nested custom payloads without full custom extractor code', () => {
  const extractor = createMappedUsageExtractor({
    defaults: {
      provider: 'custom_provider',
    },
    fields: {
      providerRequestId: ['response.id', 'meta.request_id'],
      model: 'meta.model_name',
      status: 'meta.status',
    },
    numberFields: {
      inputTokens: 'usage.input',
      outputTokens: 'usage.output',
      totalTokens: 'usage.total',
      latencyMs: 'timing.latency_ms',
    },
    booleanFields: {
      cacheHit: 'cache.hit',
    },
    extraUsageUnits: {
      images: 'usage.images_generated',
    },
    metadata: {
      region: 'meta.region',
      route: 'meta.route',
    },
  });

  assert.deepEqual(
    extractor({
      response: { id: 'resp-custom-1' },
      meta: {
        model_name: 'custom-model',
        status: 'succeeded',
        region: 'us-central1',
        route: '/v1/generate',
      },
      usage: {
        input: 7,
        output: 3,
        total: 10,
        images_generated: 2,
      },
      timing: { latency_ms: 145 },
      cache: { hit: true },
    }),
    {
      provider: 'custom_provider',
      providerRequestId: 'resp-custom-1',
      model: 'custom-model',
      status: 'succeeded',
      inputTokens: 7,
      outputTokens: 3,
      totalTokens: 10,
      latencyMs: 145,
      cacheHit: true,
      extraUsageUnits: { images: 2 },
      metadata: {
        region: 'us-central1',
        route: '/v1/generate',
      },
    },
  );
});

test('provider extractor registry resolves aliases and fixture coverage stays aligned', () => {
  assert.equal(getProviderUsageExtractor('azure'), extractAzureOpenAIUsage);
  assert.equal(getProviderUsageExtractor('vertex-ai'), extractVertexUsage);
  assert.equal(getProviderStreamUsageExtractor('bedrock'), extractBedrockStreamUsage);
  assert.equal(getProviderUsageExtractor(), undefined);
  assert.equal(getProviderStreamUsageExtractor(), undefined);
  assert.ok(PROVIDER_USAGE_EXTRACTORS.some((descriptor) => descriptor.provider === 'openai'));
  assert.deepEqual(listSupportedProviders(), PROVIDER_SUPPORT_MATRIX);
  assert.ok(PROVIDER_SUPPORT_MATRIX.every((descriptor) => descriptor.response === true));
  assert.ok(PROVIDER_SUPPORT_MATRIX.some((descriptor) => descriptor.provider === 'anthropic' && descriptor.stream === true));
  assert.throws(() => {
    PROVIDER_USAGE_EXTRACTORS.push({
      provider: 'fake',
      aliases: ['fake'],
      responseExtractor: () => ({}),
    });
  });
  assert.throws(() => {
    PROVIDER_USAGE_EXTRACTORS[0].aliases.push('mutated');
  });

  for (const fixture of providerUsageReplayFixtures) {
    const extractor = fixture.kind === 'stream'
      ? getProviderStreamUsageExtractor(fixture.provider)
      : getProviderUsageExtractor(fixture.provider);
    assert.ok(extractor, `missing registry extractor for ${fixture.provider}/${fixture.kind}`);
  }
});

test('provider usage fixture replay covers supported SDK extractors', () => {
  for (const fixture of providerUsageReplayFixtures) {
    assert.deepEqual(
      stripUndefined(extractFixtureUsage(fixture)),
      camelExpected(fixture.expected),
      fixture.name,
    );
  }
});
