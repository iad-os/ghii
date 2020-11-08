import { DeepPartial } from 'ts-essentials'
import { map, merge, reduce } from 'lodash'

export interface Topic<T> {
  type?: T
  required?: boolean
  defaults: DeepPartial<T>
  validator: (values: T) => Promise<void>
}

type ExtractTopicType<P> = P extends Topic<infer T> ? T : never

export type Loader = () => Promise<{ [key: string]: unknown }>

export function ghii() {
  const conf: { [key: string]: Topic<any> } = {}

  const loaders: Loader[] = []

  function add<T>(name: string, topic: Topic<T>): void {
    if (!topic.required) topic.required = true
    conf[name] = topic
  }

  function loader(loader: Loader) {
    loaders.push(loader)
  }

  async function load() {
    const defaults = reduce(
      conf,
      (acc, value, key) => {
        acc[key] = value.defaults as Topic<typeof value.type>
        return acc
      },
      {} as { [key: string]: Topic<unknown> }
    )

    const loaded = await Promise.all(loaders.map((loader) => loader()))

    const result = merge({}, defaults, ...loaded)
    const validation = await Promise.allSettled(
      map(
        conf,
        (topic, key) =>
          new Promise((resolve, reject) => {
            topic.validator(result[key]).then(
              () => {
                resolve({ key, err: false })
              },
              (err) => {
                reject({ key, err })
              }
            )
          })
      )
    )
    const validationErrors = validation.filter((promise) => promise.status === 'rejected')
    if (validationErrors.length) throw validationErrors
    return result
  }

  return {
    add,
    loader,
    load,
  }
}

export default ghii()
