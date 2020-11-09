import { PartialDeep } from 'type-fest';
import { map, merge, reduce } from 'lodash';
import Joi from 'joi';
export interface Topic<T> {
  required?: boolean;
  defaults?: PartialDeep<T>;
  validator: (joi: typeof Joi) => Joi.Schema;
}

export type Loader = () => Promise<{ [key: string]: unknown }>;

export function ghii() {
  const sections: { [key: string]: Topic<any> } = {};
  const validators: { [key in keyof typeof sections]: Joi.Schema } = {};
  const loaders: Loader[] = [];

  function section<T>(name: string, topic: Topic<T>): void {
    if (!topic.required) topic.required = true;
    sections[name] = topic;
    validators[name] = topic.validator(Joi);
  }

  function loader(loader: Loader) {
    loaders.push(loader);
  }

  async function load() {
    const defaults = reduce(
      sections,
      (acc, value, key) => {
        acc[key] = value.defaults as Topic<typeof value.defaults>;
        return acc;
      },
      {} as { [key: string]: Topic<unknown> }
    );

    const loaded = await Promise.all(loaders.map(loader => loader()));

    const result = merge({}, defaults, ...loaded);
    const validation = await Promise.allSettled(
      map(
        validators,
        (validator, key) =>
          new Promise((resolve, reject) => {
            validator.validateAsync(result[key]).then(
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
    const validationErrors = validation.filter(promise => promise.status === 'rejected');
    if (validationErrors.length) throw validationErrors;
    return result;
  }

  return {
    section,
    loader,
    load,
  };
}

export default ghii();
