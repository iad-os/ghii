import { Static, TSchema } from '@sinclair/typebox';
import { Value, ValueError } from '@sinclair/typebox/value';
import { EventEmitter } from 'events';
import { cloneDeep, isEqual, merge } from 'lodash';
import path from 'path';
import { ValueOf } from 'type-fest';
import TypedEventEmitter from './TypedEventEmitter';

export type Loader = () => Promise<{ [key: string]: unknown }>;

export type GhiiInstance<O extends TSchema> = {
  loader: (this: GhiiInstance<O>, loader: Loader) => GhiiInstance<O>;
  takeSnapshot: () => Promise<Snapshot<O>>;
  history: () => SnapshotVersion<O>[];
  snapshot: (newSnapshot?: Snapshot<O>) => Snapshot<O>;
  latestVersion: () => SnapshotVersion<O> | undefined;
  waitForFirstSnapshot: (
    options?: { timeout?: number; onTimeout?: () => void },
    ...moduleToLoad: string[]
  ) => Promise<Snapshot<O>>;
  on: ValueOf<Pick<GhiiEmitter<O>, 'on'>>;
  once: ValueOf<Pick<GhiiEmitter<O>, 'once'>>;
};
export type Snapshot<O extends TSchema> = Static<O>;
export type SnapshotVersion<O extends TSchema> = { meta: { timestamp: Date }; value: Snapshot<O> };

export interface EventTypes<O extends TSchema> {
  'ghii:version:first': undefined;
  'ghii:version:new': SnapshotVersion<O>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GhiiEmitter<O extends TSchema> extends TypedEventEmitter<EventTypes<O>> {}
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function ghii<O extends TSchema>(schema: O): GhiiInstance<O> {
  const loaders: Loader[] = [];
  const versions: SnapshotVersion<O>[] = [];

  const events = (new EventEmitter() as unknown) as GhiiEmitter<O>;

  function loader(this: GhiiInstance<O>, loader: Loader) {
    loaders.push(loader);
    return this;
  }

  function runLoaders(loaders: Loader[]) {
    return Promise.all(loaders.map(loader => loader()));
  }

  function prepareDefaults(): Snapshot<O> {
    return Value.Create(schema);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function validate(result: Snapshot<O>) {
    let validationsError: ValueError[] = [];

    if (!Value.Check(schema, result)) {
      validationsError = [...Value.Errors(schema, result)];
    }
    return validationsError;
  }

  async function takeSnapshot(): Promise<Snapshot<O>> {
    const defaults = prepareDefaults();

    const loaded = await runLoaders(loaders);

    const result: Snapshot<O> = merge({}, defaults, ...loaded);

    const validationErrors = validate(result);
    if (validationErrors.length) throw validationErrors;

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
      events.emit('ghii:version:new', latestVersion()!);
    }
    return latestVersion()?.value ?? prepareDefaults();
  }

  function waitForFirstSnapshot(options?: { timeout?: number; onTimeout?: () => void }, ...moduleToLoad: string[]) {
    const { timeout = 30000, onTimeout } = options || {};

    return new Promise<Snapshot<O>>((resolve, reject) => {
      if (latestVersion()) {
        _tryImport(
          moduleToLoad,
          () => {
            resolve(snapshot());
          },
          reject
        );
        return;
      }
      takeSnapshot().then(snapshot => {
        _tryImport(moduleToLoad, () => resolve(snapshot), reject);
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
