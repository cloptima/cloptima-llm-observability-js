const PACKAGE_VERSION = '0.2.0';
export type CloptimaFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
export type LLMObservabilityDeliveryMode = 'cloptima_http' | 'otlp_http';
export type LLMUsageExtractor<T = unknown> = (input: T) => Partial<LLMUsageEvent>;
export type UsageFieldPath = string;
export type UsageFieldPaths = UsageFieldPath | UsageFieldPath[];
export type ProviderUsageExtractorDescriptor = {
  provider: string;
  aliases: readonly string[];
  responseExtractor: LLMUsageExtractor<unknown>;
  streamExtractor?: LLMUsageExtractor<unknown[]>;
};
export type MappedUsageExtractorConfig = {
  defaults?: Partial<LLMUsageEvent>;
  fields?: Partial<Record<
    'provider' | 'providerRequestId' | 'model' | 'requestId' | 'traceId' | 'status' | 'vendorReportedCostUsd' | 'errorMessage',
    UsageFieldPaths
  >>;
  numberFields?: Partial<Record<
    'inputTokens' | 'outputTokens' | 'totalTokens' | 'reasoningTokens' | 'cachedInputTokens' | 'latencyMs',
    UsageFieldPaths
  >>;
  booleanFields?: Partial<Record<'cacheHit', UsageFieldPaths>>;
  extraUsageUnits?: Record<string, UsageFieldPaths>;
  metadata?: Record<string, UsageFieldPaths>;
};
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

type AttributionContext = Partial<LLMAttribution>;
type AttributionContextStorage = {
  getStore(): AttributionContext | undefined;
  run<R>(store: AttributionContext, callback: () => R): R;
};
type AsyncLocalStorageLike<T> = {
  getStore(): T | undefined;
  run<R>(store: T, callback: () => R): R;
};
type AsyncLocalStorageLikeCtor = new <T>() => AsyncLocalStorageLike<T>;

class StackAttributionContextStorage implements AttributionContextStorage {
  private readonly stack: AttributionContext[] = [];

  getStore(): AttributionContext | undefined {
    return this.stack[this.stack.length - 1];
  }

  run<R>(store: AttributionContext, callback: () => R): R {
    this.stack.push(store);
    try {
      return callback();
    } finally {
      this.stack.pop();
    }
  }
}

async function resolveAsyncLocalStorageCtor(): Promise<AsyncLocalStorageLikeCtor | undefined> {
  const globalCtor = (globalThis as { AsyncLocalStorage?: AsyncLocalStorageLikeCtor }).AsyncLocalStorage;
  if (typeof globalCtor === 'function') {
    return globalCtor;
  }
  try {
    const nodeAsyncHooksSpecifier = 'node:async_hooks';
    const module = await import(nodeAsyncHooksSpecifier);
    if (typeof module.AsyncLocalStorage === 'function') {
      return module.AsyncLocalStorage as AsyncLocalStorageLikeCtor;
    }
  } catch {}
  return undefined;
}

async function createAttributionContextStorage(): Promise<AttributionContextStorage> {
  const ctor = await resolveAsyncLocalStorageCtor();
  if (ctor) {
    return new ctor<AttributionContext>() as AttributionContextStorage;
  }
  return new StackAttributionContextStorage();
}

const attributionContextStorage = await createAttributionContextStorage();

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
  runWithAttribution<T>(attribution: Partial<LLMAttribution>, callback: () => T | Promise<T>): T | Promise<T>;
  withWorkflow<T>(name: string, callback: () => T | Promise<T>, attribution?: Partial<LLMAttribution>): T | Promise<T>;
  withTask<T>(name: string, callback: () => T | Promise<T>, attribution?: Partial<LLMAttribution>): T | Promise<T>;
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

export type ObservedCallFactoryOptions<T> = Omit<ObserveLLMCallOptions<T>, 'call'>;
export type ObservedStreamFactoryOptions<TChunk> = Omit<ObserveLLMStreamOptions<TChunk>, 'call'>;
export type ObservedCallOverridesResolver<TArgs extends unknown[], T> = (...args: TArgs) => Partial<ObservedCallFactoryOptions<T>> | undefined;
export type ObservedStreamOverridesResolver<TArgs extends unknown[], TChunk> = (...args: TArgs) => Partial<ObservedStreamFactoryOptions<TChunk>> | undefined;
export type ObservedServiceBinding =
  | {
    kind: 'call';
    options: ObservedCallFactoryOptions<unknown>;
    resolveOverrides?: (...args: unknown[]) => Partial<ObservedCallFactoryOptions<unknown>> | undefined;
  }
  | {
    kind: 'stream';
    options: ObservedStreamFactoryOptions<unknown>;
    resolveOverrides?: (...args: unknown[]) => Partial<ObservedStreamFactoryOptions<unknown>> | undefined;
  };
export type ProviderSupportMatrixEntry = {
  provider: string;
  aliases: readonly string[];
  response: boolean;
  stream: boolean;
};

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
  });
}

function currentAttributionContext(): Partial<LLMAttribution> {
  return attributionContextStorage.getStore() || {};
}

function isIteratorLike<T>(value: unknown): value is Iterator<T> {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as { next?: unknown }).next === 'function'
    && typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function';
}

function isAsyncIteratorLike<T>(value: unknown): value is AsyncIterator<T> {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as { next?: unknown }).next === 'function'
    && typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function';
}

function* attributedIterator<T>(
  context: Partial<LLMAttribution>,
  iterator: Iterator<T>,
): Generator<T, void, unknown> {
  while (true) {
    const step = attributionContextStorage.run(context, () => iterator.next());
    if (step.done) {
      return;
    }
    yield step.value;
  }
}

async function* attributedAsyncIterator<T>(
  context: Partial<LLMAttribution>,
  iterator: AsyncIterator<T>,
): AsyncGenerator<T, void, unknown> {
  while (true) {
    const step = await attributionContextStorage.run(context, () => iterator.next());
    if (step.done) {
      return;
    }
    yield step.value;
  }
}

function wrapAttributedResult<T>(context: Partial<LLMAttribution>, result: T): T {
  if (isAsyncIteratorLike(result)) {
    return attributedAsyncIterator(context, result) as T;
  }
  if (isIteratorLike(result)) {
    return attributedIterator(context, result) as T;
  }
  return result;
}

function resolveAttributionContext(attribution?: Partial<LLMAttribution>): Partial<LLMAttribution> {
  return stripUndefined({
    ...currentAttributionContext(),
    ...attributionFromFlatFields(attribution || {}),
  });
}

export function runWithAttribution<T>(
  attribution: Partial<LLMAttribution>,
  callback: () => T | Promise<T>,
): T | Promise<T> {
  const context = resolveAttributionContext(attribution);
  const result = attributionContextStorage.run(context, callback);
  if (isPromiseLike<T>(result)) {
    return result.then((resolved) => wrapAttributedResult(context, resolved)) as Promise<T>;
  }
  return wrapAttributedResult(context, result);
}

function namedContextAttribution(
  key: 'workflowId' | 'featureId',
  name: string,
  attribution?: Partial<LLMAttribution>,
): Partial<LLMAttribution> {
  const resolved = attributionFromFlatFields(attribution || {});
  const resolvedName = cleanString(name);
  if (resolvedName && !resolved[key]) {
    return {
      ...resolved,
      [key]: resolvedName,
    };
  }
  return resolved;
}

export function withWorkflow<T>(
  name: string,
  callback: () => T | Promise<T>,
  attribution?: Partial<LLMAttribution>,
): T | Promise<T> {
  return runWithAttribution(namedContextAttribution('workflowId', name, attribution), callback);
}

export function withTask<T>(
  name: string,
  callback: () => T | Promise<T>,
  attribution?: Partial<LLMAttribution>,
): T | Promise<T> {
  return runWithAttribution(namedContextAttribution('featureId', name, attribution), callback);
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

function mergeObservedCallOptions<T>(
  baseOptions: ObservedCallFactoryOptions<T>,
  overrides: Partial<ObservedCallFactoryOptions<T>> | undefined,
  call: () => Promise<T> | T,
): ObserveLLMCallOptions<T> {
  return {
    ...baseOptions,
    ...overrides,
    call,
    attribution: stripUndefined({
      ...(baseOptions.attribution || {}),
      ...(overrides?.attribution || {}),
    }) as Partial<LLMAttribution>,
    agent: stripUndefined({
      ...(baseOptions.agent || {}),
      ...(overrides?.agent || {}),
    }) as Partial<LLMAgentContext>,
    metadata: stripUndefined({
      ...(baseOptions.metadata || {}),
      ...(overrides?.metadata || {}),
    }),
  };
}

function mergeObservedStreamOptions<TChunk>(
  baseOptions: ObservedStreamFactoryOptions<TChunk>,
  overrides: Partial<ObservedStreamFactoryOptions<TChunk>> | undefined,
  call: () => AsyncIterable<TChunk> | Iterable<TChunk> | Promise<AsyncIterable<TChunk> | Iterable<TChunk>>,
): ObserveLLMStreamOptions<TChunk> {
  return {
    ...baseOptions,
    ...overrides,
    call,
    attribution: stripUndefined({
      ...(baseOptions.attribution || {}),
      ...(overrides?.attribution || {}),
    }) as Partial<LLMAttribution>,
    agent: stripUndefined({
      ...(baseOptions.agent || {}),
      ...(overrides?.agent || {}),
    }) as Partial<LLMAgentContext>,
    metadata: stripUndefined({
      ...(baseOptions.metadata || {}),
      ...(overrides?.metadata || {}),
    }),
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

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || Array.isArray(value)) {
    return undefined;
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function coerceObjectRecord(value: unknown): Record<string, unknown> | undefined {
  const direct = objectRecord(value);
  if (direct) {
    const prototype = Object.getPrototypeOf(direct);
    if (Object.keys(direct).length > 0 || prototype === Object.prototype || prototype === null) {
      return direct;
    }
  }
  if (!value || typeof value !== 'object') {
    return direct;
  }
  const candidate = value as {
    model_dump?: () => unknown;
    dict?: () => unknown;
    toJSON?: () => unknown;
  };
  if (typeof candidate.model_dump === 'function') {
    try {
      const dumped = objectRecord(candidate.model_dump());
      if (dumped) {
        return dumped;
      }
    } catch {}
  }
  if (typeof candidate.dict === 'function') {
    try {
      const dumped = objectRecord(candidate.dict());
      if (dumped) {
        return dumped;
      }
    } catch {}
  }
  if (typeof candidate.toJSON === 'function') {
    try {
      const dumped = objectRecord(candidate.toJSON());
      if (dumped) {
        return dumped;
      }
    } catch {}
  }
  if (direct) {
    return direct;
  }
  return undefined;
}

function recordField(record: Record<string, unknown> | undefined, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record && key in record) {
      return record[key];
    }
  }
  return undefined;
}

function nestedRecord(record: Record<string, unknown> | undefined, ...keys: string[]): Record<string, unknown> | undefined {
  for (const key of keys) {
    const nested = coerceObjectRecord(recordField(record, key));
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

function splitFieldPath(path: string): string[] {
  return path.split('.').map((segment) => segment.trim()).filter(Boolean);
}

function pathValue(record: Record<string, unknown> | undefined, path: UsageFieldPath): unknown {
  let current: unknown = record;
  for (const segment of splitFieldPath(path)) {
    const currentRecord = coerceObjectRecord(current);
    if (!currentRecord || !(segment in currentRecord)) {
      return undefined;
    }
    current = currentRecord[segment];
  }
  return current;
}

function resolveMappedValue(record: Record<string, unknown> | undefined, paths?: UsageFieldPaths): unknown {
  if (!paths) {
    return undefined;
  }
  const candidates = Array.isArray(paths) ? paths : [paths];
  for (const candidate of candidates) {
    const value = pathValue(record, candidate);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
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

function coerceRecordList(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  const records: Array<Record<string, unknown>> = [];
  for (const item of value) {
    const record = coerceObjectRecord(item);
    if (record) {
      records.push(record);
    }
  }
  return records;
}

function runtimePositiveUsageUnit(value: unknown, ...keys: string[]): number | undefined {
  return cleanNumber(recordField(coerceObjectRecord(value), ...keys));
}

function detailModalityTokenCount(value: unknown, modality: 'image' | 'audio' | 'video'): number | undefined {
  const direct = runtimePositiveUsageUnit(
    value,
    `${modality}_tokens`,
    `${modality}_token_count`,
    `${modality}TokenCount`,
  );
  if (direct !== undefined) {
    return direct;
  }
  let total = 0;
  let sawMatch = false;
  for (const entry of coerceRecordList(value)) {
    const entryModality = cleanString(recordField(entry, 'modality', 'type', 'kind'))?.toLowerCase();
    if (entryModality !== modality) {
      continue;
    }
    const count = cleanNumber(recordField(entry, 'tokenCount', 'token_count', 'tokens', 'count'));
    if (count === undefined) {
      continue;
    }
    total += count;
    sawMatch = true;
  }
  return sawMatch ? total : undefined;
}

function accumulateStreamingCounter(
  total: number | undefined,
  lastSeen: number | undefined,
  nextValue: number | undefined,
): { total: number | undefined; lastSeen: number | undefined } {
  if (nextValue === undefined) {
    return { total, lastSeen };
  }
  if (lastSeen === undefined || total === undefined) {
    return { total: nextValue, lastSeen: nextValue };
  }
  if (nextValue >= lastSeen) {
    return { total: total + (nextValue - lastSeen), lastSeen: nextValue };
  }
  return { total: total + nextValue, lastSeen: nextValue };
}

function accumulateStreamingUsageMap(
  totals: Record<string, number>,
  lastSeen: Record<string, number>,
  chunk: Record<string, number> | undefined,
): void {
  if (!chunk) {
    return;
  }
  for (const [key, value] of Object.entries(chunk)) {
    const previous = lastSeen[key];
    if (previous === undefined) {
      totals[key] = (totals[key] || 0) + value;
    } else if (value >= previous) {
      totals[key] = (totals[key] || 0) + (value - previous);
    } else {
      totals[key] = (totals[key] || 0) + value;
    }
    lastSeen[key] = value;
  }
}

function extractRuntimeExtraUsageUnits(
  usage: Record<string, unknown> | undefined,
  promptDetails?: unknown,
  completionDetails?: unknown,
): Record<string, number> | undefined {
  return cleanUsageMap({
    cache_write: runtimePositiveUsageUnit(usage, 'cache_creation_input_tokens', 'cache_write_input_tokens')
      || runtimePositiveUsageUnit(promptDetails, 'cache_creation_input_tokens', 'cache_write_input_tokens'),
    cache_write_5m: runtimePositiveUsageUnit(usage, 'cache_creation_input_tokens_5m', 'cache_write_input_tokens_5m')
      || runtimePositiveUsageUnit(promptDetails, 'cache_creation_input_tokens_5m', 'cache_write_input_tokens_5m'),
    cache_write_1h: runtimePositiveUsageUnit(usage, 'cache_creation_input_tokens_1h', 'cache_write_input_tokens_1h')
      || runtimePositiveUsageUnit(promptDetails, 'cache_creation_input_tokens_1h', 'cache_write_input_tokens_1h'),
    input_image: runtimePositiveUsageUnit(
      usage,
      'input_image_tokens',
      'image_input_tokens',
      'inputImageTokens',
      'imageInputTokens',
      'inputImageTokenCount',
      'input_image_token_count',
    ) || detailModalityTokenCount(promptDetails, 'image'),
    output_image: runtimePositiveUsageUnit(
      usage,
      'output_image_tokens',
      'image_output_tokens',
      'outputImageTokens',
      'imageOutputTokens',
      'outputImageTokenCount',
      'output_image_token_count',
    ) || detailModalityTokenCount(completionDetails, 'image'),
    input_audio: runtimePositiveUsageUnit(
      usage,
      'input_audio_tokens',
      'audio_input_tokens',
      'inputAudioTokens',
      'audioInputTokens',
      'inputAudioTokenCount',
      'input_audio_token_count',
    ) || detailModalityTokenCount(promptDetails, 'audio'),
    output_audio: runtimePositiveUsageUnit(
      usage,
      'output_audio_tokens',
      'audio_output_tokens',
      'outputAudioTokens',
      'audioOutputTokens',
      'outputAudioTokenCount',
      'output_audio_token_count',
    ) || detailModalityTokenCount(completionDetails, 'audio'),
    input_video: runtimePositiveUsageUnit(
      usage,
      'input_video_tokens',
      'video_input_tokens',
      'inputVideoTokens',
      'videoInputTokens',
      'inputVideoTokenCount',
      'input_video_token_count',
    ) || detailModalityTokenCount(promptDetails, 'video'),
    output_video: runtimePositiveUsageUnit(
      usage,
      'output_video_tokens',
      'video_output_tokens',
      'outputVideoTokens',
      'videoOutputTokens',
      'outputVideoTokenCount',
      'output_video_token_count',
    ) || detailModalityTokenCount(completionDetails, 'video'),
    search_request: runtimePositiveUsageUnit(usage, 'search_requests', 'web_search_requests', 'searchRequests', 'webSearchRequests'),
    request: runtimePositiveUsageUnit(usage, 'requests', 'request_count', 'requestCount'),
  });
}

function hasMeaningfulExtraction(extracted: Partial<LLMUsageEvent>): boolean {
  return Boolean(
    extracted.provider
      || extracted.model
      || extracted.providerRequestId
      || extracted.requestId
      || extracted.traceId
      || extracted.status
      || extracted.inputTokens !== undefined
      || extracted.outputTokens !== undefined
      || extracted.totalTokens !== undefined
      || extracted.reasoningTokens !== undefined
      || extracted.cachedInputTokens !== undefined
      || extracted.vendorReportedCostUsd !== undefined
      || extracted.latencyMs !== undefined
      || extracted.cacheHit !== undefined
      || (extracted.extraUsageUnits && Object.keys(extracted.extraUsageUnits).length > 0)
      || (extracted.metadata && Object.keys(extracted.metadata).length > 0)
  );
}

export function tryExtractUsage<T>(
  input: T,
  ...extractors: Array<LLMUsageExtractor<T> | undefined>
): Partial<LLMUsageEvent> {
  for (const extractor of extractors) {
    if (!extractor) {
      continue;
    }
    try {
      const extracted = extractor(input) || {};
      if (hasMeaningfulExtraction(extracted)) {
        return extracted;
      }
    } catch {
      continue;
    }
  }
  return {};
}

export function composeUsageExtractors<T>(
  ...extractors: Array<LLMUsageExtractor<T> | undefined>
): LLMUsageExtractor<T> {
  return (input: T) => tryExtractUsage(input, ...extractors);
}

export function withUsageOverrides<T>(
  extractor: LLMUsageExtractor<T>,
  overrides: Partial<LLMUsageEvent> | ((extracted: Partial<LLMUsageEvent>, input: T) => Partial<LLMUsageEvent>),
): LLMUsageExtractor<T> {
  return (input: T) => {
    const extracted = extractor(input) || {};
    const overrideValues = typeof overrides === 'function' ? overrides(extracted, input) : overrides;
    return stripUndefined({
      ...extracted,
      ...overrideValues,
    }) as Partial<LLMUsageEvent>;
  };
}

export function createMappedUsageExtractor<T = unknown>(
  config: MappedUsageExtractorConfig,
): LLMUsageExtractor<T> {
  return (input: T) => {
    const record = coerceObjectRecord(input) || {};
    const extracted: Partial<LLMUsageEvent> = {
      ...(config.defaults || {}),
    };
    for (const [field, paths] of Object.entries(config.fields || {})) {
      const value = resolveMappedValue(record, paths);
      if (field === 'provider' || field === 'providerRequestId' || field === 'model' || field === 'requestId' || field === 'traceId' || field === 'status' || field === 'errorMessage') {
        (extracted as Record<string, unknown>)[field] = cleanString(value);
      } else if (field === 'vendorReportedCostUsd') {
        (extracted as Record<string, unknown>)[field] = cleanDecimal(value) ?? cleanString(value);
      }
    }
    for (const [field, paths] of Object.entries(config.numberFields || {})) {
      (extracted as Record<string, unknown>)[field] = cleanNumber(resolveMappedValue(record, paths));
    }
    for (const [field, paths] of Object.entries(config.booleanFields || {})) {
      if (field === 'cacheHit') {
        (extracted as Record<string, unknown>)[field] = cleanBoolean(resolveMappedValue(record, paths));
      }
    }
    if (config.extraUsageUnits) {
      extracted.extraUsageUnits = cleanUsageMap(
        Object.fromEntries(
          Object.entries(config.extraUsageUnits).map(([key, paths]) => [key, resolveMappedValue(record, paths)]),
        ),
      );
    }
    if (config.metadata) {
      extracted.metadata = stripUndefined(
        Object.fromEntries(
          Object.entries(config.metadata).map(([key, paths]) => [key, resolveMappedValue(record, paths)]),
        ),
      );
      if (Object.keys(extracted.metadata).length === 0) {
        delete extracted.metadata;
      }
    }
    if (extracted.totalTokens === undefined && (
      extracted.inputTokens !== undefined || extracted.outputTokens !== undefined
    )) {
      extracted.totalTokens = (extracted.inputTokens || 0) + (extracted.outputTokens || 0);
    }
    return stripUndefined(extracted) as Partial<LLMUsageEvent>;
  };
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

function isLocalApiBaseUrl(value: string): boolean {
  return /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/|$)/i.test(value);
}

function withDefaultApiBaseScheme(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_API_BASE_URL;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  return `${isLocalApiBaseUrl(trimmed) ? 'http://' : 'https://'}${trimmed}`;
}

function resolveApiBaseUrl(apiBaseUrl?: string): string {
  const candidate = withDefaultApiBaseScheme(cleanString(apiBaseUrl) || DEFAULT_API_BASE_URL);
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`Invalid Cloptima API base URL: ${apiBaseUrl}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Cloptima API base URL must use http or https: ${apiBaseUrl}`);
  }
  if ((parsed.pathname && parsed.pathname !== '/') || parsed.search || parsed.hash) {
    throw new Error(`Cloptima API base URL must not include a path, query, or hash: ${apiBaseUrl}`);
  }
  return parsed.origin.replace(/\/+$/, '');
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

function otlpExtraUsageAttributes(payload: Record<string, unknown>): Array<[string, unknown]> {
  const extraUsageUnits = cleanUsageMap(payload.extra_usage_units);
  if (!extraUsageUnits) {
    return [];
  }
  const attributes: Array<[string, unknown]> = [['extra_usage_units', extraUsageUnits]];
  for (const key of Object.keys(extraUsageUnits).sort()) {
    const value = cleanNumber(extraUsageUnits[key]);
    if (key && typeof value === 'number' && value > 0) {
      attributes.push([`gen_ai.usage.${key}`, value]);
    }
  }
  return attributes;
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
    ['extra_usage_units', cleanUsageMap(payload.extra_usage_units)],
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
  attributes.push(...otlpExtraUsageAttributes(payload));
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
  const attribution = { ...defaults, ...currentAttributionContext(), ...event };
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

  runWithAttribution<T>(attribution: Partial<LLMAttribution>, callback: () => T | Promise<T>): T | Promise<T> {
    return runWithAttribution(attribution, callback);
  }

  withWorkflow<T>(name: string, callback: () => T | Promise<T>, attribution?: Partial<LLMAttribution>): T | Promise<T> {
    return withWorkflow(name, callback, attribution);
  }

  withTask<T>(name: string, callback: () => T | Promise<T>, attribution?: Partial<LLMAttribution>): T | Promise<T> {
    return withTask(name, callback, attribution);
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

  private sdkUserAgent(): string {
    return `${this.sdkName}/${this.options.sdkVersion ?? PACKAGE_VERSION}`;
  }

  private cloptimaRequestHeaders(): Record<string, string> {
    return {
      authorization: `Bearer ${this.options.apiKey}`,
      'content-type': 'application/json',
      'user-agent': this.sdkUserAgent(),
    };
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
    const hasExplicitUserAgent = Object.keys(headers).some((key) => key.toLowerCase() === 'user-agent');
    if (!hasExplicitUserAgent) {
      headers['user-agent'] = this.sdkUserAgent();
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
            headers: this.cloptimaRequestHeaders(),
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

  private reportObserveError(error: unknown): void {
    if (error instanceof Error) {
      this.options.onError?.(error);
      return;
    }
    this.options.onError?.(new Error(String(error)));
  }

  private async recordObservedEventSafely(
    event: LLMUsageEvent,
    metadataPrivacy?: MetadataPrivacyOptions,
    fireAndForget?: boolean,
  ): Promise<void> {
    if (fireAndForget === false) {
      try {
        await this.postPayload(this.eventPayload(event, metadataPrivacy));
      } catch (error) {
        this.reportObserveError(error);
      }
      return;
    }
    this.recordAsyncWithPrivacy(event, metadataPrivacy);
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
      await this.recordObservedEventSafely(event, options.metadataPrivacy, options.fireAndForget !== false);
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
      await this.recordObservedEventSafely(event, options.metadataPrivacy, options.fireAndForget !== false);
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
      await this.recordObservedEventSafely(event, options.metadataPrivacy, options.fireAndForget !== false);
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
      await this.recordObservedEventSafely(event, options.metadataPrivacy, options.fireAndForget !== false);
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

  runWithAttribution<T>(attribution: Partial<LLMAttribution>, callback: () => T | Promise<T>): T | Promise<T> {
    return runWithAttribution(attribution, callback);
  }

  withWorkflow<T>(name: string, callback: () => T | Promise<T>, attribution?: Partial<LLMAttribution>): T | Promise<T> {
    return withWorkflow(name, callback, attribution);
  }

  withTask<T>(name: string, callback: () => T | Promise<T>, attribution?: Partial<LLMAttribution>): T | Promise<T> {
    return withTask(name, callback, attribution);
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

  try {
    return new CloptimaLLMObservability({
      ...clientOptions,
      apiBaseUrl: apiBaseUrl || '',
      apiKey: apiKey || '',
      defaultAttribution: defaultAttribution as LLMAttribution,
      deliveryMode: options?.deliveryMode || cleanString(env[INIT_DELIVERY_MODE_ENV]) as LLMObservabilityDeliveryMode | undefined,
      otlpServiceName: options?.otlpServiceName || cleanString(env[INIT_OTLP_SERVICE_NAME_ENV]),
      otlpServiceVersion: options?.otlpServiceVersion || cleanString(env[INIT_OTLP_SERVICE_VERSION_ENV]),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to initialize Cloptima LLM observability';
    return disabledClient(initError(options, message));
  }
}

export function createObservedCall<T>(
  client: LLMObservabilityClient,
  baseOptions: ObservedCallFactoryOptions<T>,
): (
  call: () => Promise<T> | T,
  overrides?: Partial<ObservedCallFactoryOptions<T>>,
) => Promise<T> {
  return (call, overrides) => client.observe(mergeObservedCallOptions(baseOptions, overrides, call));
}

export function createObservedStream<TChunk>(
  client: LLMObservabilityClient,
  baseOptions: ObservedStreamFactoryOptions<TChunk>,
): (
  call: () => AsyncIterable<TChunk> | Iterable<TChunk> | Promise<AsyncIterable<TChunk> | Iterable<TChunk>>,
  overrides?: Partial<ObservedStreamFactoryOptions<TChunk>>,
) => AsyncGenerator<TChunk, void, unknown> {
  return (call, overrides) => client.observeStream(mergeObservedStreamOptions(baseOptions, overrides, call));
}

export function bindObservedCall<TArgs extends unknown[], T>(
  client: LLMObservabilityClient,
  method: (...args: TArgs) => Promise<T> | T,
  baseOptions: ObservedCallFactoryOptions<T>,
  resolveOverrides?: ObservedCallOverridesResolver<TArgs, T>,
): (...args: TArgs) => Promise<T> {
  return (...args: TArgs) => client.observe(
    mergeObservedCallOptions(baseOptions, resolveOverrides?.(...args), () => method(...args)),
  );
}

export function bindObservedStream<TArgs extends unknown[], TChunk>(
  client: LLMObservabilityClient,
  method: (...args: TArgs) => AsyncIterable<TChunk> | Iterable<TChunk> | Promise<AsyncIterable<TChunk> | Iterable<TChunk>>,
  baseOptions: ObservedStreamFactoryOptions<TChunk>,
  resolveOverrides?: ObservedStreamOverridesResolver<TArgs, TChunk>,
): (...args: TArgs) => AsyncGenerator<TChunk, void, unknown> {
  return (...args: TArgs) => client.observeStream(
    mergeObservedStreamOptions(baseOptions, resolveOverrides?.(...args), () => method(...args)),
  );
}

export function wrapObservedService<TService extends object>(
  client: LLMObservabilityClient,
  service: TService,
  bindings: Record<string, ObservedServiceBinding>,
): TService {
  const wrapped = Object.assign(Object.create(Object.getPrototypeOf(service)), service) as Record<string, unknown>;
  for (const [methodName, binding] of Object.entries(bindings)) {
    const original = (service as Record<string, unknown>)[methodName];
    if (typeof original !== 'function') {
      throw new Error(`Cannot wrap non-function service method: ${methodName}`);
    }
    const bound = (original as (...args: unknown[]) => unknown).bind(service);
    if (binding.kind === 'call') {
      wrapped[methodName] = bindObservedCall(
        client,
        bound,
        binding.options,
        binding.resolveOverrides as ObservedCallOverridesResolver<unknown[], unknown> | undefined,
      );
    } else {
      wrapped[methodName] = bindObservedStream(
        client,
        bound as (...args: unknown[]) => AsyncIterable<unknown> | Iterable<unknown> | Promise<AsyncIterable<unknown> | Iterable<unknown>>,
        binding.options,
        binding.resolveOverrides as ObservedStreamOverridesResolver<unknown[], unknown> | undefined,
      );
    }
  }
  return wrapped as TService;
}

export function extractOpenAIUsage(response: unknown): Partial<LLMUsageEvent> {
  const record = coerceObjectRecord(response) || {};
  const usage = nestedRecord(record, 'usage') || {};
  const promptDetails = nestedRecord(usage, 'prompt_tokens_details', 'promptTokensDetails') || {};
  const completionDetails = nestedRecord(usage, 'completion_tokens_details', 'completionTokensDetails') || {};

  return {
    provider: 'openai',
    providerRequestId: cleanString(recordField(record, 'id')),
    model: cleanString(recordField(record, 'model')),
    inputTokens: cleanNumber(usage.prompt_tokens),
    outputTokens: cleanNumber(usage.completion_tokens),
    totalTokens: cleanNumber(usage.total_tokens),
    reasoningTokens: cleanNumber(completionDetails.reasoning_tokens),
    cachedInputTokens: cleanNumber(promptDetails.cached_tokens),
    extraUsageUnits: extractRuntimeExtraUsageUnits(usage, promptDetails, completionDetails),
    cacheHit: cleanNumber(promptDetails.cached_tokens) ? true : undefined,
  };
}

export function extractOpenAIStreamUsage(chunks: Array<unknown>): Partial<LLMUsageEvent> {
  let lastWithUsage: Record<string, unknown> | undefined;
  let providerRequestId: string | undefined;
  let model: string | undefined;
  for (const chunk of chunks) {
    const record = coerceObjectRecord(chunk);
    if (!record) {
      continue;
    }
    providerRequestId = cleanString(recordField(record, 'id')) || providerRequestId;
    model = cleanString(recordField(record, 'model')) || model;
    if (nestedRecord(record, 'usage')) {
      lastWithUsage = record;
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

export function extractAzureOpenAIUsage(response: unknown): Partial<LLMUsageEvent> {
  const record = coerceObjectRecord(response) || {};
  const extracted = extractOpenAIUsage(response);
  return {
    ...extracted,
    provider: 'azure_openai',
    model: extracted.model || cleanString(recordField(record, 'deployment_name', 'deployment', 'model')),
  };
}

export function extractAnthropicUsage(response: unknown): Partial<LLMUsageEvent> {
  const record = coerceObjectRecord(response) || {};
  const usage = nestedRecord(record, 'usage') || {};
  const inputTokens = cleanNumber(usage.input_tokens);
  const outputTokens = cleanNumber(usage.output_tokens);
  const cachedInputTokens = cleanNumber(usage.cache_read_input_tokens);
  return {
    provider: 'anthropic',
    providerRequestId: cleanString(recordField(record, 'id')),
    model: cleanString(recordField(record, 'model')),
    inputTokens,
    outputTokens,
    totalTokens: cleanNumber(usage.total_tokens) ?? (
      inputTokens !== undefined || outputTokens !== undefined ? (inputTokens || 0) + (outputTokens || 0) : undefined
    ),
    cachedInputTokens,
    extraUsageUnits: cleanUsageMap({
      ...extractRuntimeExtraUsageUnits(usage),
      server_tool_use: usage.server_tool_use,
    }),
    cacheHit: cachedInputTokens ? true : undefined,
  };
}

export function extractAnthropicStreamUsage(chunks: Array<unknown>): Partial<LLMUsageEvent> {
  let providerRequestId: string | undefined;
  let model: string | undefined;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let cachedInputTokens: number | undefined;
  let lastInputTokens: number | undefined;
  let lastOutputTokens: number | undefined;
  let lastCachedInputTokens: number | undefined;
  const extraUsageUnits: Record<string, number> = {};
  const lastExtraUsageUnits: Record<string, number> = {};
  for (const chunk of chunks) {
    const record = coerceObjectRecord(chunk);
    if (!record) {
      continue;
    }
    let usage: Record<string, unknown> = {};
    const message = nestedRecord(record, 'message');
    if (message) {
      providerRequestId = cleanString(recordField(message, 'id')) || providerRequestId;
      model = cleanString(recordField(message, 'model')) || model;
      usage = nestedRecord(message, 'usage') || {};
    } else {
      usage = nestedRecord(record, 'usage') || {};
    }
    ({ total: inputTokens, lastSeen: lastInputTokens } = accumulateStreamingCounter(
      inputTokens,
      lastInputTokens,
      cleanNumber(usage.input_tokens),
    ));
    ({ total: outputTokens, lastSeen: lastOutputTokens } = accumulateStreamingCounter(
      outputTokens,
      lastOutputTokens,
      cleanNumber(usage.output_tokens),
    ));
    ({ total: cachedInputTokens, lastSeen: lastCachedInputTokens } = accumulateStreamingCounter(
      cachedInputTokens,
      lastCachedInputTokens,
      cleanNumber(usage.cache_read_input_tokens),
    ));
    accumulateStreamingUsageMap(extraUsageUnits, lastExtraUsageUnits, extractRuntimeExtraUsageUnits(usage));
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
    extraUsageUnits: Object.keys(extraUsageUnits).length ? extraUsageUnits : undefined,
    cacheHit: cachedInputTokens ? true : undefined,
  };
}

export function extractGeminiUsage(response: unknown): Partial<LLMUsageEvent> {
  const record = coerceObjectRecord(response) || {};
  const usage = nestedRecord(record, 'usageMetadata', 'usage_metadata') || {};
  const promptDetails = recordField(usage, 'promptTokensDetails', 'prompt_tokens_details', 'inputTokensDetails', 'input_tokens_details');
  const completionDetails = recordField(usage, 'candidatesTokensDetails', 'candidates_tokens_details', 'responseTokensDetails', 'response_tokens_details', 'outputTokensDetails', 'output_tokens_details');
  const cachedInputTokens = cleanNumber(recordField(usage, 'cachedContentTokenCount', 'cached_content_token_count'));
  return {
    provider: cleanString(recordField(record, 'provider')) || 'gemini',
    providerRequestId: cleanString(recordField(record, 'responseId', 'response_id', 'id', 'name')),
    model: cleanString(recordField(record, 'modelVersion', 'model_version', 'model')),
    inputTokens: cleanNumber(recordField(usage, 'promptTokenCount', 'prompt_token_count', 'inputTokenCount', 'input_token_count')),
    outputTokens: cleanNumber(recordField(usage, 'responseTokenCount', 'response_token_count', 'candidatesTokenCount', 'candidates_token_count', 'outputTokenCount', 'output_token_count')),
    totalTokens: cleanNumber(recordField(usage, 'totalTokenCount', 'total_token_count')),
    reasoningTokens: cleanNumber(recordField(usage, 'thoughtsTokenCount', 'thoughts_token_count', 'reasoningTokenCount', 'reasoning_token_count')),
    cachedInputTokens,
    extraUsageUnits: extractRuntimeExtraUsageUnits(usage, promptDetails, completionDetails),
    cacheHit: cachedInputTokens ? true : undefined,
  };
}

export function extractVertexUsage(response: unknown): Partial<LLMUsageEvent> {
  return {
    ...extractGeminiUsage(response),
    provider: 'vertex_ai',
  };
}

export function extractGeminiStreamUsage(chunks: Array<unknown>): Partial<LLMUsageEvent> {
  let lastWithUsage: Record<string, unknown> | undefined;
  let providerRequestId: string | undefined;
  let model: string | undefined;
  for (const chunk of chunks) {
    const record = coerceObjectRecord(chunk);
    if (!record) {
      continue;
    }
    providerRequestId = cleanString(recordField(record, 'responseId', 'response_id', 'id', 'name')) || providerRequestId;
    model = cleanString(recordField(record, 'modelVersion', 'model_version', 'model')) || model;
    if (nestedRecord(record, 'usageMetadata', 'usage_metadata')) {
      lastWithUsage = record;
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

export function extractVertexStreamUsage(chunks: Array<unknown>): Partial<LLMUsageEvent> {
  return {
    ...extractGeminiStreamUsage(chunks),
    provider: 'vertex_ai',
  };
}

export function extractBedrockUsage(response: unknown): Partial<LLMUsageEvent> {
  const record = coerceObjectRecord(response) || {};
  const usage = nestedRecord(record, 'usage') || {};
  const metrics = nestedRecord(record, 'metrics') || {};
  const metadata = nestedRecord(record, 'ResponseMetadata') || {};
  const promptDetails = recordField(usage, 'promptTokensDetails', 'prompt_tokens_details', 'inputTokensDetails', 'input_tokens_details');
  const completionDetails = recordField(usage, 'completionTokensDetails', 'completion_tokens_details', 'outputTokensDetails', 'output_tokens_details');
  return {
    provider: 'bedrock',
    providerRequestId: cleanString(recordField(record, 'requestId', 'request_id')) || cleanString(recordField(metadata, 'RequestId')),
    model: cleanString(recordField(record, 'modelId', 'model_id', 'model')),
    inputTokens: cleanNumber(recordField(usage, 'inputTokens', 'input_tokens')),
    outputTokens: cleanNumber(recordField(usage, 'outputTokens', 'output_tokens')),
    totalTokens: cleanNumber(recordField(usage, 'totalTokens', 'total_tokens')),
    extraUsageUnits: extractRuntimeExtraUsageUnits(usage, promptDetails, completionDetails),
    latencyMs: cleanNumber(recordField(metrics, 'latencyMs', 'latency_ms')),
  };
}

/**
 * Aggregates Amazon Bedrock streaming usage deltas. Bedrock stream chunks report
 * token increments, unlike Gemini/Vertex streams where usage is cumulative in
 * the final metadata chunk.
 */
export function extractBedrockStreamUsage(chunks: Array<unknown>): Partial<LLMUsageEvent> {
  let providerRequestId: string | undefined;
  let model: string | undefined;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let lastInputTokens: number | undefined;
  let lastOutputTokens: number | undefined;
  let totalTokens: number | undefined;
  const extraUsageUnits: Record<string, number> = {};
  const lastExtraUsageUnits: Record<string, number> = {};
  let sawUsage = false;
  for (const chunk of chunks) {
    const record = coerceObjectRecord(chunk);
    if (!record) {
      continue;
    }
    providerRequestId = cleanString(recordField(record, 'requestId', 'request_id')) || providerRequestId;
    model = cleanString(recordField(record, 'modelId', 'model_id', 'model')) || model;
    const usage = nestedRecord(record, 'usage');
    if (!usage) {
      continue;
    }
    const input = cleanNumber(recordField(usage, 'inputTokens', 'input_tokens'));
    const output = cleanNumber(recordField(usage, 'outputTokens', 'output_tokens'));
    const total = cleanNumber(recordField(usage, 'totalTokens', 'total_tokens'));
    const promptDetails = recordField(usage, 'promptTokensDetails', 'prompt_tokens_details', 'inputTokensDetails', 'input_tokens_details');
    const completionDetails = recordField(usage, 'completionTokensDetails', 'completion_tokens_details', 'outputTokensDetails', 'output_tokens_details');
    const chunkExtraUsageUnits = extractRuntimeExtraUsageUnits(
      usage,
      promptDetails,
      completionDetails,
    ) || {};
    ({ total: inputTokens, lastSeen: lastInputTokens } = accumulateStreamingCounter(inputTokens, lastInputTokens, input));
    ({ total: outputTokens, lastSeen: lastOutputTokens } = accumulateStreamingCounter(outputTokens, lastOutputTokens, output));
    if (input !== undefined || output !== undefined || Object.keys(chunkExtraUsageUnits).length > 0) {
      sawUsage = true;
    }
    accumulateStreamingUsageMap(extraUsageUnits, lastExtraUsageUnits, chunkExtraUsageUnits);
    totalTokens = total ?? totalTokens;
  }
  return {
    provider: 'bedrock',
    providerRequestId,
    model,
    inputTokens: sawUsage ? inputTokens : undefined,
    outputTokens: sawUsage ? outputTokens : undefined,
    totalTokens: totalTokens ?? (sawUsage ? (inputTokens || 0) + (outputTokens || 0) : undefined),
    extraUsageUnits: Object.keys(extraUsageUnits).length ? extraUsageUnits : undefined,
  };
}

export const PROVIDER_USAGE_EXTRACTORS: ReadonlyArray<Readonly<ProviderUsageExtractorDescriptor>> = Object.freeze([
  Object.freeze({
    provider: 'openai',
    aliases: Object.freeze(['openai']),
    responseExtractor: extractOpenAIUsage,
    streamExtractor: extractOpenAIStreamUsage,
  }),
  Object.freeze({
    provider: 'azure_openai',
    aliases: Object.freeze(['azure_openai', 'azure-openai', 'azure']),
    responseExtractor: extractAzureOpenAIUsage,
    streamExtractor: (chunks: unknown[]) => ({
      ...extractOpenAIStreamUsage(chunks),
      provider: 'azure_openai',
    }),
  }),
  Object.freeze({
    provider: 'anthropic',
    aliases: Object.freeze(['anthropic']),
    responseExtractor: extractAnthropicUsage,
    streamExtractor: extractAnthropicStreamUsage,
  }),
  Object.freeze({
    provider: 'gemini',
    aliases: Object.freeze(['gemini']),
    responseExtractor: extractGeminiUsage,
    streamExtractor: extractGeminiStreamUsage,
  }),
  Object.freeze({
    provider: 'vertex_ai',
    aliases: Object.freeze(['vertex_ai', 'vertex-ai', 'vertex']),
    responseExtractor: extractVertexUsage,
    streamExtractor: extractVertexStreamUsage,
  }),
  Object.freeze({
    provider: 'bedrock',
    aliases: Object.freeze(['bedrock']),
    responseExtractor: extractBedrockUsage,
    streamExtractor: extractBedrockStreamUsage,
  }),
]);

export const PROVIDER_SUPPORT_MATRIX: ReadonlyArray<Readonly<ProviderSupportMatrixEntry>> = Object.freeze(
  PROVIDER_USAGE_EXTRACTORS.map((descriptor) => Object.freeze({
    provider: descriptor.provider,
    aliases: descriptor.aliases.slice(),
    response: true,
    stream: Boolean(descriptor.streamExtractor),
  })),
);

function findProviderUsageExtractor(provider?: string): ProviderUsageExtractorDescriptor | undefined {
  const normalized = cleanString(provider)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return PROVIDER_USAGE_EXTRACTORS.find((descriptor) => descriptor.aliases.includes(normalized));
}

export function getProviderUsageExtractor(provider?: string): LLMUsageExtractor<unknown> | undefined {
  return findProviderUsageExtractor(provider)?.responseExtractor;
}

export function getProviderStreamUsageExtractor(provider?: string): LLMUsageExtractor<unknown[]> | undefined {
  return findProviderUsageExtractor(provider)?.streamExtractor;
}

export function listSupportedProviders(): ProviderSupportMatrixEntry[] {
  return PROVIDER_SUPPORT_MATRIX.map((descriptor) => ({
    provider: descriptor.provider,
    aliases: descriptor.aliases.slice(),
    response: descriptor.response,
    stream: descriptor.stream,
  }));
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
