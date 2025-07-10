import { EventEmitter } from 'node:events';
import { isDeepStrictEqual } from 'node:util';
import cloneDeep from 'lodash.clonedeep';
import merge from 'lodash.merge';
import type { ValueOf } from 'type-fest';
import type TypedEventEmitter from './TypedEventEmitter.js';

export type Loader = () => Promise<{ [key: string]: unknown }> | { [key: string]: unknown };

export interface EventTypes<Config> {
  'ghii:first': undefined;
  'ghii:refresh': GhiiActiveConfig<Config>;
}

export type GhiiValidationError<RAW_Error = unknown> = {
  path: string;
  input: unknown;
  details: unknown;
  message: string;
  _raw: RAW_Error;
};
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
export interface GhiiEmitter<Config> extends TypedEventEmitter<EventTypes<Config>> {}

export type GhiiEngine<Config> = {
  validate(toValidate: Config): { success: false; errors: GhiiValidationError[] } | { success: true; value: Config };
  toJsonSchema(pretty?: boolean): string;
};

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
  function addLoader(this: ReturnType<typeof ghii<Config>>, loader: Loader): ReturnType<typeof ghii<Config>> {
    loaders.push(loader);
    return this;
  }

  function runLoaders(loaders: Loader[]) {
    return Promise.all(loaders.map(loader => loader()));
  }

  async function takeSnapshot(): Promise<Config> {
    const loaded = await runLoaders(loaders);

    const result: Config = merge({}, ...loaded);

    return await _updateSnapshot(result);
  }

  function snapshot() {
    if (!_activeConfig.version || !_activeConfig.config) {
      throw new Error('No snapshot found, call takeSnapshot first or waitForSnapshot'); // take default if valid
    } else {
      return _activeConfig.config;
    }
  }
  async function _updateSnapshot(newSnapshot: Config): Promise<Config> {
    const result = await ghiiEngine.validate(newSnapshot);
    if (!result.success) throw result.errors;

    if (_activeConfig.config && isDeepStrictEqual(_activeConfig.config, result.value)) {
      return result.value;
    }

    _activeConfig.version = _activeConfig.version + 1;
    if (_activeConfig.version === 1) {
      events.emit('ghii:first', undefined);
    }
    _activeConfig.previousConfig = _activeConfig.config;
    _activeConfig.config = result.value;
    events.emit('ghii:refresh', cloneDeep(_activeConfig) as GhiiActiveConfig<Config>);
    return result.value;
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
      takeSnapshot().then(async snapshot => {
        if (onValidSnapshot !== undefined) {
          onValidSnapshot(snapshot);
        }
        resolve(snapshot);
      }, reject);

      if (timeout > 0)
        setTimeout(() => {
          events.removeAllListeners('ghii:first');
          events.removeAllListeners('ghii:refresh');
          if (onTimeout) onTimeout();
          reject({ reason: new Error('timeout waiting for snapshot') });
        }, timeout);
    });
  }

  return {
    loader: addLoader,
    takeSnapshot,
    snapshot,
    waitForSnapshot,
    on: events.on.bind(events),
    once: events.once.bind(events),
    jsonSchema() {
      return ghiiEngine.toJsonSchema();
    },
  };
}
