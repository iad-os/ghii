import { EventEmitter } from 'events';
import Joi from 'joi';
import { cloneDeep, map, merge, reduce } from 'lodash';
import { PartialDeep, ValueOf } from 'type-fest';
import TypedEventEmitter from './TypedEventEmitter';
export interface Topic<T> {
  required?: boolean;
  defaults?: PartialDeep<T> | T;
  validator: (joi: typeof Joi) => Joi.Schema;
}

export type Loader = () => Promise<{ [key: string]: unknown }>;

export type GhiiInstance<O extends { [P in keyof O]: O[P] }> = {
  section: <K extends keyof O>(this: GhiiInstance<O>, name: K, topic: Topic<O[K]>) => GhiiInstance<O>;
  loader: (this: GhiiInstance<O>, loader: Loader) => GhiiInstance<O>;
  takeSnapshot: () => Promise<{ [key in keyof O]: O[key] }>;
  history: () => SnapshotVersion<O>[];
  snapshot: (newSnapshot?: Snapshot<O>) => O | undefined;
  latestVersion: () => SnapshotVersion<O> | undefined;
  waitForFirstSnapshot: (moduleToLoad: string) => Promise<void>;
  on: ValueOf<Pick<GhiiEmitter<EventTypes<O>>, 'on'>>;
  once: ValueOf<Pick<GhiiEmitter<EventTypes<O>>, 'once'>>;
};
export type Snapshot<O extends { [P in keyof O]: O[P] }> = { [P in keyof O]: O[P] };
export type Sections<O extends { [P in keyof O]: O[P] }> = { [key in keyof O]?: Topic<O[key]> };
export type Validator<O extends { [P in keyof O]: O[P] }> = { [key in keyof O]?: Joi.Schema };
export type SnapshotVersion<O extends { [P in keyof O]: O[P] }> = { meta: { timestamp: Date }; value: Snapshot<O> };

export interface EventTypes<O> {
  'ghii:version:first': undefined;
  'ghii:version:new': SnapshotVersion<O>;
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GhiiEmitter<O> extends TypedEventEmitter<EventTypes<O>> {}
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function ghii<O extends { [P in keyof O]: O[P] }>(): GhiiInstance<O> {
  type ObjectKeys = keyof O;

  const sections: Sections<O> = {};
  const validators: Validator<O> = {};
  const loaders: Loader[] = [];
  const versions: SnapshotVersion<O>[] = [];

  const events = (new EventEmitter() as unknown) as GhiiEmitter<O>;
  function section<K extends ObjectKeys>(this: GhiiInstance<O>, name: K, topic: Topic<O[K]>): ReturnType<typeof ghii> {
    if (topic.required !== false) topic.required = true;
    sections[name] = topic;
    validators[name] = topic.validator(Joi);
    return this;
  }

  function loader(this: GhiiInstance<O>, loader: Loader) {
    loaders.push(loader);
    return this;
  }

  function runLoaders(loaders: Loader[]) {
    return Promise.all(loaders.map(loader => loader()));
  }

  function prepareDefaults(sections: Sections<O>): Snapshot<O> {
    return reduce(
      sections,
      (acc: any, value, key) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (!value!.defaults) return acc;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        acc[key] = value!.defaults;
        return acc;
      },
      {} as Snapshot<O>
    );
  }

  async function validate(validators: { [key in ObjectKeys]?: Joi.Schema }, result: any) {
    const validation = await Promise.allSettled(
      map(
        validators,
        (validator, key) =>
          new Promise((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            validator!.validateAsync(result[key]).then(
              value => {
                resolve({ key, err: false, value });
              },
              reason => {
                reject({ key, err: true, reason });
              }
            );
          })
      )
    );
    return validation.filter(promise => promise.status === 'rejected');
  }

  async function takeSnapshot(): Promise<Snapshot<O>> {
    const defaults = prepareDefaults(sections);

    const loaded = await runLoaders(loaders);

    const result: O = merge({}, defaults, ...loaded);
    const validationErrors = await validate(validators, result);
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
    if (newSnapshot) {
      versions.push({ meta: { timestamp: new Date() }, value: newSnapshot });
      if (versions.length === 1) events.emit('ghii:version:first', undefined);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      events.emit('ghii:version:new', latestVersion()!);
    }
    return latestVersion()?.value;
  }

  function waitForFirstSnapshot(moduleToLoad: string) {
    return new Promise<void>((resolve, reject) => {
      if (latestVersion()) {
        _tryImport(moduleToLoad, resolve, reject);
      }
      events.once('ghii:version:new', () => {
        _tryImport(moduleToLoad, resolve, reject);
      });
    });
  }

  return {
    section,
    loader,
    takeSnapshot,
    history,
    latestVersion,
    snapshot,
    waitForFirstSnapshot,
    on: events.on,
    once: events.once,
  };
}

export default ghii;
function _tryImport(moduleToLoad: string, resolve: (value?: void) => void, reject: (reason?: any) => void) {
  import(moduleToLoad)
    .then(module => {
      resolve(module);
    })
    .catch(reject);
}
