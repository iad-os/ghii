import { values } from 'lodash'
import Ghii, { ghii } from '../src/ghii'

describe('Ghii Config', () => {
  it('Ghii is instantiable', () => {
    expect(Ghii).toBeDefined()
  })

  describe('register', () => {
    it('load default (valid) options', async () => {
      const target = ghii()
      target.add('topicName', {
        defaults: { test: true, value: 11, name: 'test' },
        async validator(values) {
          if (values.name == 'test' && values.test == true && values.value > 10) return
          throw new Error('Validation Failed')
        },
      })
      target.add('two', {
        defaults: { test: true, value: 0, name: 'test' },
        async validator(values) {
          if (values.name == 'test' && values.test == true && values.value < 10) return
          throw new Error('Validation Failed')
        },
      })

      const result = await target.load()
      expect({
        topicName: { test: true, value: 11, name: 'test' },
        two: { test: true, value: 0, name: 'test' },
      }).toEqual(result)
    })
    it('load options from dummy loader', async () => {
      const target = ghii()
      target.add('a', {
        defaults: { value: true },
        validator: async (values) => {
          if (!values.value) throw new Error('not valid')
        },
      })
      target.loader(async () => ({ a: { value: true } }))
      const result = await target.load()
      expect({
        a: { value: true },
      }).toEqual(result)
    })

    it('throws if validation fail', async () => {
      const target = ghii()
      target.add('a', {
        defaults: { value: true },
        validator: async (values) => {
          if (!values.value) throw new Error('not valid')
        },
      })
      target.add('b', {
        defaults: { int: 1 },
        validator: async (values) => {
          if (values.int !== 1) throw new Error('not valid')
        },
      })
      target.add('c', {
        defaults: { value: true },
        validator: async (values) => {
          if (values.value) throw new Error('not valid')
        },
      })
      target.loader(async () => ({ a: { value: false }, b: { int: 10 } }))
      try {
        const result = await target.load()
        fail()
      } catch (errors) {
        expect(errors).toHaveLength(3)
      }
    })
  })
})
