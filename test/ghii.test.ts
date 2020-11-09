import Joi from 'joi';
import { values } from 'lodash';
import Ghii, { ghii } from '../src/ghii';

describe('Ghii Config', () => {
  it('Ghii is instantiable', () => {
    expect(Ghii).toBeDefined();
  });

  describe('register', () => {
    it('load default (valid) options', async () => {
      const target = ghii();
      type FooType = { prop: string };
      target.section<FooType>('foo', {
        defaults: { prop: 'ciao' },
        validator(joi) {
          return joi.object<FooType>({
            prop: joi.string().required(),
          });
        },
      });
      const result = await target.load();
      expect(result).toStrictEqual({ foo: { prop: 'ciao' } });
    });

    it('loader (valid) options', async () => {
      const target = ghii();
      type FooType = { prop: string };
      target.section<FooType>('foo', {
        defaults: { prop: 'goodbye' },
        validator(joi) {
          return joi.object<FooType>({
            prop: joi.string().required(),
          });
        },
      });
      target.loader(async () => ({ foo: { prop: 'ciao' } }));
      const result = await target.load();
      expect(result).toStrictEqual({ foo: { prop: 'ciao' } });
    });

    it('load default (invalid) options', () => {
      const target = ghii();
      type FooType = { prop: string };
      target.section<FooType>('foo', {
        defaults: { prop: 'goodbye' },
        validator(joi) {
          return joi.object<FooType>({
            prop: joi.string().length(10).required(),
          });
        },
      });

      return expect(target.load()).rejects.toMatchObject([{ reason: { err: true, key: 'foo' }, status: 'rejected' }]);
    });

    it('load loader (invalid) options', () => {
      const target = ghii();
      type FooType = { prop: string };
      target.section<FooType>('foo', {
        defaults: { prop: 'goodbye' },
        validator(joi) {
          return joi.object<FooType>({
            prop: joi.string().length(7).required(),
          });
        },
      });
      target.loader(async () => ({ foo: { prop: 'ciao' } }));
      return expect(target.load()).rejects.toMatchObject([{ reason: { err: true, key: 'foo' }, status: 'rejected' }]);
    });

    it('load loader (invalid) options', () => {
      const target = ghii();
      type FooType = { prop: string };
      target.section<FooType>('foo', {
        // defaults: { prop: 'goodbye' },
        validator(joi) {
          return joi.object<FooType>({
            prop: joi.string().length(3).required(),
          });
        },
      });
      target.loader(async () => ({ foo: { prop: 'ciao' } }));
      return expect(target.load()).rejects.toMatchObject([{ reason: { err: true, key: 'foo' }, status: 'rejected' }]);
    });
  });
});
