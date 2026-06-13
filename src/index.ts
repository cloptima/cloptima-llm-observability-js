export type CloptimaFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
export type LLMObservabilityDeliveryMode = 'cloptima_http' | 'otlp_http';
const INTERNAL_DUAL_DELIVERY_MODE = 'dual';
const INTERNAL_DUAL_DELIVERY_MODE_ENABLED = false;
type InternalLLMObservabilityDeliveryMode = LLMObservabilityDeliveryMode | typeof INTERNAL_DUAL_DELIVERY_MODE;

export type LLMAttribution = {
  teamId?: string;
  appId: string;
  featureId?: string;
  workflowId?: string;
  businessUnit?: string;
  costCenter?: string;
  product?: string;
  customerSegment?: string;
  endCustomerId?: string;
  tenantId?: string;
  release?: string;
  environment: string;
  actorId?: string;
  actorType?: 'human' | 'service' | 'agent';
  developerId?: string;
  cloudAccountId?: string;
  clusterId?: string;
  repositoryId?: string;
};

export type LLMAgentContext = {
  agentSessionId?: string;
  agentRunId?: string;
  parentExecutionId?: string;
  agentStepId?: string;
  toolCallId?: string;
  toolName?: string;
  retryIndex?: number;
  loopIteration?: number;
};

export type LLMUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  extraUsageUnits?: Record<string, number>;
  cacheHit?: boolean;
};

export type LLMUsageEvent = LLMUsage & {
  provider: string;
  model: string;
  sourceEventId?: string;
  requestId?: string;
  providerRequestId?: string;
  traceId?: string;
  status?: 'succeeded' | 'failed' | 'partial' | 'blocked';
  startedAt?: Date | string;
  completedAt?: Date | string;
  latencyMs?: number;
  vendorReportedCostUsd?: number | string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
} & Partial<LLMAttribution> & Partial<LLMAgentContext>;

export type MetadataPrivacyMode =
  | 'metadata_only'
  | 'allowlisted_metadata'
  | 'strict_finops'
  | 'debug_observability';

export type MetadataDropReason =
  | 'allowlist'
  | 'denylist'
  | 'redacted'
  | 'hashed'
  | 'truncated'
  | 'max_keys'
  | 'max_serialized_bytes'
  | 'unsupported_value';

export type MetadataDropInfo = {
  keyPath: string;
  reason: MetadataDropReason;
  mode: MetadataPrivacyMode;
};

export type MetadataPrivacyOptions = {
  mode?: MetadataPrivacyMode;
  allowlistKeys?: string[];
  denylistKeys?: string[];
  redactKeys?: string[];
  hashKeys?: string[];
  maxKeys?: number;
  maxValueLength?: number;
  maxSerializedBytes?: number;
  redactValue?: string;
  onMetadataDrop?: (info: MetadataDropInfo) => void;
};

export type CloptimaLLMClientOptions = {
  apiBaseUrl?: string;
  apiKey: string;
  defaultAttribution: LLMAttribution;
  deliveryMode?: LLMObservabilityDeliveryMode;
  otlpHeaders?: Record<string, string>;
  otlpServiceName?: string;
  otlpServiceVersion?: string;
  sdkName?: string;
  sdkVersion?: string;
  fetchImpl?: CloptimaFetch;
  onError?: (error: unknown) => void;
  onDrop?: (event: LLMUsageEvent, reason: 'queue_full' | 'client_closed') => void;
  asyncQueueMaxSize?: number;
  asyncBatchSize?: number;
  asyncFlushIntervalMs?: number;
  asyncRetryCount?: number;
  asyncRetryBackoffMs?: number;
  asyncRetryJitterRatio?: number;
  metadataPrivacy?: MetadataPrivacyOptions;
};

export type CloptimaLLMClientStats = {
  queuedEvents: number;
  droppedEvents: number;
  deliveredEvents: number;
  failedBatches: number;
};

export interface LLMObservabilityClient {
  isEnabled(): boolean;
  getInitError(): Error | undefined;
  record(event: LLMUsageEvent): Promise<void>;
  recordBatch(events: LLMUsageEvent[]): Promise<void>;
  recordAsync(event: LLMUsageEvent): void;
  getStats(): CloptimaLLMClientStats;
  stats(): CloptimaLLMClientStats;
  flush(timeoutMs?: number): Promise<boolean>;
  close(timeoutMs?: number): Promise<boolean>;
  observe<T>(options: ObserveLLMCallOptions<T>): Promise<T>;
  observeCall<T>(options: ObserveCallOptions<T>): Promise<T>;
  observeStream<TChunk>(options: ObserveLLMStreamOptions<TChunk>): AsyncGenerator<TChunk, void, unknown>;
  observeStreamCall<TChunk>(options: ObserveStreamCallOptions<TChunk>): AsyncGenerator<TChunk, void, unknown>;
}

export type ObserveLLMCallOptions<T> = {
  provider: string;
  model: string;
  call: () => Promise<T> | T;
  extractUsage?: (response: T) => Partial<LLMUsageEvent>;
  attribution?: Partial<LLMAttribution>;
  agent?: Partial<LLMAgentContext>;
  metadata?: Record<string, unknown>;
  metadataPrivacy?: MetadataPrivacyOptions;
  requestId?: string;
  traceId?: string;
  fireAndForget?: boolean;
};

export type ObserveLLMStreamOptions<TChunk> = {
  provider: string;
  model: string;
  call: () => AsyncIterable<TChunk> | Iterable<TChunk> | Promise<AsyncIterable<TChunk> | Iterable<TChunk>>;
  extractUsage?: (chunks: TChunk[]) => Partial<LLMUsageEvent>;
  attribution?: Partial<LLMAttribution>;
  agent?: Partial<LLMAgentContext>;
  metadata?: Record<string, unknown>;
  metadataPrivacy?: MetadataPrivacyOptions;
  requestId?: string;
  traceId?: string;
  fireAndForget?: boolean;
  maxBufferedChunks?: number;
};

export type ObserveCallOptions<T> = ObserveLLMCallOptions<T> & Partial<LLMAttribution>;

export type ObserveStreamCallOptions<TChunk> = ObserveLLMStreamOptions<TChunk> & Partial<LLMAttribution>;

export type OpenAICompatibleInstrumentationOptions = {
  provider?: string;
  model?: string;
  attribution?: Partial<LLMAttribution>;
  agent?: Partial<LLMAgentContext>;
  metadata?: Record<string, unknown>;
  requestId?: string;
  traceId?: string;
  fireAndForget?: boolean;
};

export type OpenAICompatibleStreamInstrumentationOptions = OpenAICompatibleInstrumentationOptions & {
  maxBufferedChunks?: number;
};

export type RequestContextOptions = {
  attribution?: Partial<LLMAttribution>;
  metadata?: Record<string, unknown>;
  includeHeaders?: string[];
  requestIdHeader?: string;
  traceIdHeader?: string;
  route?: string;
};

export type FetchLLMInstrumentationOptions = OpenAICompatibleInstrumentationOptions & {
  method?: string;
  url?: string;
  providerRequestIdHeader?: string;
  onInstrumentationError?: (error: unknown) => void;
};

export type FetchInstrumentationResolver = (
  input: string | URL,
  init?: RequestInit,
) => Partial<FetchLLMInstrumentationOptions> | undefined;

export type InstrumentedFetchOptions = Omit<FetchLLMInstrumentationOptions, 'method' | 'url'> & {
  fetchImpl?: CloptimaFetch;
  resolveOptions?: FetchInstrumentationResolver;
  onInstrumentationError?: (error: unknown) => void;
};

export type InstrumentedRequestContext = {
  attribution?: Partial<LLMAttribution>;
  metadata: Record<string, unknown>;
  requestId?: string;
  traceId?: string;
};

export type InitFromEnvOptions = Partial<Omit<CloptimaLLMClientOptions, 'defaultAttribution'>> & {
  env?: Record<string, string | undefined>;
  enabled?: boolean;
  strict?: boolean;
  onInitError?: (error: Error) => void;
  defaultAttribution?: Partial<LLMAttribution>;
};

export type PayloadPreviewOptions = {
  defaultAttribution?: Partial<LLMAttribution>;
  sdkName?: string;
  sdkVersion?: string;
  metadataPrivacy?: MetadataPrivacyOptions;
};

export type OtlpPreviewOptions = {
  sdkName?: string;
  sdkVersion?: string;
  serviceName?: string;
  serviceVersion?: string;
};

export type PayloadValidationResult = {
  valid: boolean;
  errors: string[];
};

const SDK_EVENT_SCHEMA_VERSION = 'cloptima.llm.event.v1';
const SDK_BATCH_SCHEMA_VERSION = 'cloptima.llm.batch.v1';
const DEFAULT_API_BASE_URL = 'https://api.cloptima.ai';
const SDK_INGEST_PATH = '/v1/ai/integrations/sdk/events';
const OTLP_TRACES_PATH = '/v1/ai/integrations/otlp/traces';
const INIT_ENV_PREFIX = 'CLOPTIMA_LLM_OBSERVABILITY_';
const INIT_ENABLED_ENV = `${INIT_ENV_PREFIX}ENABLED`;
const INIT_API_BASE_URL_ENV = `${INIT_ENV_PREFIX}API_BASE_URL`;
const INIT_API_KEY_ENV = `${INIT_ENV_PREFIX}API_KEY`;
const INIT_APP_ID_ENV = `${INIT_ENV_PREFIX}APP_ID`;
const INIT_ENVIRONMENT_ENV = `${INIT_ENV_PREFIX}ENVIRONMENT`;
const INIT_TEAM_ID_ENV = `${INIT_ENV_PREFIX}TEAM_ID`;
const INIT_DELIVERY_MODE_ENV = `${INIT_ENV_PREFIX}DELIVERY_MODE`;
const INIT_OTLP_SERVICE_NAME_ENV = `${INIT_ENV_PREFIX}OTLP_SERVICE_NAME`;
const INIT_OTLP_SERVICE_VERSION_ENV = `${INIT_ENV_PREFIX}OTLP_SERVICE_VERSION`;

function agentEventFields(agent?: Partial<LLMAgentContext>): Partial<LLMAgentContext> {
  return agent ? {
    agentSessionId: cleanString(agent.agentSessionId),
    agentRunId: cleanString(agent.agentRunId),
    parentExecutionId: cleanString(agent.parentExecutionId),
    agentStepId: cleanString(agent.agentStepId),
    toolCallId: cleanString(agent.toolCallId),
    toolName: cleanString(agent.toolName),
    retryIndex: cleanNumber(agent.retryIndex),
    loopIteration: cleanNumber(agent.loopIteration),
  } : {};
}

function requireFetch(fetchImpl?: CloptimaFetch): CloptimaFetch {
  const resolved = fetchImpl || globalThis.fetch;
  if (!resolved) {
    throw new Error('A fetch implementation is required in this runtime');
  }
  return resolved.bind(globalThis) as CloptimaFetch;
}

function currentEnv(): Record<string, string | undefined> {
  const runtime = globalThis as { process?: { env?: Record<string, string | undefined> } };
  if (runtime.process?.env) {
    return runtime.process.env;
  }
  return {};
}

function parseBooleanEnv(value: string | boolean | undefined): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = cleanString(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function attributionFromFlatFields(options: Partial<LLMAttribution>): Partial<LLMAttribution> {
  return stripUndefined({
    teamId: cleanString(options.teamId),
    appId: cleanString(options.appId),
    featureId: cleanString(options.featureId),
    workflowId: cleanString(options.workflowId),
    businessUnit: cleanString(options.businessUnit),
    costCenter: cleanString(options.costCenter),
    product: cleanString(options.product),
    customerSegment: cleanString(options.customerSegment),
    endCustomerId: cleanString(options.endCustomerId),
    tenantId: cleanString(options.tenantId),
    release: cleanString(options.release),
    environment: cleanString(options.environment),
    actorId: cleanString(options.actorId),
    actorType: cleanString(options.actorType) as LLMAttribution['actorType'] | undefined,
    developerId: cleanString(options.developerId),
    cloudAccountId: cleanString(options.cloudAccountId),
    clusterId: cleanString(options.clusterId),
    repositoryId: cleanString(options.repositoryId),
  });
}

function resolveObserveCallAttribution(options: {
  attribution?: Partial<LLMAttribution>;
} & Partial<LLMAttribution>): Partial<LLMAttribution> {
  return stripUndefined({
    ...(options.attribution || {}),
    ...attributionFromFlatFields(options),
  });
}

function observeCallOptions<T>(options: ObserveCallOptions<T>): ObserveLLMCallOptions<T> {
  return {
    ...options,
    attribution: resolveObserveCallAttribution(options),
  };
}

function observeStreamCallOptions<TChunk>(options: ObserveStreamCallOptions<TChunk>): ObserveLLMStreamOptions<TChunk> {
  return {
    ...options,
    attribution: resolveObserveCallAttribution(options),
  };
}

function maxBufferedChunks(value: number | undefined): number {
  if (value === undefined) {
    return 256;
  }
  return Math.max(1, Math.min(10000, Math.trunc(value)));
}

class BufferedChunks<T> {
  private readonly chunks: T[] = [];
  private readonly capacity: number;
  private nextIndex = 0;
  private count = 0;

  constructor(maxChunks: number) {
    this.capacity = maxBufferedChunks(maxChunks);
  }

  push(chunk: T): void {
    if (this.count < this.capacity) {
      this.chunks.push(chunk);
      this.count += 1;
      return;
    }
    this.chunks[this.nextIndex] = chunk;
    this.nextIndex = (this.nextIndex + 1) % this.capacity;
  }

  values(): T[] {
    if (this.count < this.capacity) {
      return this.chunks.slice();
    }
    return [...this.chunks.slice(this.nextIndex), ...this.chunks.slice(0, this.nextIndex)];
  }
}

function toIso(value?: Date | string): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function cleanNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }
  return undefined;
}

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function cleanBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function cleanDecimal(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function fallbackSourceEventId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return `clop_evt_${randomUuid}`;
  }
  return `clop_evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function resolveSourceEventId(event: Partial<LLMUsageEvent>): string {
  return cleanString(event.sourceEventId)
    || cleanString(event.requestId)
    || cleanString(event.providerRequestId)
    || cleanString(event.traceId)
    || fallbackSourceEventId();
}

function cleanUsageMap(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const result: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const cleanedKey = key.trim().toLowerCase();
    const cleanedValue = cleanNumber(rawValue);
    if (cleanedKey && cleanedValue !== undefined && cleanedValue > 0) {
      result[cleanedKey] = (result[cleanedKey] || 0) + cleanedValue;
    }
  }
  return Object.keys(result).length ? result : undefined;
}

const DEFAULT_METADATA_PRIVACY_MODE: MetadataPrivacyMode = 'metadata_only';
const DEFAULT_METADATA_MAX_KEYS = 64;
const DEFAULT_METADATA_MAX_VALUE_LENGTH = 512;
const DEFAULT_METADATA_MAX_SERIALIZED_BYTES = 8192;
const DEFAULT_METADATA_REDACT_VALUE = '[redacted]';
const DEFAULT_SENSITIVE_METADATA_KEY_PATTERNS = [
  /authorization/i,
  /api[-_]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /cookie/i,
  /prompt/i,
  /completion/i,
  /message/i,
  /body/i,
  /content/i,
  /^input$/i,
  /^output$/i,
];
const STRICT_FINOPS_METADATA_KEYS = new Set([
  'route',
  'path',
  'method',
  'host',
  'status_code',
  'http_method',
  'http_route',
  'http_path',
  'http_host',
  'request_id',
  'trace_id',
  'provider_region',
  'provider_account',
  'service_name',
  'workspace',
  'tenant_slug',
  'org_slug',
  'customer_tier',
  'deployment',
  'region',
]);

type ResolvedMetadataPrivacyOptions = Required<Pick<MetadataPrivacyOptions,
  'mode' | 'maxKeys' | 'maxValueLength' | 'maxSerializedBytes' | 'redactValue'
>> & {
  allowlistKeys: Set<string>;
  denylistKeys: Set<string>;
  redactKeys: Set<string>;
  hashKeys: Set<string>;
  onMetadataDrop?: (info: MetadataDropInfo) => void;
};

function normalizeRuleKeys(values?: string[]): Set<string> {
  return new Set((values || [])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean));
}

function resolveMetadataPrivacyOptions(options?: MetadataPrivacyOptions): ResolvedMetadataPrivacyOptions {
  return {
    mode: options?.mode || DEFAULT_METADATA_PRIVACY_MODE,
    allowlistKeys: normalizeRuleKeys(options?.allowlistKeys),
    denylistKeys: normalizeRuleKeys(options?.denylistKeys),
    redactKeys: normalizeRuleKeys(options?.redactKeys),
    hashKeys: normalizeRuleKeys(options?.hashKeys),
    maxKeys: Math.max(1, Math.trunc(options?.maxKeys || DEFAULT_METADATA_MAX_KEYS)),
    maxValueLength: Math.max(1, Math.trunc(options?.maxValueLength || DEFAULT_METADATA_MAX_VALUE_LENGTH)),
    maxSerializedBytes: Math.max(256, Math.trunc(options?.maxSerializedBytes || DEFAULT_METADATA_MAX_SERIALIZED_BYTES)),
    redactValue: cleanString(options?.redactValue) || DEFAULT_METADATA_REDACT_VALUE,
    onMetadataDrop: options?.onMetadataDrop,
  };
}

function normalizeMetadataKey(value: string): string {
  return value.trim().toLowerCase();
}

function metadataRuleMatches(rules: Set<string>, keyPath: string, key: string): boolean {
  if (rules.size === 0) {
    return false;
  }
  const normalizedPath = normalizeMetadataKey(keyPath);
  const normalizedKey = normalizeMetadataKey(key);
  return rules.has(normalizedPath) || rules.has(normalizedKey);
}

function isSensitiveMetadataKey(keyPath: string, key: string): boolean {
  return DEFAULT_SENSITIVE_METADATA_KEY_PATTERNS.some((pattern) => pattern.test(keyPath) || pattern.test(key));
}

function hashMetadataValue(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `hash_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function emitMetadataDrop(
  options: ResolvedMetadataPrivacyOptions,
  keyPath: string,
  reason: MetadataDropReason,
): void {
  options.onMetadataDrop?.({
    keyPath,
    reason,
    mode: options.mode,
  });
}

function sanitizeMetadataValue(
  value: unknown,
  keyPath: string,
  key: string,
  options: ResolvedMetadataPrivacyOptions,
): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (metadataRuleMatches(options.denylistKeys, keyPath, key)) {
    emitMetadataDrop(options, keyPath, 'denylist');
    return undefined;
  }
  if (options.mode === 'allowlisted_metadata' && !metadataRuleMatches(options.allowlistKeys, keyPath, key)) {
    emitMetadataDrop(options, keyPath, 'allowlist');
    return undefined;
  }
  if (options.mode === 'strict_finops' && !STRICT_FINOPS_METADATA_KEYS.has(normalizeMetadataKey(key))) {
    emitMetadataDrop(options, keyPath, 'allowlist');
    return undefined;
  }
  if (metadataRuleMatches(options.hashKeys, keyPath, key)) {
    emitMetadataDrop(options, keyPath, 'hashed');
    return hashMetadataValue(value);
  }
  if (metadataRuleMatches(options.redactKeys, keyPath, key) || isSensitiveMetadataKey(keyPath, key)) {
    emitMetadataDrop(options, keyPath, 'redacted');
    return options.redactValue;
  }
  if (typeof value === 'string') {
    if (value.length > options.maxValueLength) {
      emitMetadataDrop(options, keyPath, 'truncated');
      return `${value.slice(0, options.maxValueLength)}…`;
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    const sanitized = value
      .map((entry, index) => sanitizeMetadataValue(entry, `${keyPath}[${index}]`, key, options))
      .filter((entry) => entry !== undefined);
    return sanitized.length ? sanitized : undefined;
  }
  if (typeof value === 'object') {
    const nested = sanitizeCustomMetadata(value as Record<string, unknown>, options, keyPath);
    return nested && Object.keys(nested).length ? nested : undefined;
  }
  emitMetadataDrop(options, keyPath, 'unsupported_value');
  return undefined;
}

function sanitizeCustomMetadata(
  metadata: Record<string, unknown> | undefined,
  options: ResolvedMetadataPrivacyOptions,
  prefix = '',
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }
  const result: Record<string, unknown> = {};
  let acceptedKeys = 0;
  for (const [rawKey, rawValue] of Object.entries(metadata)) {
    const key = rawKey.trim();
    if (!key) {
      continue;
    }
    const keyPath = prefix ? `${prefix}.${key}` : key;
    if (acceptedKeys >= options.maxKeys) {
      emitMetadataDrop(options, keyPath, 'max_keys');
      continue;
    }
    const sanitized = sanitizeMetadataValue(rawValue, keyPath, key, options);
    if (sanitized === undefined) {
      continue;
    }
    const candidate = { ...result, [key]: sanitized };
    if (JSON.stringify(candidate).length > options.maxSerializedBytes) {
      emitMetadataDrop(options, keyPath, 'max_serialized_bytes');
      continue;
    }
    result[key] = sanitized;
    acceptedKeys += 1;
  }
  return Object.keys(result).length ? result : undefined;
}

function stripUndefined(payload: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveDeliveryMode(mode?: string): InternalLLMObservabilityDeliveryMode {
  if (mode === INTERNAL_DUAL_DELIVERY_MODE) {
    if (!INTERNAL_DUAL_DELIVERY_MODE_ENABLED) {
      throw new Error('deliveryMode "dual" is temporarily disabled');
    }
    return INTERNAL_DUAL_DELIVERY_MODE;
  }
  return mode === 'otlp_http' ? mode : 'cloptima_http';
}

function resolveApiBaseUrl(apiBaseUrl?: string): string {
  return (cleanString(apiBaseUrl) || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

function resolveIngestUrl(apiBaseUrl: string): string {
  return `${resolveApiBaseUrl(apiBaseUrl)}${SDK_INGEST_PATH}`;
}

function resolveOtlpUrl(apiBaseUrl: string): string {
  return `${resolveApiBaseUrl(apiBaseUrl)}${OTLP_TRACES_PATH}`;
}

function shouldAttachDefaultOtlpAuthorization(otlpUrl: string): boolean {
  try {
    const parsed = new URL(otlpUrl);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'cloptima.ai' || hostname.endsWith('.cloptima.ai');
  } catch {
    return false;
  }
}

function unixNanoString(value: Date | string | undefined, fallbackMs: number): string {
  if (value instanceof Date) {
    return (BigInt(value.getTime()) * 1000000n).toString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return (BigInt(parsed.getTime()) * 1000000n).toString();
    }
  }
  return (BigInt(fallbackMs) * 1000000n).toString();
}

function otlpHex(length: number): string {
  const alphabet = '0123456789abcdef';
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(length / 2);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  }
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

function otlpAttributeValue(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'boolean') {
    return { boolValue: value };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? { intValue: value } : { doubleValue: value };
  }
  if (value && typeof value === 'object') {
    return { stringValue: JSON.stringify(value) };
  }
  return undefined;
}

function otlpAttributesFromPayload(payload: Record<string, unknown>): Array<Record<string, unknown>> {
  const metadata = payload.metadata && typeof payload.metadata === 'object'
    ? payload.metadata as Record<string, unknown>
    : {};
  const attributes: Array<[string, unknown]> = [
    ['gen_ai.system', cleanString(payload.provider)],
    ['gen_ai.request.model', cleanString(payload.model)],
    ['gen_ai.response.model', cleanString(payload.model)],
    ['gen_ai.request.id', cleanString(payload.request_id)],
    ['gen_ai.response.id', cleanString(payload.provider_request_id)],
    ['source_event_id', cleanString(payload.source_event_id)],
    ['gen_ai.usage.input_tokens', cleanNumber(payload.input_tokens)],
    ['gen_ai.usage.output_tokens', cleanNumber(payload.output_tokens)],
    ['gen_ai.usage.total_tokens', cleanNumber(payload.total_tokens)],
    ['gen_ai.usage.reasoning_tokens', cleanNumber(payload.reasoning_tokens)],
    ['gen_ai.usage.cached_input_tokens', cleanNumber(payload.cached_input_tokens)],
    ['gen_ai.usage.cost', cleanDecimal(payload.vendor_reported_cost_usd)],
    ['cache_hit', cleanBoolean(payload.cache_hit)],
    ['cloptima.request_id', cleanString(payload.request_id)],
    ['trace_id', cleanString(payload.trace_id)],
    ['team_id', cleanString(metadata.team_id)],
    ['app_id', cleanString(metadata.app_id)],
    ['environment', cleanString(metadata.environment)],
    ['feature_id', cleanString(metadata.feature_id)],
    ['workflow_id', cleanString(metadata.workflow_id)],
    ['business_unit', cleanString(metadata.business_unit)],
    ['cost_center', cleanString(metadata.cost_center)],
    ['product', cleanString(metadata.product)],
    ['customer_segment', cleanString(metadata.customer_segment)],
    ['end_customer_id', cleanString(metadata.end_customer_id)],
    ['tenant_id', cleanString(metadata.tenant_id)],
    ['release', cleanString(metadata.release)],
    ['actor_id', cleanString(metadata.actor_id)],
    ['actor_type', cleanString(metadata.actor_type)],
    ['developer_id', cleanString(metadata.developer_id)],
    ['cloud_account_id', cleanString(metadata.cloud_account_id)],
    ['cluster_id', cleanString(metadata.cluster_id)],
    ['repository_id', cleanString(metadata.repository_id)],
    ['agent_session_id', cleanString(metadata.agent_session_id)],
    ['agent_run_id', cleanString(metadata.agent_run_id)],
    ['parent_execution_id', cleanString(metadata.parent_execution_id)],
    ['agent_step_id', cleanString(metadata.agent_step_id)],
    ['tool_call_id', cleanString(metadata.tool_call_id)],
    ['tool_name', cleanString(metadata.tool_name)],
    ['retry_index', cleanNumber(metadata.retry_index)],
    ['loop_iteration', cleanNumber(metadata.loop_iteration)],
    ['upstream_ttfb_ms', cleanNumber(metadata.normalized_upstream_ttfb_ms ?? payload.upstream_ttfb_ms)],
    ['latency_ms', cleanNumber(metadata.normalized_latency_ms ?? payload.latency_ms)],
    ['sdk_name', cleanString(payload.sdk_name)],
    ['sdk_version', cleanString(payload.sdk_version)],
  ];
  for (const [key, value] of Object.entries(metadata)) {
    if (attributes.some(([existing]) => existing === key)) {
      continue;
    }
    attributes.push([key, value]);
  }
  return attributes.flatMap(([key, value]) => {
    const attrValue = otlpAttributeValue(value);
    return key && attrValue ? [{ key, value: attrValue }] : [];
  });
}

function payloadToOtlpRequest(
  payload: Record<string, unknown> | { events: Record<string, unknown>[] },
  sdkName: string,
  sdkVersion: string | undefined,
  serviceName: string,
  serviceVersion: string | undefined,
): Record<string, unknown> {
  const events = Array.isArray((payload as { events?: unknown }).events)
    ? ((payload as { events: Record<string, unknown>[] }).events)
    : [payload as Record<string, unknown>];
  const nowMs = Date.now();
  const spans = events.map((event) => {
    const startedAt = unixNanoString(
      typeof event.started_at === 'string' ? event.started_at : undefined,
      nowMs,
    );
    const latencyMs = cleanNumber(event.latency_ms);
    const completedFallback = latencyMs !== undefined ? nowMs + latencyMs : nowMs;
    const completedAt = unixNanoString(
      typeof event.completed_at === 'string' ? event.completed_at : undefined,
      completedFallback,
    );
    return {
      traceId: otlpHex(32),
      spanId: otlpHex(16),
      name: `llm.${cleanString(event.provider) || 'unknown'}.${cleanString(event.model) || 'unknown'}`,
      kind: 3,
      startTimeUnixNano: startedAt,
      endTimeUnixNano: completedAt,
      attributes: otlpAttributesFromPayload(event),
      status: {
        code: cleanString(event.status) === 'failed' ? 2 : 1,
        ...(cleanString(event.error_message) ? { message: cleanString(event.error_message) } : {}),
      },
    };
  });
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: serviceName } },
            ...(serviceVersion ? [{ key: 'service.version', value: { stringValue: serviceVersion } }] : []),
          ],
        },
        scopeSpans: [
          {
            scope: {
              name: sdkName,
              ...(sdkVersion ? { version: sdkVersion } : {}),
            },
            spans,
          },
        ],
      },
    ],
  };
}

function previewDefaultAttribution(options?: PayloadPreviewOptions): LLMAttribution {
  return {
    appId: cleanString(options?.defaultAttribution?.appId) || 'preview-app',
    environment: cleanString(options?.defaultAttribution?.environment) || 'preview',
    ...attributionFromFlatFields(options?.defaultAttribution || {}),
  };
}

function validateSinglePayload(payload: Record<string, unknown>, prefix: string): string[] {
  const errors: string[] = [];
  const status = cleanString(payload.status);
  const metadata = payload.metadata;

  if (cleanString(payload.schema_version) !== SDK_EVENT_SCHEMA_VERSION) {
    errors.push(`${prefix}.schema_version must equal ${SDK_EVENT_SCHEMA_VERSION}`);
  }
  if (!cleanString(payload.sdk_name)) {
    errors.push(`${prefix}.sdk_name is required`);
  }
  if (!cleanString(payload.source_event_id)) {
    errors.push(`${prefix}.source_event_id is required`);
  }
  if (!cleanString(payload.provider)) {
    errors.push(`${prefix}.provider is required`);
  }
  if (!cleanString(payload.model)) {
    errors.push(`${prefix}.model is required`);
  }
  if (status && !['succeeded', 'failed', 'partial', 'blocked'].includes(status)) {
    errors.push(`${prefix}.status must be one of succeeded, failed, partial, blocked`);
  }
  for (const key of ['input_tokens', 'output_tokens', 'total_tokens', 'reasoning_tokens', 'cached_input_tokens', 'latency_ms'] as const) {
    const value = payload[key];
    if (value !== undefined && cleanNumber(value) === undefined) {
      errors.push(`${prefix}.${key} must be a finite non-negative number when set`);
    }
  }
  if (metadata !== undefined && (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata))) {
    errors.push(`${prefix}.metadata must be an object when set`);
  }
  return errors;
}

export function previewEventPayload(
  event: LLMUsageEvent,
  options: PayloadPreviewOptions = {},
): Record<string, unknown> {
  return buildPayload(
    event,
    previewDefaultAttribution(options),
    cleanString(options.sdkName) || '@cloptima/llm-observability',
    resolveMetadataPrivacyOptions(options.metadataPrivacy),
    cleanString(options.sdkVersion),
  );
}

export function previewBatchPayload(
  events: LLMUsageEvent[],
  options: PayloadPreviewOptions = {},
): Record<string, unknown> {
  const payloads = events.map((event) => previewEventPayload(event, options));
  if (payloads.length === 1) {
    return payloads[0];
  }
  return {
    schema_version: SDK_BATCH_SCHEMA_VERSION,
    events: payloads,
  };
}

export function previewOtlpRequest(
  payload: Record<string, unknown> | { events: Record<string, unknown>[] },
  options: OtlpPreviewOptions = {},
): Record<string, unknown> {
  return payloadToOtlpRequest(
    payload,
    cleanString(options.sdkName) || '@cloptima/llm-observability',
    cleanString(options.sdkVersion),
    cleanString(options.serviceName) || 'cloptima-llm-observability',
    cleanString(options.serviceVersion),
  );
}

export function validatePayload(
  payload: Record<string, unknown> | { events?: unknown },
): PayloadValidationResult {
  const batchEvents = Array.isArray((payload as { events?: unknown }).events)
    ? ((payload as { events: unknown[] }).events)
    : undefined;
  const events = batchEvents || [payload];
  const errors = events.flatMap((event, index) => {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      return [`events[${index}] must be an object`];
    }
    return validateSinglePayload(event as Record<string, unknown>, `events[${index}]`);
  });
  if (batchEvents && cleanString((payload as Record<string, unknown>).schema_version) !== SDK_BATCH_SCHEMA_VERSION) {
    errors.unshift(`batch.schema_version must equal ${SDK_BATCH_SCHEMA_VERSION}`);
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function buildPayload(
  event: LLMUsageEvent,
  defaults: LLMAttribution,
  sdkName: string,
  metadataPrivacy: ResolvedMetadataPrivacyOptions,
  sdkVersion?: string,
): Record<string, unknown> {
  const attribution = { ...defaults, ...event };
  const inputTokens = cleanNumber(event.inputTokens);
  const outputTokens = cleanNumber(event.outputTokens);
  const totalTokens = cleanNumber(event.totalTokens) ?? (
    inputTokens !== undefined || outputTokens !== undefined ? (inputTokens || 0) + (outputTokens || 0) : undefined
  );
  const sanitizedCustomMetadata = sanitizeCustomMetadata(event.metadata, metadataPrivacy);

  return stripUndefined({
    schema_version: SDK_EVENT_SCHEMA_VERSION,
    sdk_name: sdkName,
    sdk_version: sdkVersion,
    source_event_id: resolveSourceEventId(event),
    request_id: cleanString(event.requestId),
    provider_request_id: cleanString(event.providerRequestId),
    trace_id: cleanString(event.traceId),
    provider: event.provider,
    model: event.model,
    status: event.status || 'succeeded',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    reasoning_tokens: cleanNumber(event.reasoningTokens),
    cached_input_tokens: cleanNumber(event.cachedInputTokens),
    extra_usage_units: cleanUsageMap(event.extraUsageUnits),
    cache_hit: event.cacheHit,
    vendor_reported_cost_usd: event.vendorReportedCostUsd,
    started_at: toIso(event.startedAt),
    completed_at: toIso(event.completedAt),
    latency_ms: cleanNumber(event.latencyMs),
    error_message: cleanString(event.errorMessage),
    metadata: stripUndefined({
      ...(sanitizedCustomMetadata || {}),
      ...stripUndefined({
        team_id: attribution.teamId,
        app_id: attribution.appId,
        feature_id: attribution.featureId,
        workflow_id: attribution.workflowId,
        business_unit: attribution.businessUnit,
        cost_center: attribution.costCenter,
        product: attribution.product,
        customer_segment: attribution.customerSegment,
        end_customer_id: attribution.endCustomerId,
        tenant_id: attribution.tenantId,
        release: attribution.release,
        environment: attribution.environment,
        actor_id: attribution.actorId,
        actor_type: attribution.actorType,
        developer_id: attribution.developerId,
        cloud_account_id: attribution.cloudAccountId,
        cluster_id: attribution.clusterId,
        repository_id: attribution.repositoryId,
        agent_session_id: event.agentSessionId,
        agent_run_id: event.agentRunId,
        parent_execution_id: event.parentExecutionId,
        agent_step_id: event.agentStepId,
        tool_call_id: event.toolCallId,
        tool_name: event.toolName,
        retry_index: cleanNumber(event.retryIndex),
        loop_iteration: cleanNumber(event.loopIteration),
      }),
    }),
  });
}

function maybeJsonResponse(
  response: Response,
  onParseError?: (error: unknown) => void,
): Promise<Record<string, unknown> | undefined> {
  const contentType = response.headers.get('content-type') || '';
  if (!/json/i.test(contentType)) {
    return Promise.resolve(undefined);
  }
  return response.clone().json()
    .then((value) => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined))
    .catch((error) => {
      onParseError?.(error);
      return undefined;
    });
}

function headerValue(headers: Headers, key: string): string | undefined {
  return cleanString(headers.get(key));
}

function fetchProviderRequestId(headers: Headers, explicitHeader?: string): string | undefined {
  return cleanString(
    explicitHeader ? headers.get(explicitHeader) : undefined,
  ) || headerValue(headers, 'x-request-id')
    || headerValue(headers, 'request-id')
    || headerValue(headers, 'openai-request-id')
    || headerValue(headers, 'anthropic-request-id')
    || headerValue(headers, 'x-anthropic-request-id');
}

export class CloptimaLLMObservability implements LLMObservabilityClient {
  private readonly options: CloptimaLLMClientOptions & { apiBaseUrl: string };
  private readonly fetchImpl: CloptimaFetch;
  private readonly sdkName: string;
  private readonly deliveryMode: InternalLLMObservabilityDeliveryMode;
  private readonly ingestUrl: string;
  private readonly otlpUrl: string;
  private readonly otlpHeaders: Record<string, string>;
  private readonly otlpServiceName: string;
  private readonly otlpServiceVersion?: string;
  private readonly asyncQueueMaxSize: number;
  private readonly asyncBatchSize: number;
  private readonly asyncFlushIntervalMs: number;
  private readonly asyncRetryCount: number;
  private readonly asyncRetryBackoffMs: number;
  private readonly asyncRetryJitterRatio: number;
  private readonly metadataPrivacy: ResolvedMetadataPrivacyOptions;
  private asyncQueue: Record<string, unknown>[] = [];
  private asyncTimer?: ReturnType<typeof setTimeout>;
  private workerActive = false;
  private closed = false;
  private drainedWaiters: Array<() => void> = [];
  private droppedEvents = 0;
  private deliveredEvents = 0;
  private failedBatches = 0;

  constructor(options: CloptimaLLMClientOptions) {
    this.options = {
      ...options,
      apiBaseUrl: resolveApiBaseUrl(options.apiBaseUrl),
    };
    this.fetchImpl = requireFetch(this.options.fetchImpl);
    this.sdkName = this.options.sdkName || '@cloptima/llm-observability';
    this.deliveryMode = resolveDeliveryMode(this.options.deliveryMode);
    this.ingestUrl = resolveIngestUrl(this.options.apiBaseUrl);
    this.otlpUrl = resolveOtlpUrl(this.options.apiBaseUrl);
    this.otlpHeaders = this.options.otlpHeaders || {};
    this.otlpServiceName = this.options.otlpServiceName || 'cloptima-llm-observability';
    this.otlpServiceVersion = this.options.otlpServiceVersion;
    this.asyncQueueMaxSize = Math.max(1, Math.trunc(this.options.asyncQueueMaxSize ?? 1000));
    this.asyncBatchSize = Math.max(1, Math.trunc(this.options.asyncBatchSize ?? 20));
    this.asyncFlushIntervalMs = Math.max(0, Math.trunc(this.options.asyncFlushIntervalMs ?? 250));
    this.asyncRetryCount = Math.max(0, Math.trunc(this.options.asyncRetryCount ?? 2));
    this.asyncRetryBackoffMs = Math.max(0, Math.trunc(this.options.asyncRetryBackoffMs ?? 100));
    this.asyncRetryJitterRatio = Math.max(0, Math.min(1, Number(this.options.asyncRetryJitterRatio ?? 0.2)));
    this.metadataPrivacy = resolveMetadataPrivacyOptions(this.options.metadataPrivacy);
  }

  isEnabled(): boolean {
    return true;
  }

  getInitError(): Error | undefined {
    return undefined;
  }

  async record(event: LLMUsageEvent): Promise<void> {
    await this.postPayload(this.eventPayload(event));
  }

  async recordBatch(events: LLMUsageEvent[]): Promise<void> {
    const payloads = events.map((event) => this.eventPayload(event));
    if (payloads.length === 0) {
      return;
    }
    if (payloads.length === 1) {
      await this.postPayload(payloads[0]);
      return;
    }
    await this.postPayload({ schema_version: SDK_BATCH_SCHEMA_VERSION, events: payloads });
  }

  private otlpRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...this.otlpHeaders,
    };
    const hasExplicitAuthorization = Object.keys(headers).some((key) => key.toLowerCase() === 'authorization');
    if (!hasExplicitAuthorization && shouldAttachDefaultOtlpAuthorization(this.otlpUrl)) {
      headers.authorization = `Bearer ${this.options.apiKey}`;
    }
    return headers;
  }

  private async postPayload(payload: Record<string, unknown>): Promise<void> {
    const requestPayload = this.payloadWithEnvelopeMetadata(payload);
    let cloptimaError: unknown;
    if (this.deliveryMode === 'cloptima_http' || this.deliveryMode === INTERNAL_DUAL_DELIVERY_MODE) {
      try {
        await this.withRetries(async () => {
          const response = await this.fetchImpl(this.ingestUrl, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${this.options.apiKey}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(requestPayload),
          });
          if (!response.ok) {
            throw new Error(`Cloptima LLM ingest failed with HTTP ${response.status}`);
          }
        });
      } catch (error) {
        cloptimaError = error;
        if (this.deliveryMode === INTERNAL_DUAL_DELIVERY_MODE) {
          this.options.onError?.(error);
        }
      }
    }
    if (this.deliveryMode === 'otlp_http' || this.deliveryMode === INTERNAL_DUAL_DELIVERY_MODE) {
      const otlpPayload = payloadToOtlpRequest(
        requestPayload,
        this.sdkName,
        this.options.sdkVersion,
        this.otlpServiceName,
        this.otlpServiceVersion,
      );
      try {
        await this.withRetries(async () => {
          const response = await this.fetchImpl(this.otlpUrl, {
            method: 'POST',
            headers: this.otlpRequestHeaders(),
            body: JSON.stringify(otlpPayload),
          });
          if (!response.ok) {
            throw new Error(`Cloptima OTLP ingest failed with HTTP ${response.status}`);
          }
        });
      } catch (error) {
        if (this.deliveryMode === 'otlp_http') {
          throw error;
        }
        this.options.onError?.(error);
        if (cloptimaError) {
          throw cloptimaError;
        }
        return;
      }
    }
    if (cloptimaError) {
      throw cloptimaError;
    }
  }

  private async withRetries(call: () => Promise<void>): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.asyncRetryCount; attempt += 1) {
      try {
        await call();
        return;
      } catch (error) {
        lastError = error;
        if (attempt >= this.asyncRetryCount) {
          break;
        }
        await sleep(this.retryDelayMs(attempt));
      }
    }
    throw lastError;
  }

  private retryDelayMs(attempt: number): number {
    const baseDelay = this.asyncRetryBackoffMs * (2 ** attempt);
    if (baseDelay <= 0 || this.asyncRetryJitterRatio <= 0) {
      return baseDelay;
    }
    const jitter = baseDelay * this.asyncRetryJitterRatio * Math.random();
    return Math.round(baseDelay + jitter);
  }

  recordAsync(event: LLMUsageEvent): void {
    this.recordAsyncWithPrivacy(event);
  }

  getStats(): CloptimaLLMClientStats {
    return {
      queuedEvents: this.asyncQueue.length,
      droppedEvents: this.droppedEvents,
      deliveredEvents: this.deliveredEvents,
      failedBatches: this.failedBatches,
    };
  }

  stats(): CloptimaLLMClientStats {
    return this.getStats();
  }

  private eventPayload(
    event: LLMUsageEvent,
    metadataPrivacyOverride?: MetadataPrivacyOptions,
  ): Record<string, unknown> {
    return buildPayload(
      event,
      this.options.defaultAttribution,
      this.sdkName,
      metadataPrivacyOverride ? resolveMetadataPrivacyOptions(metadataPrivacyOverride) : this.metadataPrivacy,
      this.options.sdkVersion,
    );
  }

  private recordAsyncWithPrivacy(
    event: LLMUsageEvent,
    metadataPrivacyOverride?: MetadataPrivacyOptions,
  ): void {
    if (this.closed) {
      this.droppedEvents += 1;
      this.options.onDrop?.(event, 'client_closed');
      this.options.onError?.(new Error('Cloptima LLM observability client is closed'));
      return;
    }
    if (this.asyncQueue.length >= this.asyncQueueMaxSize) {
      this.droppedEvents += 1;
      this.options.onDrop?.(event, 'queue_full');
      this.options.onError?.(new Error('Cloptima LLM observability async queue is full'));
      return;
    }
    this.asyncQueue.push(this.eventPayload(event, metadataPrivacyOverride));
    this.scheduleAsyncDrain();
  }

  private currentDeliveryStats(): Record<string, unknown> {
    const stats = this.getStats();
    const totalHandled = stats.droppedEvents + stats.deliveredEvents;
    return stripUndefined({
      queued_events: stats.queuedEvents,
      dropped_events: stats.droppedEvents,
      delivered_events: stats.deliveredEvents,
      failed_batches: stats.failedBatches,
      drop_rate: totalHandled > 0 ? Number((stats.droppedEvents / totalHandled).toFixed(4)) : undefined,
      recorded_at: new Date().toISOString(),
    });
  }

  private payloadWithEnvelopeMetadata(payload: Record<string, unknown>): Record<string, unknown> {
    return stripUndefined({
      ...payload,
      sdk_delivery_stats: this.currentDeliveryStats(),
      ...(Array.isArray((payload as { events?: unknown }).events) ? { batch_schema_version: SDK_BATCH_SCHEMA_VERSION } : {}),
    });
  }

  async flush(timeoutMs?: number): Promise<boolean> {
    this.clearAsyncTimer();
    void this.drainAsyncQueue();
    if (!this.workerActive && this.asyncQueue.length === 0) {
      return true;
    }
    const waitForDrain = new Promise<void>((resolve) => {
      this.drainedWaiters.push(resolve);
    });
    if (timeoutMs === undefined) {
      await waitForDrain;
      return true;
    }
    return Promise.race([
      waitForDrain.then(() => true),
      sleep(Math.max(0, timeoutMs)).then(() => false),
    ]);
  }

  async close(timeoutMs = 5000): Promise<boolean> {
    this.closed = true;
    return this.flush(timeoutMs);
  }

  private scheduleAsyncDrain(): void {
    if (this.asyncTimer || this.workerActive) {
      return;
    }
    this.asyncTimer = setTimeout(() => {
      this.asyncTimer = undefined;
      void this.drainAsyncQueue();
    }, this.asyncFlushIntervalMs);
  }

  private clearAsyncTimer(): void {
    if (this.asyncTimer) {
      clearTimeout(this.asyncTimer);
      this.asyncTimer = undefined;
    }
  }

  private async drainAsyncQueue(): Promise<void> {
    if (this.workerActive) {
      return;
    }
    this.workerActive = true;
    try {
      while (this.asyncQueue.length > 0) {
        const batch = this.asyncQueue.splice(0, this.asyncBatchSize);
        try {
          await this.postPayload(batch.length === 1 ? batch[0] : { schema_version: SDK_BATCH_SCHEMA_VERSION, events: batch });
          this.deliveredEvents += batch.length;
        } catch (error) {
          this.failedBatches += 1;
          this.options.onError?.(error);
        }
      }
    } finally {
      this.workerActive = false;
      this.resolveDrainedWaiters();
      if (this.asyncQueue.length > 0) {
        this.scheduleAsyncDrain();
      }
    }
  }

  private resolveDrainedWaiters(): void {
    if (this.workerActive || this.asyncQueue.length > 0) {
      return;
    }
    const waiters = this.drainedWaiters.splice(0);
    for (const resolve of waiters) {
      resolve();
    }
  }

  async observe<T>(options: ObserveLLMCallOptions<T>): Promise<T> {
    const startedAt = new Date();
    try {
      const response = await options.call();
      const completedAt = new Date();
      const extracted = options.extractUsage ? options.extractUsage(response) : {};
      const event: LLMUsageEvent = {
        ...options.attribution,
        ...extracted,
        ...agentEventFields(options.agent),
        provider: extracted.provider || options.provider,
        model: extracted.model || options.model,
        requestId: extracted.requestId || options.requestId,
        traceId: extracted.traceId || options.traceId,
        status: 'succeeded',
        startedAt,
        completedAt,
        latencyMs: completedAt.getTime() - startedAt.getTime(),
        metadata: {
          ...(options.metadata || {}),
          ...(extracted.metadata || {}),
        },
      };
      if (options.fireAndForget === false) {
        await this.postPayload(this.eventPayload(event, options.metadataPrivacy));
      } else {
        this.recordAsyncWithPrivacy(event, options.metadataPrivacy);
      }
      return response;
    } catch (error) {
      const completedAt = new Date();
      const event: LLMUsageEvent = {
        ...options.attribution,
        ...agentEventFields(options.agent),
        provider: options.provider,
        model: options.model,
        requestId: options.requestId,
        traceId: options.traceId,
        status: 'failed',
        startedAt,
        completedAt,
        latencyMs: completedAt.getTime() - startedAt.getTime(),
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          ...(options.metadata || {}),
        },
      };
      if (options.fireAndForget === false) {
        await this.postPayload(this.eventPayload(event, options.metadataPrivacy));
      } else {
        this.recordAsyncWithPrivacy(event, options.metadataPrivacy);
      }
      throw error;
    }
  }

  async observeCall<T>(options: ObserveCallOptions<T>): Promise<T> {
    return this.observe(observeCallOptions(options));
  }

  async *observeStream<TChunk>(options: ObserveLLMStreamOptions<TChunk>): AsyncGenerator<TChunk, void, unknown> {
    const startedAt = new Date();
    const chunks = new BufferedChunks<TChunk>(maxBufferedChunks(options.maxBufferedChunks));
    let emittedChunks = 0;
    try {
      const stream = await options.call();
      if ((stream as AsyncIterable<TChunk>)[Symbol.asyncIterator]) {
        for await (const chunk of stream as AsyncIterable<TChunk>) {
          emittedChunks += 1;
          if (options.extractUsage) {
            chunks.push(chunk);
          }
          yield chunk;
        }
      } else {
        for (const chunk of stream as Iterable<TChunk>) {
          emittedChunks += 1;
          if (options.extractUsage) {
            chunks.push(chunk);
          }
          yield chunk;
        }
      }
      const completedAt = new Date();
      const extracted = options.extractUsage ? options.extractUsage(chunks.values()) : {};
      const event: LLMUsageEvent = {
        ...options.attribution,
        ...extracted,
        ...agentEventFields(options.agent),
        provider: extracted.provider || options.provider,
        model: extracted.model || options.model,
        requestId: extracted.requestId || options.requestId,
        traceId: extracted.traceId || options.traceId,
        status: 'succeeded',
        startedAt,
        completedAt,
        latencyMs: completedAt.getTime() - startedAt.getTime(),
        metadata: {
          ...(options.metadata || {}),
          ...(extracted.metadata || {}),
          streamed: true,
        },
      };
      if (options.fireAndForget === true) {
        this.recordAsyncWithPrivacy(event, options.metadataPrivacy);
      } else {
        await this.postPayload(this.eventPayload(event, options.metadataPrivacy));
      }
    } catch (error) {
      const completedAt = new Date();
      const event: LLMUsageEvent = {
        ...options.attribution,
        ...agentEventFields(options.agent),
        provider: options.provider,
        model: options.model,
        requestId: options.requestId,
        traceId: options.traceId,
        status: emittedChunks > 0 ? 'partial' : 'failed',
        startedAt,
        completedAt,
        latencyMs: completedAt.getTime() - startedAt.getTime(),
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          ...(options.metadata || {}),
          streamed: true,
          stream_chunks: emittedChunks,
        },
      };
      if (options.fireAndForget === true) {
        this.recordAsyncWithPrivacy(event, options.metadataPrivacy);
      } else {
        await this.postPayload(this.eventPayload(event, options.metadataPrivacy));
      }
      throw error;
    }
  }

  async *observeStreamCall<TChunk>(
    options: ObserveStreamCallOptions<TChunk>,
  ): AsyncGenerator<TChunk, void, unknown> {
    for await (const chunk of this.observeStream(observeStreamCallOptions(options))) {
      yield chunk;
    }
  }
}

export class DisabledCloptimaLLMObservability implements LLMObservabilityClient {
  constructor(private readonly initError?: Error) {}

  isEnabled(): boolean {
    return false;
  }

  getInitError(): Error | undefined {
    return this.initError;
  }

  async record(_event: LLMUsageEvent): Promise<void> {}

  async recordBatch(_events: LLMUsageEvent[]): Promise<void> {}

  recordAsync(_event: LLMUsageEvent): void {}

  getStats(): CloptimaLLMClientStats {
    return {
      queuedEvents: 0,
      droppedEvents: 0,
      deliveredEvents: 0,
      failedBatches: 0,
    };
  }

  stats(): CloptimaLLMClientStats {
    return this.getStats();
  }

  async flush(_timeoutMs?: number): Promise<boolean> {
    return true;
  }

  async close(_timeoutMs = 5000): Promise<boolean> {
    return true;
  }

  async observe<T>(options: ObserveLLMCallOptions<T>): Promise<T> {
    return await options.call();
  }

  async observeCall<T>(options: ObserveCallOptions<T>): Promise<T> {
    return this.observe(observeCallOptions(options));
  }

  async *observeStream<TChunk>(options: ObserveLLMStreamOptions<TChunk>): AsyncGenerator<TChunk, void, unknown> {
    const stream = await options.call();
    if ((stream as AsyncIterable<TChunk>)[Symbol.asyncIterator]) {
      for await (const chunk of stream as AsyncIterable<TChunk>) {
        yield chunk;
      }
      return;
    }
    for (const chunk of stream as Iterable<TChunk>) {
      yield chunk;
    }
  }

  async *observeStreamCall<TChunk>(options: ObserveStreamCallOptions<TChunk>): AsyncGenerator<TChunk, void, unknown> {
    for await (const chunk of this.observeStream(observeStreamCallOptions(options))) {
      yield chunk;
    }
  }
}

function initOptionsEnv(options?: InitFromEnvOptions): Record<string, string | undefined> {
  return options?.env || currentEnv();
}

function initEnabledFlag(options?: InitFromEnvOptions): boolean | undefined {
  return options?.enabled ?? parseBooleanEnv(initOptionsEnv(options)[INIT_ENABLED_ENV]);
}

function initError(options: InitFromEnvOptions | undefined, message: string): Error {
  const error = new Error(message);
  options?.onInitError?.(error);
  if (options?.strict) {
    throw error;
  }
  return error;
}

function resolvedInitAttribution(options: InitFromEnvOptions | undefined): Partial<LLMAttribution> {
  const env = initOptionsEnv(options);
  return stripUndefined({
    teamId: cleanString(options?.defaultAttribution?.teamId) || cleanString(env[INIT_TEAM_ID_ENV]),
    appId: cleanString(options?.defaultAttribution?.appId) || cleanString(env[INIT_APP_ID_ENV]),
    featureId: cleanString(options?.defaultAttribution?.featureId),
    workflowId: cleanString(options?.defaultAttribution?.workflowId),
    businessUnit: cleanString(options?.defaultAttribution?.businessUnit),
    costCenter: cleanString(options?.defaultAttribution?.costCenter),
    product: cleanString(options?.defaultAttribution?.product),
    customerSegment: cleanString(options?.defaultAttribution?.customerSegment),
    endCustomerId: cleanString(options?.defaultAttribution?.endCustomerId),
    tenantId: cleanString(options?.defaultAttribution?.tenantId),
    release: cleanString(options?.defaultAttribution?.release),
    environment: cleanString(options?.defaultAttribution?.environment) || cleanString(env[INIT_ENVIRONMENT_ENV]) || 'production',
    actorId: cleanString(options?.defaultAttribution?.actorId),
    actorType: cleanString(options?.defaultAttribution?.actorType) as LLMAttribution['actorType'] | undefined,
    developerId: cleanString(options?.defaultAttribution?.developerId),
    cloudAccountId: cleanString(options?.defaultAttribution?.cloudAccountId),
    clusterId: cleanString(options?.defaultAttribution?.clusterId),
    repositoryId: cleanString(options?.defaultAttribution?.repositoryId),
  });
}

export function isEnabled(options?: InitFromEnvOptions): boolean {
  const env = initOptionsEnv(options);
  const enabledFlag = initEnabledFlag(options);
  if (enabledFlag === false) {
    return false;
  }
  const attribution = resolvedInitAttribution(options);
  return Boolean(cleanString(options?.apiKey) || cleanString(env[INIT_API_KEY_ENV]))
    && Boolean(attribution.appId);
}

export function disabledClient(initErrorValue?: Error): DisabledCloptimaLLMObservability {
  return new DisabledCloptimaLLMObservability(initErrorValue);
}

export function initFromEnv(
  options?: InitFromEnvOptions,
): LLMObservabilityClient {
  const env = initOptionsEnv(options);
  const enabledFlag = initEnabledFlag(options);
  if (enabledFlag === false) {
    return disabledClient();
  }

  const apiBaseUrl = cleanString(options?.apiBaseUrl) || cleanString(env[INIT_API_BASE_URL_ENV]) || DEFAULT_API_BASE_URL;
  const apiKey = cleanString(options?.apiKey) || cleanString(env[INIT_API_KEY_ENV]);
  const defaultAttribution = resolvedInitAttribution(options);

  const missingFields = [
    !apiKey ? INIT_API_KEY_ENV : undefined,
    !defaultAttribution.appId ? INIT_APP_ID_ENV : undefined,
  ].filter(Boolean);

  if (missingFields.length > 0) {
    if (enabledFlag === true) {
      return disabledClient(initError(options, `Cloptima LLM observability is enabled but missing required configuration: ${missingFields.join(', ')}`));
    }
    return disabledClient();
  }

  const {
    env: _env,
    enabled: _enabled,
    strict: _strict,
    onInitError: _onInitError,
    defaultAttribution: _defaultAttribution,
    ...clientOptions
  } = options || {};

  return new CloptimaLLMObservability({
    ...clientOptions,
    apiBaseUrl: apiBaseUrl || '',
    apiKey: apiKey || '',
    defaultAttribution: defaultAttribution as LLMAttribution,
    deliveryMode: options?.deliveryMode || cleanString(env[INIT_DELIVERY_MODE_ENV]) as LLMObservabilityDeliveryMode | undefined,
    otlpServiceName: options?.otlpServiceName || cleanString(env[INIT_OTLP_SERVICE_NAME_ENV]),
    otlpServiceVersion: options?.otlpServiceVersion || cleanString(env[INIT_OTLP_SERVICE_VERSION_ENV]),
  });
}

export function extractOpenAIUsage(response: Record<string, unknown>): Partial<LLMUsageEvent> {
  const usage = response.usage && typeof response.usage === 'object'
    ? response.usage as Record<string, unknown>
    : {};
  const promptDetails = usage.prompt_tokens_details && typeof usage.prompt_tokens_details === 'object'
    ? usage.prompt_tokens_details as Record<string, unknown>
    : {};
  const completionDetails = usage.completion_tokens_details && typeof usage.completion_tokens_details === 'object'
    ? usage.completion_tokens_details as Record<string, unknown>
    : {};

  return {
    provider: 'openai',
    providerRequestId: cleanString(response.id),
    model: cleanString(response.model),
    inputTokens: cleanNumber(usage.prompt_tokens),
    outputTokens: cleanNumber(usage.completion_tokens),
    totalTokens: cleanNumber(usage.total_tokens),
    reasoningTokens: cleanNumber(completionDetails.reasoning_tokens),
    cachedInputTokens: cleanNumber(promptDetails.cached_tokens),
    extraUsageUnits: cleanUsageMap({
      cache_write: promptDetails.cache_creation_input_tokens,
      cache_write_5m: promptDetails.cache_creation_input_tokens_5m,
      cache_write_1h: promptDetails.cache_creation_input_tokens_1h,
    }),
    cacheHit: cleanNumber(promptDetails.cached_tokens) ? true : undefined,
  };
}

export function extractOpenAIStreamUsage(chunks: Array<Record<string, unknown>>): Partial<LLMUsageEvent> {
  let lastWithUsage: Record<string, unknown> | undefined;
  let providerRequestId: string | undefined;
  let model: string | undefined;
  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== 'object') {
      continue;
    }
    providerRequestId = cleanString(chunk.id) || providerRequestId;
    model = cleanString(chunk.model) || model;
    if (chunk.usage && typeof chunk.usage === 'object') {
      lastWithUsage = chunk;
    }
  }
  if (!lastWithUsage) {
    return { providerRequestId, model };
  }
  const extracted = extractOpenAIUsage(lastWithUsage);
  return {
    ...extracted,
    providerRequestId: extracted.providerRequestId || providerRequestId,
    model: extracted.model || model,
  };
}

export function extractAzureOpenAIUsage(response: Record<string, unknown>): Partial<LLMUsageEvent> {
  const extracted = extractOpenAIUsage(response);
  return {
    ...extracted,
    provider: 'azure_openai',
    model: extracted.model || cleanString(response.deployment_name) || cleanString(response.deployment) || cleanString(response.model),
  };
}

export function extractAnthropicUsage(response: Record<string, unknown>): Partial<LLMUsageEvent> {
  const usage = response.usage && typeof response.usage === 'object'
    ? response.usage as Record<string, unknown>
    : {};
  const inputTokens = cleanNumber(usage.input_tokens);
  const outputTokens = cleanNumber(usage.output_tokens);
  const cachedInputTokens = cleanNumber(usage.cache_read_input_tokens);
  return {
    provider: 'anthropic',
    providerRequestId: cleanString(response.id),
    model: cleanString(response.model),
    inputTokens,
    outputTokens,
    totalTokens: cleanNumber(usage.total_tokens) ?? (
      inputTokens !== undefined || outputTokens !== undefined ? (inputTokens || 0) + (outputTokens || 0) : undefined
    ),
    cachedInputTokens,
    extraUsageUnits: cleanUsageMap({
      cache_write: usage.cache_creation_input_tokens,
      cache_write_5m: usage.cache_creation_input_tokens_5m,
      cache_write_1h: usage.cache_creation_input_tokens_1h,
      server_tool_use: usage.server_tool_use,
    }),
    cacheHit: cachedInputTokens ? true : undefined,
  };
}

export function extractAnthropicStreamUsage(chunks: Array<Record<string, unknown>>): Partial<LLMUsageEvent> {
  let providerRequestId: string | undefined;
  let model: string | undefined;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let cachedInputTokens: number | undefined;
  let cacheWriteTokens: number | undefined;
  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== 'object') {
      continue;
    }
    let usage: Record<string, unknown> = {};
    if (chunk.message && typeof chunk.message === 'object') {
      const message = chunk.message as Record<string, unknown>;
      providerRequestId = cleanString(message.id) || providerRequestId;
      model = cleanString(message.model) || model;
      usage = message.usage && typeof message.usage === 'object' ? message.usage as Record<string, unknown> : {};
    } else if (chunk.usage && typeof chunk.usage === 'object') {
      usage = chunk.usage as Record<string, unknown>;
    }
    inputTokens = cleanNumber(usage.input_tokens) ?? inputTokens;
    outputTokens = cleanNumber(usage.output_tokens) ?? outputTokens;
    cachedInputTokens = cleanNumber(usage.cache_read_input_tokens) ?? cachedInputTokens;
    cacheWriteTokens = cleanNumber(usage.cache_creation_input_tokens) ?? cacheWriteTokens;
  }
  const totalTokens = inputTokens !== undefined || outputTokens !== undefined ? (inputTokens || 0) + (outputTokens || 0) : undefined;
  return {
    provider: 'anthropic',
    providerRequestId,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens,
    extraUsageUnits: cleanUsageMap({ cache_write: cacheWriteTokens }),
    cacheHit: cachedInputTokens ? true : undefined,
  };
}

export function extractGeminiUsage(response: Record<string, unknown>): Partial<LLMUsageEvent> {
  let usage = response.usageMetadata && typeof response.usageMetadata === 'object'
    ? response.usageMetadata as Record<string, unknown>
    : {};
  if (!Object.keys(usage).length) {
    usage = response.usage_metadata && typeof response.usage_metadata === 'object'
      ? response.usage_metadata as Record<string, unknown>
      : {};
  }
  const cachedInputTokens = cleanNumber(usage.cachedContentTokenCount ?? usage.cached_content_token_count);
  return {
    provider: cleanString(response.provider) || 'gemini',
    providerRequestId: cleanString(response.responseId) || cleanString(response.response_id) || cleanString(response.id) || cleanString(response.name),
    model: cleanString(response.modelVersion) || cleanString(response.model_version) || cleanString(response.model),
    inputTokens: cleanNumber(usage.promptTokenCount ?? usage.prompt_token_count),
    outputTokens: cleanNumber(usage.candidatesTokenCount ?? usage.candidates_token_count),
    totalTokens: cleanNumber(usage.totalTokenCount ?? usage.total_token_count),
    reasoningTokens: cleanNumber(usage.thoughtsTokenCount ?? usage.thoughts_token_count),
    cachedInputTokens,
    cacheHit: cachedInputTokens ? true : undefined,
  };
}

export function extractVertexUsage(response: Record<string, unknown>): Partial<LLMUsageEvent> {
  return {
    ...extractGeminiUsage(response),
    provider: 'vertex_ai',
  };
}

export function extractGeminiStreamUsage(chunks: Array<Record<string, unknown>>): Partial<LLMUsageEvent> {
  let lastWithUsage: Record<string, unknown> | undefined;
  let providerRequestId: string | undefined;
  let model: string | undefined;
  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== 'object') {
      continue;
    }
    providerRequestId = cleanString(chunk.responseId) || cleanString(chunk.response_id) || cleanString(chunk.id) || cleanString(chunk.name) || providerRequestId;
    model = cleanString(chunk.modelVersion) || cleanString(chunk.model_version) || cleanString(chunk.model) || model;
    if (
      (chunk.usageMetadata && typeof chunk.usageMetadata === 'object')
      || (chunk.usage_metadata && typeof chunk.usage_metadata === 'object')
    ) {
      lastWithUsage = chunk;
    }
  }
  if (!lastWithUsage) {
    return { provider: 'gemini', providerRequestId, model };
  }
  const extracted = extractGeminiUsage(lastWithUsage);
  return {
    ...extracted,
    providerRequestId: extracted.providerRequestId || providerRequestId,
    model: extracted.model || model,
  };
}

export function extractVertexStreamUsage(chunks: Array<Record<string, unknown>>): Partial<LLMUsageEvent> {
  return {
    ...extractGeminiStreamUsage(chunks),
    provider: 'vertex_ai',
  };
}

export function extractBedrockUsage(response: Record<string, unknown>): Partial<LLMUsageEvent> {
  const usage = response.usage && typeof response.usage === 'object'
    ? response.usage as Record<string, unknown>
    : {};
  const metrics = response.metrics && typeof response.metrics === 'object'
    ? response.metrics as Record<string, unknown>
    : {};
  const metadata = response.ResponseMetadata && typeof response.ResponseMetadata === 'object'
    ? response.ResponseMetadata as Record<string, unknown>
    : {};
  return {
    provider: 'bedrock',
    providerRequestId: cleanString(response.requestId) || cleanString(response.request_id) || cleanString(metadata.RequestId),
    model: cleanString(response.modelId) || cleanString(response.model_id) || cleanString(response.model),
    inputTokens: cleanNumber(usage.inputTokens ?? usage.input_tokens),
    outputTokens: cleanNumber(usage.outputTokens ?? usage.output_tokens),
    totalTokens: cleanNumber(usage.totalTokens ?? usage.total_tokens),
    latencyMs: cleanNumber(metrics.latencyMs ?? metrics.latency_ms),
  };
}

/**
 * Aggregates Amazon Bedrock streaming usage deltas. Bedrock stream chunks report
 * token increments, unlike Gemini/Vertex streams where usage is cumulative in
 * the final metadata chunk.
 */
export function extractBedrockStreamUsage(chunks: Array<Record<string, unknown>>): Partial<LLMUsageEvent> {
  let providerRequestId: string | undefined;
  let model: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens: number | undefined;
  let sawUsage = false;
  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== 'object') {
      continue;
    }
    providerRequestId = cleanString(chunk.requestId) || cleanString(chunk.request_id) || providerRequestId;
    model = cleanString(chunk.modelId) || cleanString(chunk.model_id) || cleanString(chunk.model) || model;
    const usage = chunk.usage && typeof chunk.usage === 'object' ? chunk.usage as Record<string, unknown> : undefined;
    if (!usage) {
      continue;
    }
    const input = cleanNumber(usage.inputTokens ?? usage.input_tokens);
    const output = cleanNumber(usage.outputTokens ?? usage.output_tokens);
    const total = cleanNumber(usage.totalTokens ?? usage.total_tokens);
    if (input !== undefined) {
      inputTokens += input;
      sawUsage = true;
    }
    if (output !== undefined) {
      outputTokens += output;
      sawUsage = true;
    }
    totalTokens = total ?? totalTokens;
  }
  return {
    provider: 'bedrock',
    providerRequestId,
    model,
    inputTokens: sawUsage ? inputTokens : undefined,
    outputTokens: sawUsage ? outputTokens : undefined,
    totalTokens: totalTokens ?? (sawUsage ? inputTokens + outputTokens : undefined),
  };
}

function normalizeOpenAICompatibleProvider(provider?: string): 'openai' | 'azure_openai' {
  const normalized = cleanString(provider)?.toLowerCase();
  if (normalized === 'azure_openai' || normalized === 'azure-openai' || normalized === 'azure') {
    return 'azure_openai';
  }
  return 'openai';
}

function selectOpenAICompatibleResponseExtractor(provider?: string): (response: Record<string, unknown>) => Partial<LLMUsageEvent> {
  return normalizeOpenAICompatibleProvider(provider) === 'azure_openai'
    ? extractAzureOpenAIUsage
    : extractOpenAIUsage;
}

function selectOpenAICompatibleStreamExtractor(provider?: string): (chunks: Array<Record<string, unknown>>) => Partial<LLMUsageEvent> {
  if (normalizeOpenAICompatibleProvider(provider) === 'azure_openai') {
    return (chunks) => ({
      ...extractOpenAIStreamUsage(chunks),
      provider: 'azure_openai',
    });
  }
  return extractOpenAIStreamUsage;
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return Boolean(value) && typeof (value as PromiseLike<T>).then === 'function';
}

function buildOpenAICompatibleInstrumentationEvent<TResponse extends Record<string, unknown>>(
  resolved: TResponse,
  extracted: Partial<LLMUsageEvent>,
  provider: string,
  options: OpenAICompatibleInstrumentationOptions,
  timing?: { startedAt: Date; completedAt: Date },
): LLMUsageEvent {
  return {
    ...options.attribution,
    ...extracted,
    ...agentEventFields(options.agent),
    provider: extracted.provider || provider,
    model: extracted.model || options.model || cleanString(resolved.model) || 'unknown',
    requestId: extracted.requestId || options.requestId,
    traceId: extracted.traceId || options.traceId,
    status: 'succeeded',
    startedAt: timing?.startedAt,
    completedAt: timing?.completedAt,
    latencyMs: timing ? timing.completedAt.getTime() - timing.startedAt.getTime() : undefined,
    metadata: {
      ...(options.metadata || {}),
      ...(extracted.metadata || {}),
    },
  };
}

function headerRecord(headers: unknown): Record<string, string> {
  if (!headers) {
    return {};
  }
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return Object.fromEntries(Array.from(headers.entries()).map(([key, value]) => [key.toLowerCase(), value]));
  }
  if (typeof headers === 'object' && headers !== null && 'forEach' in headers && typeof (headers as Headers).forEach === 'function') {
    const result: Record<string, string> = {};
    (headers as Headers).forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });
    return result;
  }
  return Object.fromEntries(Object.entries(headers as Record<string, unknown>).flatMap(([key, value]) => {
    if (Array.isArray(value)) {
      return [[key.toLowerCase(), value.map(String).join(', ')]];
    }
    if (value === undefined || value === null) {
      return [];
    }
    return [[key.toLowerCase(), String(value)]];
  }));
}

function selectedHeaderMetadata(headers: Record<string, string>, includeHeaders?: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const header of includeHeaders || []) {
    const normalizedHeader = header.trim().toLowerCase();
    if (!normalizedHeader || !headers[normalizedHeader]) {
      continue;
    }
    result[`http_header_${normalizedHeader.replace(/[^a-z0-9]+/g, '_')}`] = headers[normalizedHeader];
  }
  return result;
}

function contextRequestId(headers: Record<string, string>, requestIdHeader?: string): string | undefined {
  return cleanString(headers[(requestIdHeader || 'x-request-id').toLowerCase()]);
}

function contextTraceId(headers: Record<string, string>, traceIdHeader?: string): string | undefined {
  return cleanString(headers[(traceIdHeader || 'x-trace-id').toLowerCase()]) || cleanString(headers.traceparent);
}

function fetchRequestUrl(input: string | URL): string {
  return input instanceof URL ? input.toString() : String(input);
}

function fetchRequestMethod(init?: RequestInit): string | undefined {
  return cleanString(init?.method)?.toUpperCase();
}

export function instrumentExpressRequestContext(
  request: {
    headers?: unknown;
    method?: string;
    route?: { path?: string };
    originalUrl?: string;
    path?: string;
    url?: string;
    ip?: string;
    socket?: { remoteAddress?: string };
  },
  options: RequestContextOptions = {},
): InstrumentedRequestContext {
  const headers = headerRecord(request.headers);
  const httpRoute = cleanString(options.route) || cleanString(request.route?.path) || cleanString(request.originalUrl) || cleanString(request.path) || cleanString(request.url);
  const httpPath = cleanString(request.path) || cleanString(request.originalUrl) || cleanString(request.url);
  return {
    attribution: options.attribution,
    requestId: contextRequestId(headers, options.requestIdHeader),
    traceId: contextTraceId(headers, options.traceIdHeader),
    metadata: stripUndefined({
      ...(options.metadata || {}),
      http_method: cleanString(request.method)?.toUpperCase(),
      http_route: httpRoute,
      http_path: httpPath,
      http_host: cleanString(headers.host),
      client_ip: cleanString(request.ip) || cleanString(request.socket?.remoteAddress),
      user_agent: cleanString(headers['user-agent']),
      ...selectedHeaderMetadata(headers, options.includeHeaders),
    }),
  };
}

export function instrumentNextJsRouteContext(
  context: Request | {
    request?: Request;
    headers?: unknown;
    method?: string;
    url?: string;
    nextUrl?: { pathname?: string };
  },
  options: RequestContextOptions = {},
): InstrumentedRequestContext {
  const request = context instanceof Request ? context : context.request;
  const headers = headerRecord(request?.headers || (!(context instanceof Request) ? context.headers : undefined));
  const urlString = request?.url || (!(context instanceof Request) ? context.url : undefined);
  let parsedUrl: URL | undefined;
  try {
    parsedUrl = cleanString(urlString) ? new URL(String(urlString)) : undefined;
  } catch {
    parsedUrl = undefined;
  }
  const httpPath = cleanString(options.route)
    || cleanString(!(context instanceof Request) ? context.nextUrl?.pathname : undefined)
    || cleanString(parsedUrl?.pathname);
  return {
    attribution: options.attribution,
    requestId: contextRequestId(headers, options.requestIdHeader),
    traceId: contextTraceId(headers, options.traceIdHeader),
    metadata: stripUndefined({
      ...(options.metadata || {}),
      http_method: cleanString(request?.method || (!(context instanceof Request) ? context.method : undefined))?.toUpperCase(),
      http_route: httpPath,
      http_path: httpPath,
      http_host: cleanString(parsedUrl?.host) || cleanString(headers.host),
      user_agent: cleanString(headers['user-agent']),
      ...selectedHeaderMetadata(headers, options.includeHeaders),
    }),
  };
}

export function createInstrumentedFetch(
  client: LLMObservabilityClient,
  options: InstrumentedFetchOptions,
): CloptimaFetch {
  const fetchImpl = requireFetch(options.fetchImpl);
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    if (!client.isEnabled()) {
      return fetchImpl(input, init);
    }

    const resolved = {
      ...(options.resolveOptions?.(input, init) || {}),
      ...stripUndefined({
        provider: cleanString(options.provider),
        model: cleanString(options.model),
        attribution: options.attribution,
        agent: options.agent,
        metadata: options.metadata,
        requestId: options.requestId,
        traceId: options.traceId,
        fireAndForget: options.fireAndForget,
        providerRequestIdHeader: cleanString(options.providerRequestIdHeader),
        onInstrumentationError: options.onInstrumentationError,
      }),
      method: fetchRequestMethod(init),
      url: fetchRequestUrl(input),
    } satisfies Partial<FetchLLMInstrumentationOptions>;

    if (!resolved.provider) {
      const error = new Error('Instrumented fetch requires a provider from options.provider or options.resolveOptions');
      options.onInstrumentationError?.(error);
      return fetchImpl(input, init);
    }

    try {
      return await instrumentFetchLLMUsage(
        client,
        fetchImpl(input, init),
        resolved as FetchLLMInstrumentationOptions,
      );
    } catch (error) {
      options.onInstrumentationError?.(error);
      throw error;
    }
  };
}

export async function instrumentFetchLLMUsage(
  client: LLMObservabilityClient,
  response: Promise<Response> | Response,
  options: FetchLLMInstrumentationOptions,
): Promise<Response> {
  if (!client.isEnabled()) {
    return await response;
  }

  const provider = normalizeOpenAICompatibleProvider(options.provider);
  const extractor = selectOpenAICompatibleResponseExtractor(provider);
  const startedAt = isPromiseLike(response) ? new Date() : undefined;
  try {
    const resolved = await response;
    const completedAt = startedAt ? new Date() : undefined;
    let parseFailed = false;
    const payload = await maybeJsonResponse(resolved, (error) => {
      parseFailed = true;
      options.onInstrumentationError?.(
        new Error(
          `Instrumented fetch could not parse JSON response for ${provider} ${cleanString(options.method)?.toUpperCase() || 'GET'} ${cleanString(options.url) || cleanString(resolved.url) || 'unknown-url'}: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    });
    const extracted = payload ? extractor(payload) : {};
    const event = buildOpenAICompatibleInstrumentationEvent(
      payload || { model: options.model || 'unknown' },
      extracted,
      provider,
      options,
      startedAt && completedAt ? { startedAt, completedAt } : undefined,
    );
    event.status = resolved.ok ? event.status || 'succeeded' : 'failed';
    event.providerRequestId = extracted.providerRequestId || fetchProviderRequestId(resolved.headers, options.providerRequestIdHeader);
    event.metadata = {
      ...(event.metadata || {}),
      http_method: cleanString(options.method)?.toUpperCase(),
      http_status_code: resolved.status,
      http_url: cleanString(options.url) || cleanString(resolved.url),
      response_json_parsed: payload ? true : false,
      response_json_parse_failed: parseFailed || undefined,
    };
    if (!resolved.ok && !event.errorMessage) {
      event.errorMessage = cleanString(resolved.statusText) || `HTTP ${resolved.status}`;
    }
    if (options.fireAndForget === false) {
      await client.record(event);
    } else {
      client.recordAsync(event);
    }
    return resolved;
  } catch (error) {
    const completedAt = startedAt ? new Date() : undefined;
    const event: LLMUsageEvent = {
      ...options.attribution,
      ...agentEventFields(options.agent),
      provider,
      model: options.model || 'unknown',
      requestId: options.requestId,
      traceId: options.traceId,
      status: 'failed',
      ...(startedAt && completedAt ? {
        startedAt,
        completedAt,
        latencyMs: completedAt.getTime() - startedAt.getTime(),
      } : {}),
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: {
        ...(options.metadata || {}),
        http_method: cleanString(options.method)?.toUpperCase(),
        http_url: cleanString(options.url),
        response_json_parsed: false,
      },
    };
    if (options.fireAndForget === false) {
      await client.record(event);
    } else {
      client.recordAsync(event);
    }
    throw error;
  }
}

export async function instrumentOpenAICompatibleResponse<TResponse extends Record<string, unknown>>(
  client: LLMObservabilityClient,
  response: Promise<TResponse> | TResponse,
  options: OpenAICompatibleInstrumentationOptions = {},
): Promise<TResponse> {
  if (!client.isEnabled()) {
    return await response;
  }

  const provider = normalizeOpenAICompatibleProvider(options.provider);
  const extractor = selectOpenAICompatibleResponseExtractor(provider);
  if (isPromiseLike(response)) {
    const startedAt = new Date();
    try {
      const resolved = await response;
      const completedAt = new Date();
      const extracted = extractor(resolved);
      const event = buildOpenAICompatibleInstrumentationEvent(
        resolved,
        extracted,
        provider,
        options,
        { startedAt, completedAt },
      );
      if (options.fireAndForget === false) {
        await client.record(event);
      } else {
        client.recordAsync(event);
      }
      return resolved;
    } catch (error) {
      const completedAt = new Date();
      const event: LLMUsageEvent = {
        ...options.attribution,
        ...agentEventFields(options.agent),
        provider,
        model: options.model || 'unknown',
        requestId: options.requestId,
        traceId: options.traceId,
        status: 'failed',
        startedAt,
        completedAt,
        latencyMs: completedAt.getTime() - startedAt.getTime(),
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          ...(options.metadata || {}),
        },
      };
      if (options.fireAndForget === false) {
        await client.record(event);
      } else {
        client.recordAsync(event);
      }
      throw error;
    }
  }

  const resolved = await response;
  const extracted = extractor(resolved);
  const event = buildOpenAICompatibleInstrumentationEvent(resolved, extracted, provider, options);
  if (options.fireAndForget === false) {
    await client.record(event);
  } else {
    client.recordAsync(event);
  }
  return resolved;
}

export async function* instrumentOpenAICompatibleStream<TChunk extends Record<string, unknown>>(
  client: LLMObservabilityClient,
  stream: AsyncIterable<TChunk> | Iterable<TChunk> | Promise<AsyncIterable<TChunk> | Iterable<TChunk>>,
  options: OpenAICompatibleStreamInstrumentationOptions = {},
): AsyncGenerator<TChunk, void, unknown> {
  const provider = normalizeOpenAICompatibleProvider(options.provider);
  for await (const chunk of client.observeStream({
    provider,
    model: options.model || 'unknown',
    call: () => stream,
    extractUsage: selectOpenAICompatibleStreamExtractor(provider),
    attribution: options.attribution,
    agent: options.agent,
    metadata: options.metadata,
    requestId: options.requestId,
    traceId: options.traceId,
    fireAndForget: options.fireAndForget,
    maxBufferedChunks: options.maxBufferedChunks,
  })) {
    yield chunk;
  }
}
