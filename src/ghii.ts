import { EventEmitter } from 'events';
import Joi from 'joi';
import { cloneDeep, map, merge, reduce } from 'lodash';
import path from 'path';
import { PartialDeep, ValueOf } from 'type-fest';
import TypedEventEmitter from './TypedEventEmitter';

/**
 * A Topic that support
 * @export
 * @interface Topic
 * @param T
 * @property {PartialDeep<T> | undefined} defaults
 * @method {Joi.Schema} validator {@param {typeof Joi} joi}
 */
export interface Topic<T> {
  defaults?: PartialDeep<T> | T;
  validator: (joi: typeof Joi) => Joi.Schema;
}
/**
 * A type that rappresent a loader in where each key rapresents
 * the loader name
 * @export
 * @type Loader
 *  */
export type Loader = () => Promise<{ [key: string]: unknown }>;

/** @type GhiiInstance */
export type GhiiInstance<O extends { [P in keyof O]: O[P] }> = {
  section: <K extends keyof O>(this: GhiiInstance<O>, name: K, topic: Topic<O[K]>) => GhiiInstance<O>;
  loader: (this: GhiiInstance<O>, loader: Loader) => GhiiInstance<O>;
  takeSnapshot: () => Promise<{ [key in keyof O]: O[key] }>;
  history: () => SnapshotVersion<O>[];
  snapshot: (newSnapshot?: Snapshot<O>) => O;
  latestVersion: () => SnapshotVersion<O> | undefined;
  waitForFirstSnapshot: (
    options?: { timeout?: number; onTimeout?: () => void },
    ...moduleToLoad: string[]
  ) => Promise<O>;
  on: ValueOf<Pick<GhiiEmitter<EventTypes<O>>, 'on'>>;
  once: ValueOf<Pick<GhiiEmitter<EventTypes<O>>, 'once'>>;
};
/**@type Snapshot */
export type Snapshot<O extends { [P in keyof O]: O[P] }> = { [P in keyof O]: O[P] };
/**@type Sections */
export type Sections<O extends { [P in keyof O]: O[P] }> = { [key in keyof O]?: Topic<O[key]> };
/**@type Validator */
export type Validator<O extends { [P in keyof O]: O[P] }> = { [key in keyof O]?: Joi.Schema };
/**@type SnapshotVersion */
export type SnapshotVersion<O extends { [P in keyof O]: O[P] }> = { meta: { timestamp: Date }; value: Snapshot<O> };

/**@interface EventTypes */
export interface EventTypes<O> {
  'ghii:version:first': undefined;
  'ghii:version:new': SnapshotVersion<O>;
}
/**@interface GhiiEmitter */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GhiiEmitter<O> extends TypedEventEmitter<EventTypes<O>> {}
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types

/**
 * @description Instance of Ghii object
 * @type {O extends { [P in keyof O]: O[P] }}
 * @returns GhiiInstance
 */
export function ghii<O extends { [P in keyof O]: O[P] }>(): GhiiInstance<O> {
  type ObjectKeys = keyof O;

  const sections: Sections<O> = {};
  const validators: Validator<O> = {};
  const loaders: Loader[] = [];
  const versions: SnapshotVersion<O>[] = [];

  const events = (new EventEmitter() as unknown) as GhiiEmitter<O>;
  /**
   * Create a section and return the updated object
   * @property  {GhiiInstance<O>} section
   * @param {GhiiInstance<O>} this
   * @param {K} name
   * @param {Topic<O[K]>} topic
   */
  function section<K extends ObjectKeys>(this: GhiiInstance<O>, name: K, topic: Topic<O[K]>): ReturnType<typeof ghii> {
    sections[name] = topic;
    validators[name] = topic.validator(Joi);
    return this;
  }

  /** Create a loader and return the updated object
   * @property {GhiiInstance<O>}loader
   * @param {GhiiInstance<O>} this
   * @param {Loader} loader
   */
  function loader(this: GhiiInstance<O>, loader: Loader) {
    loaders.push(loader);
    return this;
  }

  /** Return loaders
   * @param {Loader[]} loaders
   * @return Promise of all loaders
   */
  function runLoaders(loaders: Loader[]) {
    return Promise.all(loaders.map(loader => loader()));
  }

  function prepareDefaults(sections: Sections<O>): Snapshot<O> {
    return reduce(
      sections,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  /** @property {Promise<{ [key in keyof O]: O[key] }>} takeSnapshot */
  async function takeSnapshot(): Promise<Snapshot<O>> {
    const defaults = prepareDefaults(sections);

    const loaded = await runLoaders(loaders);

    const result: O = merge({}, defaults, ...loaded);
    const validationErrors = await validate(validators, result);
    if (validationErrors.length) throw validationErrors;
    snapshot(result);
    return result;
  }

  /** returns a deep copy of snapshot versions
   * @property {SnapShotVersion<O>[]} history
   */
  function history() {
    return cloneDeep(versions);
  }

  /**
   * Return latest snapshot version
   * @property {SnapshotVersion<O> | undefined} latestVersion
   */
  function latestVersion() {
    if (versions.length === 0) return;
    return cloneDeep(versions[versions.length - 1]);
  }

  /**
   * returns latest version or the default
   * @property {O} snapshot
   * @param {Snapshot<O>} snapshot */
  function snapshot(newSnapshot?: Snapshot<O>) {
    if (newSnapshot) {
      versions.push({ meta: { timestamp: new Date() }, value: newSnapshot });
      if (versions.length === 1) events.emit('ghii:version:first', undefined);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      events.emit('ghii:version:new', latestVersion()!);
    }
    return latestVersion()?.value ?? prepareDefaults(sections);
  }

  /** wait for the first snapshot
   * @property {SnapShotVersion | undefined} latestVersion
   */
  function waitForFirstSnapshot(options?: { timeout?: number; onTimeout?: () => void }, ...moduleToLoad: string[]) {
    const { timeout = 30000, onTimeout } = options || {};

    return new Promise<O>((resolve, reject) => {
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
    section,
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
