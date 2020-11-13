import { PartialDeep } from 'type-fest';
import { map, merge, reduce } from 'lodash';
import Joi from 'joi';
export interface Topic<T> {
  required?: boolean;
  defaults?: PartialDeep<T>;
  validator: (joi: typeof Joi) => Joi.Schema;
}

export type Loader = () => Promise<{ [key: string]: unknown }>;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function ghii<O extends { [P in keyof O]: O[P] }>() {
  type ObjectKeys = keyof O;
  type SnapshotType = { [key in ObjectKeys]: O[key] };
  type SectionsType = { [key in ObjectKeys]?: Topic<O[key]> };
  type ValidatorType = { [key in ObjectKeys]?: Joi.Schema };

  const sections: SectionsType = {};
  const validators: ValidatorType = {};
  const loaders: Loader[] = [];

  function section<K extends ObjectKeys>(name: K, topic: Topic<O[K]>): void {
    if (topic.required !== false) topic.required = true;
    sections[name] = topic;
    validators[name] = topic.validator(Joi);
  }

  function loader(loader: Loader) {
    loaders.push(loader);
  }

  function prepareDefaults(sections: SectionsType): SnapshotType {
    return reduce(
      sections,
      (acc: any, value, key) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (!value!.defaults) return acc;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        acc[key] = value!.defaults;
        return acc;
      },
      {} as SnapshotType
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

  async function takeSnapshot(): Promise<SnapshotType> {
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

export default ghii();
