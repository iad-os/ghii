import { PartialDeep } from 'type-fest';
import { map, merge, reduce } from 'lodash';
import Joi from 'joi';
export interface Topic<T> {
  required?: boolean;
  defaults?: PartialDeep<T> | T;
  validator: (joi: typeof Joi) => Joi.Schema;
}

export type Loader = () => Promise<{ [key: string]: unknown }>;

export type GhiiInstance<O extends { [P in keyof O]: O[P] }> = {
  section: <K extends keyof O>(name: K, topic: Topic<O[K]>) => GhiiInstance<O>;
  loader: (loader: Loader) => GhiiInstance<O>;
  takeSnapshot: () => Promise<{ [key in keyof O]: O[key] }>;
};

export type SnapshotType<O extends { [P in keyof O]: O[P] }> = { [P in keyof O]: O[P] };
export type SectionsType<O extends { [P in keyof O]: O[P] }> = { [key in keyof O]?: Topic<O[key]> };
export type ValidatorType<O extends { [P in keyof O]: O[P] }> = { [key in keyof O]?: Joi.Schema };

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function ghii<O extends { [P in keyof O]: O[P] }>(): GhiiInstance<O> {
  type ObjectKeys = keyof O;

  const sections: SectionsType<O> = {};
  const validators: ValidatorType<O> = {};
  const loaders: Loader[] = [];

  function section<K extends ObjectKeys>(
    this: ReturnType<typeof ghii>,
    name: K,
    topic: Topic<O[K]>
  ): ReturnType<typeof ghii> {
    if (topic.required !== false) topic.required = true;
    sections[name] = topic;
    validators[name] = topic.validator(Joi);
    return this;
  }

  function loader(this: ReturnType<typeof ghii>, loader: Loader) {
    loaders.push(loader);
    return this;
  }

  function prepareDefaults(sections: SectionsType<O>): SnapshotType<O> {
    return reduce(
      sections,
      (acc: any, value, key) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (!value!.defaults) return acc;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        acc[key] = value!.defaults;
        return acc;
      },
      {} as SnapshotType<O>
    );
  }

  function runLoaders(loaders: Loader[]) {
    return Promise.all(loaders.map(loader => loader()));
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

  async function takeSnapshot(): Promise<SnapshotType<O>> {
    const defaults = prepareDefaults(sections);

    const loaded = await runLoaders(loaders);

    const result: O = merge({}, defaults, ...loaded);
    const validationErrors = await validate(validators, result);
    if (validationErrors.length) throw validationErrors;
    return result;
  }

  return {
    section,
    loader,
    takeSnapshot,
  };
}

export default ghii;
