import { Static, TSchema, Type } from '@sinclair/typebox';
import { Edit, Value } from '@sinclair/typebox/value';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { EventEmitter } from 'events';
import { cloneDeep, isEqual, merge } from 'lodash-es';
import path from 'node:path';
import { ValueOf } from 'type-fest';
import type TypedEventEmitter from './TypedEventEmitter';

export type Loader = () => Promise<{ [key: string]: unknown }>;

export type GhiiInstance<O extends TSchema> = {
  loader: (this: GhiiInstance<O>, loader: Loader) => GhiiInstance<O>;
  takeSnapshot: () => Promise<Snapshot<O>>;
  history: () => SnapshotVersion<O>[];
  snapshot: (newSnapshot?: Snapshot<O>) => Snapshot<O>;
  latestVersion: () => SnapshotVersion<O> | undefined;
  waitForFirstSnapshot: (
    options?: {
      timeout?: number;
      onTimeout?: () => void;
      onFirstSnapshot?: (firstSnapshot: Snapshot<O>) => Promise<void>;
    },
    ...moduleToLoad: string[]
  ) => Promise<Snapshot<O>>;
  on: ValueOf<Pick<GhiiEmitter<O>, 'on'>>;
  once: ValueOf<Pick<GhiiEmitter<O>, 'once'>>;
};
export type Snapshot<O extends TSchema> = Static<O>;
export type SnapshotVersion<O extends TSchema> = { meta: { timestamp: Date }; value: Snapshot<O> };

export interface EventTypes<O extends TSchema> {
  'ghii:version:first': undefined;
  'ghii:version:new': { value: SnapshotVersion<O>; diff: Edit[] };
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GhiiEmitter<O extends TSchema> extends TypedEventEmitter<EventTypes<O>> {}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function ghii<O extends TSchema>(buildSchema: ((type: typeof Type) => O) | O): GhiiInstance<O> {
  const schema = typeof buildSchema === 'function' ? buildSchema(Type) : buildSchema;

  const ajv = createAjv();
  const validator = createValidator(schema);

  const loaders: Loader[] = [];
  const versions: SnapshotVersion<O>[] = [];

  const events = new EventEmitter() as unknown as GhiiEmitter<O>;

  function createValidator(schema: O) {
    const v = ajv.compile<O>(schema);
    return (tested: unknown) => [v(tested), v.errors] as const;
  }

  function loader(this: GhiiInstance<O>, loader: Loader) {
    loaders.push(loader);
    return this;
  }

  function runLoaders(loaders: Loader[]) {
    return Promise.all(loaders.map(loader => loader()));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function validate(result: Snapshot<O>) {
    const [isValid, errors] = validator(result);
    if (!isValid) {
      return errors;
    }
    return undefined;
  }

  async function takeSnapshot(): Promise<Snapshot<O>> {
    const loaded = await runLoaders(loaders);

    const result: Snapshot<O> = merge({}, ...loaded);

    const validationErrors = validate(result);
    if (validationErrors) throw validationErrors;

    snapshot(result);

    return result;
  }

  function history() {
    return cloneDeep(versions);
  }

  function latestVersion() {
    if (versions.length === 0) return;
    return cloneDeep(versions[versions.length - 1]);
  }

  function snapshot(newSnapshot?: Snapshot<O>) {
    const currentSnapshot = latestVersion()?.value;
    if (newSnapshot && (!currentSnapshot || !isEqual(currentSnapshot, newSnapshot))) {
      versions.push({ meta: { timestamp: new Date() }, value: newSnapshot });
      if (versions.length === 1) events.emit('ghii:version:first', undefined);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const lastVersion = latestVersion()!;
      const diff = currentSnapshot ? Value.Diff(currentSnapshot, lastVersion.value) : [];
      events.emit('ghii:version:new', { value: lastVersion, diff });
    }
    if (currentSnapshot) {
      return currentSnapshot;
    } else if (!newSnapshot) {
      // take default if valid
      const defaults: Snapshot<O> = {};
      validate(defaults);
      return defaults;
    }
  }

  function waitForFirstSnapshot(
    options?: {
      timeout?: number;
      onTimeout?: () => void;
      onFirstSnapshot?: (firstSnapshot: Snapshot<O>) => Promise<void>;
    },
    ...moduleToLoad: string[]
  ) {
    const { timeout = 30000, onTimeout, onFirstSnapshot } = options || {};

    return new Promise<Snapshot<O>>((resolve, reject) => {
      if (latestVersion()) {
        if (onFirstSnapshot !== undefined) {
          onFirstSnapshot(snapshot());
          resolve(snapshot());
        } else if (moduleToLoad.length) {
          _tryImport(
            moduleToLoad,
            () => {
              resolve(snapshot());
            },
            reject
          );
        }
        return;
      }
      takeSnapshot().then(async snapshot => {
        if (onFirstSnapshot !== undefined) {
          onFirstSnapshot(snapshot);
          resolve(snapshot);
        } else if (moduleToLoad.length) {
          _tryImport(moduleToLoad, () => resolve(snapshot), reject);
        }
      }, reject);

      if (timeout > 0)
        setTimeout(() => {
          events.removeAllListeners('ghii:version:first');
          if (onTimeout) onTimeout();
          reject({ reason: new Error('timeout') });
        }, timeout);
    });
  }

  return {
    loader,
    takeSnapshot,
    history,
    latestVersion,
    snapshot,
    waitForFirstSnapshot,
    on: events.on.bind(events),
    once: events.once.bind(events),
  };
}

export default ghii;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _tryImport(moduleToLoad: string[], resolve: (value?: void) => void, reject: (reason?: any) => void) {
  import(path.join(...moduleToLoad))
    .then(module => {
      resolve(module);
    })
    .catch(reason => reject(reason));
}

function createAjv() {
  return addFormats(new Ajv({ useDefaults: true }), [
    'date-time',
    'time',
    'date',
    'email',
    'hostname',
    'ipv4',
    'ipv6',
    'uri',
    'uri-reference',
    'uuid',
    'uri-template',
    'json-pointer',
    'relative-json-pointer',
    'regex',
  ]).addKeyword({ type: 'null', keyword: 'typeOf' });
}
