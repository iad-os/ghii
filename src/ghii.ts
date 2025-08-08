import { EventEmitter } from 'node:events';
import { isDeepStrictEqual } from 'node:util';
import { cloneDeep, merge } from 'es-toolkit';
import type { Promisable, ValueOf } from 'type-fest';
import type TypedEventEmitter from './TypedEventEmitter.js';

/**
 * Shape produced by a single loader execution. All loader results are deeply merged
 * together to form the candidate configuration passed to the validation engine.
 */
type LoaderResult = {
  [key: string]: unknown;
};

/**
 * A unit of configuration loading. Loaders can be synchronous or asynchronous and
 * should return a plain object that will be deeply merged with other loader results.
 */
export type Loader = () => Promisable<LoaderResult>;

/**
 * Strongly-typed event map emitted by a running `ghii` instance.
 * - `ghii:first` is fired once when the first valid snapshot is produced.
 * - `ghii:refresh` is fired after every subsequent valid update with the active config metadata.
 */
export interface EventTypes<Config> {
  'ghii:first': undefined;
  'ghii:refresh': GhiiActiveConfig<Config>;
}

/**
 * Normalized validation error returned by the configured engine.
 * The `_raw` field contains the original engine-specific error for diagnostics.
 */
export type GhiiValidationError<RAW_Error = unknown> = {
  path: string;
  input: unknown;
  details: unknown;
  message: string;
  _raw: RAW_Error;
};
/**
 * Runtime state describing the currently active configuration.
 *
 * Version semantics:
 * - `version = 0`: no snapshot yet
 * - `version = 1`: first valid snapshot
 * - `version > 1`: subsequent updates; `previousConfig` is populated
 */
export type GhiiActiveConfig<Config> =
  | {
      version: 0;
      config: undefined;
      previousConfig: undefined;
    }
  | {
      version: 1;
      config: Config;
      previousConfig: undefined;
    }
  | {
      config: Config;
      version: number;
      previousConfig: Config;
    };
/**
 * Typed event emitter used internally by `ghii` instances.
 */
export interface GhiiEmitter<Config> extends TypedEventEmitter<EventTypes<Config>> {}

/**
 * Successful validation result carrying the validated configuration value.
 * @internal
 */
type ValidatedSnapshot<Config> = {
  success: true;
  value: Config;
};

/**
 * Discriminated union returned by the validation engine.
 */
type ValidationResult<Config> =
  | {
      success: false;
      errors: GhiiValidationError[];
    }
  | ValidatedSnapshot<Config>;

/**
 * Adapter interface a validation engine must implement.
 * Common implementations wrap schema libraries (e.g., Zod, Valibot, Ajv).
 */
export type GhiiEngine<Config> = {
  /**
   * Validate an arbitrary input value and either return the parsed `Config` or
   * a normalized list of validation errors.
   */
  validate(toValidate: unknown): ValidationResult<Config>;
  /**
   * Return a JSON Schema representation of the configuration shape.
   * Implementations may ignore `pretty` if not supported.
   */
  toJsonSchema(pretty?: boolean): string;
};

/**
 * Create a typed configuration runtime that:
 * - Collects values from one or more loaders
 * - Deeply merges loader outputs
 * - Validates the merged object through the provided engine
 * - Emits lifecycle events on first snapshot and subsequent refreshes
 *
 * The returned API is chainable via `loader(...)` and exposes utilities to
 * obtain or wait for a valid snapshot.
 *
 * Example
 * ```ts
 * type AppConfig = { port: number; featureFlags: { beta: boolean } };
 * const engine: GhiiEngine<AppConfig> = myEngine;
 *
 * const appGhii = ghii<AppConfig>(engine)
 *   .loader(() => ({ port: 3000 }))
 *   .loader(async () => ({ featureFlags: { beta: true } }));
 *
 * await appGhii.takeSnapshot();
 * const cfg = appGhii.snapshot(); // typed AppConfig
 *
 * appGhii.on('ghii:refresh', active => {
 *   // react to updates
 * });
 * ```
 */
export function ghii<Config>(ghiiEngine: GhiiEngine<Config>): {
  loader: (this: ReturnType<typeof ghii<Config>>, loader: Loader) => ReturnType<typeof ghii<Config>>;
  takeSnapshot: () => Promise<Config>;
  snapshot: () => Config;
  waitForSnapshot: (options?: {
    timeout?: number;
    onTimeout?: () => void;
    onValidSnapshot?: (firstSnapshot: Config) => Promise<void>;
  }) => Promise<Config>;
  on: ValueOf<Pick<GhiiEmitter<Config>, 'on'>>;
  once: ValueOf<Pick<GhiiEmitter<Config>, 'once'>>;
  jsonSchema: () => string;
} {
  const loaders: Loader[] = [];

  const _activeConfig: GhiiActiveConfig<Config> = { version: 0, config: undefined, previousConfig: undefined };

  const events = new EventEmitter() as unknown as GhiiEmitter<Config>;
  /**
   * Register a loader that contributes a partial configuration object.
   * Returns the same instance for chaining.
   */
  function addLoader(this: ReturnType<typeof ghii<Config>>, loader: Loader): ReturnType<typeof ghii<Config>> {
    loaders.push(loader);
    return this;
  }

  /**
   * Execute all loaders in parallel and collect their results.
   * @internal
   */
  function runLoaders(loaders: Loader[]) {
    return Promise.all(loaders.map(loader => loader()));
  }

  /**
   * Run loaders, merge results, validate, and update internal state.
   * Emits `ghii:first` on the first valid snapshot and `ghii:refresh` on changes.
   * If the validated config is identical to the active one, it is reused without emitting.
   * @throws GhiiValidationError[] when validation fails
   */
  async function takeSnapshot(): Promise<Config> {
    const loaded = await runLoaders(loaders);

    // Ensure loaded is an array of Config and merge correctly
    const merged = loaded.reduce((acc, curr) => merge(acc, curr), {} as LoaderResult);
    const result = await ghiiEngine.validate(merged);
    if (!result.success) throw result.errors;

    if (_activeConfig.config && isDeepStrictEqual(_activeConfig.config, result.value)) {
      return result.value;
    }
    return await _updateSnapshot(result);
  }

  /**
   * Synchronously access the latest valid configuration snapshot.
   * @throws Error if called before any valid snapshot exists
   */
  function snapshot() {
    if (!_activeConfig.version || !_activeConfig.config) {
      throw new Error('No snapshot found, call takeSnapshot first or waitForSnapshot'); // take default if valid
    } else {
      return _activeConfig.config;
    }
  }
  /**
   * Replace internal snapshot and broadcast events.
   * @internal
   */
  async function _updateSnapshot(newSnapshot: ValidatedSnapshot<Config>): Promise<Config> {
    _activeConfig.version = _activeConfig.version + 1;
    if (_activeConfig.version === 1) {
      events.emit('ghii:first', undefined);
    }
    _activeConfig.previousConfig = _activeConfig.config;
    _activeConfig.config = newSnapshot.value;
    events.emit('ghii:refresh', cloneDeep(_activeConfig) as GhiiActiveConfig<Config>);
    return newSnapshot.value;
  }

  function waitForSnapshot(options?: {
    timeout?: number;
    onTimeout?: () => void;
    onValidSnapshot?: (firstSnapshot: Config) => Promise<void>;
  }) {
    const { timeout = 30000, onTimeout, onValidSnapshot } = options || {};

    return new Promise<Config>((resolve, reject) => {
      if (_activeConfig.version) {
        if (_activeConfig.version > 0 && onValidSnapshot !== undefined) {
          onValidSnapshot(snapshot());
        }
        resolve(snapshot());
        return;
      }
      let timeoutId: NodeJS.Timeout;
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          events.removeAllListeners('ghii:first');
          events.removeAllListeners('ghii:refresh');
          if (onTimeout) onTimeout();
          reject({ reason: new Error('timeout waiting for snapshot') });
        }, timeout);
      }

      takeSnapshot().then(
        async snapshot => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          if (onValidSnapshot !== undefined) {
            onValidSnapshot(snapshot);
          }
          resolve(snapshot);
        },
        (reason: unknown) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          reject(reason);
        }
      );
    });
  }

  return {
    /** Add a loader; chainable. */
    loader: addLoader,
    /** Compute and store a valid configuration snapshot. */
    takeSnapshot,
    /** Get the current snapshot; throws if none is available yet. */
    snapshot,
    /**
     * Resolve with a valid snapshot as soon as it exists.
     * - If already available, resolves immediately and optionally runs `onValidSnapshot`.
     * - If not yet available, waits up to `timeout` ms and rejects on timeout.
     */
    waitForSnapshot,
    /** Subscribe to `ghii:first` and `ghii:refresh` events. */
    on: events.on.bind(events),
    /** Subscribe once to `ghii:first` or `ghii:refresh` events. */
    once: events.once.bind(events),
    /** Serialize the configuration schema to JSON Schema via the engine. */
    jsonSchema() {
      return ghiiEngine.toJsonSchema();
    },
  };
}
