import Ghii, { ghii } from '../src/ghii';

describe('Ghii Config', () => {
  it('Ghii is instantiable', () => {
    expect(Ghii).toBeDefined();
  });

  describe('register', () => {
    it('load default (valid) options', async () => {
      type FooType = { prop: string };
      type S3Type = { ciao: string };
      const target = ghii<{
        foo: FooType;
        foo2: FooType;
        s3: S3Type;
      }>();

      target.section('foo', {
        defaults: { prop: 'ciao' },
        validator(joi) {
          return joi.object<FooType>({
            prop: joi.string().required(),
          });
        },
      });
      target.section('foo2', {
        defaults: { prop: 'ciao' },
        validator(joi) {
          return joi.object<FooType>({
            prop: joi.string().required(),
          });
        },
      });
      target.section('s3', {
        validator: joi => joi.object({ url: joi.string().required() }).unknown(),
        defaults: { ciao: 'world' },
      });

      target.loader(async () => ({ s3: { url: 'ciao' } }));
      const result = await target.takeSnapshot();
      expect(result).toStrictEqual({
        foo: { prop: 'ciao' },
        foo2: { prop: 'ciao' },
        s3: { ciao: 'world', url: 'ciao' },
      });
    });

    it('loader (valid) options', async () => {
      type FooType = { prop: string };
      const target = ghii<{ foo: FooType }>();
      target.section('foo', {
        defaults: { prop: 'goodbye' },
        validator(joi) {
          return joi.object<FooType>({
            prop: joi.string().required(),
          });
        },
        required: false,
      });
      target.loader(async () => ({ foo: { prop: 'ciao' } }));
      const result = await target.takeSnapshot();
      expect(result).toStrictEqual({ foo: { prop: 'ciao' } });
    });

    it('loader without defaults (valid) options', async () => {
      type FooType = { prop: string };
      const target = ghii<{ foo: FooType }>();
      target.section('foo', {
        validator(joi) {
          return joi.object<FooType>({
            prop: joi.string().required(),
          });
        },
        required: true,
      });
      target.loader(async () => ({ foo: { prop: 'ciao' } }));
      const result = await target.takeSnapshot();
      expect(result).toStrictEqual({ foo: { prop: 'ciao' } });
    });

    it('loader without defaults (valid) options', async () => {
      type FooType = { prop: string };
      const target = ghii<{ foo: FooType }>();
      target.section('foo', {
        validator(joi) {
          return joi.object<FooType>({
            prop: joi.string().required(),
          });
        },
      });
      target.loader(async () => ({ foo: { prop: 'ciao' } }));
      const result = await target.takeSnapshot();
      expect(result).toStrictEqual({ foo: { prop: 'ciao' } });
    });
    it('load default (invalid) options', () => {
      type FooType = { prop: string };
      const target = ghii<{ foo: FooType }>();
      target.section('foo', {
        defaults: { prop: 'goodbye' },
        validator(joi) {
          return joi.object<FooType>({
            prop: joi.string().length(10).required(),
          });
        },
      });

      return expect(target.takeSnapshot()).rejects.toMatchObject([
        { reason: { err: true, key: 'foo' }, status: 'rejected' },
      ]);
    });

    it('load loader (invalid) options', () => {
      type FooType = { prop: string };
      const target = ghii<{ foo: FooType }>();
      target.section('foo', {
        defaults: { prop: 'goodbye' },
        validator(joi) {
          return joi.object<FooType>({
            prop: joi.string().length(7).required(),
          });
        },
      });
      target.loader(async () => ({ foo: { prop: 'ciao' } }));
      return expect(target.takeSnapshot()).rejects.toMatchObject([
        { reason: { err: true, key: 'foo' }, status: 'rejected' },
      ]);
    });

    it('load loader (invalid) options', () => {
      type FooType = { prop: string };
      const target = ghii<{ foo: FooType }>();
      target.section('foo', {
        // defaults: { prop: 'goodbye' },
        validator(joi) {
          return joi.object<FooType>({
            prop: joi.string().length(3).required(),
          });
        },
      });
      target.loader(async () => ({ foo: { prop: 'ciao' } }));
      return expect(target.takeSnapshot()).rejects.toMatchObject([
        { reason: { err: true, key: 'foo' }, status: 'rejected' },
      ]);
    });
  });
});
