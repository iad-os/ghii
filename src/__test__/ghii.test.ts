import { isEqual } from 'lodash';
import { fakeTimeoutLoader } from '../fakeLoaders';
import Ghii, { ghii } from '../ghii';

describe('Ghii Config', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  it('Ghii is instantiable', () => {
    expect(Ghii).toBeDefined();
  });

  describe('base configs', () => {
    it('load default (valid) options', async () => {
      type FooType = { prop: string };
      type S3Type = { ciao: string };
      const target = ghii<{
        foo: FooType;
        foo2: FooType;
        s3: S3Type;
      }>();

      target
        .section('foo', {
          defaults: { prop: 'ciao' },
          schema(Type) {
            return Type.Object({
              prop: Type.String(),
            });
          },
        })
        .section('foo2', {
          defaults: { prop: 'ciao' },
          schema(Type) {
            return Type.Object({
              prop: Type.String(),
            });
          },
        })
        .section('s3', {
          schema: Type => Type.Object({ url: Type.String() }),
          defaults: { ciao: 'world' },
        })
        .loader(async () => ({ s3: { url: 'ciao' } }));
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
        schema(Type) {
          return Type.Object({
            prop: Type.String(),
          });
        },
      });
      target.loader(async () => ({ foo: { prop: 'ciao' } }));
      const result = await target.takeSnapshot();
      expect(result).toStrictEqual({ foo: { prop: 'ciao' } });
    });

    it('simple property (valid) options', async () => {
      type FooType = 'a' | 'b';
      const target = ghii<{ foo: FooType }>();
      target.section('foo', {
        defaults: 'a',
        schema(Type) {
          return Type.Union([Type.Literal('a'), Type.Literal('b')]);
        },
      });
      target.loader(async () => ({ foo: 'b' }));
      const result = await target.takeSnapshot();
      expect(result).toStrictEqual({ foo: 'b' });
    });

    it('loader without defaults (valid) options', async () => {
      type FooType = { prop: string };
      const target = ghii<{ foo: FooType }>();
      target.section('foo', {
        schema(Type) {
          return Type.Object({
            prop: Type.String(),
          });
        },
      });
      target.loader(async () => ({ foo: { prop: 'ciao' } }));
      const result = await target.takeSnapshot();
      expect(result).toStrictEqual({ foo: { prop: 'ciao' } });
    });

    it('loader without defaults (valid) options', async () => {
      type FooType = { prop: string };
      const target = ghii<{ foo: FooType }>();
      target.section('foo', {
        schema(Type) {
          return Type.Object({
            prop: Type.String(),
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
        schema(Type) {
          return Type.Object({
            prop: Type.String({ maxLength: 10, minLength: 10 }),
          });
        },
      });

      return expect(target.takeSnapshot()).rejects.toMatchObject([{ path: '/prop', value: 'goodbye', section: 'foo' }]);
    });

    it('load loader (invalid) options', () => {
      type FooType = { prop: string };
      const target = ghii<{ foo: FooType }>();
      target.section('foo', {
        defaults: { prop: 'goodbye' },
        schema(Type) {
          return Type.Object({
            prop: Type.String({ maxLength: 7, minLength: 7 }),
          });
        },
      });
      target.loader(async () => ({ foo: { prop: 'ciao' } }));
      return expect(target.takeSnapshot()).rejects.toMatchObject([{ path: '/prop', value: 'ciao', section: 'foo' }]);
    });

    it('load loader (invalid) options', () => {
      type FooType = { prop: string };
      const target = ghii<{ foo: FooType }>();
      target.section('foo', {
        // defaults: { prop: 'goodbye' },
        schema(Type) {
          return Type.Object({
            prop: Type.String({ maxLength: 3, minLength: 3 }),
          });
        },
      });
      target.loader(async () => ({ foo: { prop: 'ciao' } }));
      return expect(target.takeSnapshot()).rejects.toMatchObject([{ path: '/prop', value: 'ciao', section: 'foo' }]);
    });
    it('load breaking change version', async () => {
      type FooType = { prop: string };
      const target = ghii<{ foo: FooType }>();
      target.section('foo', {
        breakingChange(old, current) {
          const changed = !isEqual(old, current);
          return changed;
        },
        schema(Type) {
          return Type.Object({
            prop: Type.String(),
          });
        },
      });
      target.loader(async () => ({ foo: { prop: 'ciao' } }));
      await target.takeSnapshot();

      return new Promise(resolve => {
        console.log = jest.fn();
        target.loader(async () => ({ foo: { prop: 'hallo' } }));
        target.takeSnapshot();
        target.on('ghii:version:breaking', ({ current, old, breakingSection }) => {
          expect(current).not.toStrictEqual(old);
          expect('foo').toStrictEqual(breakingSection);
          resolve(true);
        });
      });
    });
  });

  describe('history and version', () => {
    it('have empty history and latestVersion if no snapshot is taken', () => {
      const target = Ghii<{ a: { test: 'string' | 'defaults' } }>().section('a', {
        schema: Type => Type.Optional(Type.String()),
        defaults: { test: 'defaults' },
      });

      expect(target.history()).toStrictEqual([]);
      expect(target.latestVersion()).toBeUndefined();
      expect(target.snapshot()).toStrictEqual({ a: { test: 'defaults' } });
    });

    it('have history and latestVersion if  snapshot is taken', () => {
      const target = Ghii<{ a: { test: 'string' } }>().section('a', {
        schema: Type => Type.Optional(Type.String()),
      });
      target.snapshot({ a: { test: 'string' } });
      expect(target.history()).toHaveLength(1);
      expect(target.latestVersion()).toBeDefined();
      expect(target.snapshot()).toStrictEqual({ a: { test: 'string' } });
    });
    it('await snapshot', async () => {
      const target = Ghii<{ a: { test: 'string' | 'done' } }>()
        .section('a', {
          schema: Type => Type.Object({ test: Type.Optional(Type.String()) }),
          defaults: { test: 'string' },
        })
        .loader(() => fakeTimeoutLoader({ a: { test: 'done' } }, 10));

      const firstPromise = target.waitForFirstSnapshot({}, __dirname, './fakeModule');
      jest.advanceTimersToNextTimer();
      await firstPromise;
      expect(target.history()).toHaveLength(1);
      expect(target.latestVersion()).toBeDefined();
      expect(target.snapshot()).toStrictEqual({ a: { test: 'done' } });
    });

    it('await when a snapshot is available', async () => {
      const target = Ghii<{ a: { test: 'string' } }>().section('a', {
        schema: Type => Type.Optional(Type.String()),
      });
      target.snapshot({ a: { test: 'string' } });
      await target.waitForFirstSnapshot({ timeout: 10 }, __dirname, './fakeModule');

      expect(target.history()).toHaveLength(1);
      expect(target.latestVersion()).toBeDefined();
      expect(target.snapshot()).toStrictEqual({ a: { test: 'string' } });
    });

    it('await when a snapshot is available', async () => {
      const target = Ghii<{ a: { test: 'string' } }>().section('a', {
        schema: Type => Type.Optional(Type.String()),
      });
      target.snapshot({ a: { test: 'string' } });
      await target.waitForFirstSnapshot({ timeout: 10 }, __dirname, './fakeModule');
      target.snapshot({ a: { test: 'string' } });
      await target.waitForFirstSnapshot({ timeout: 10 }, __dirname, './fakeModule');
      const fakeModule = await import('./fakeModule');
      expect(fakeModule.default).toStrictEqual(1);
      expect(target.history()).toHaveLength(2);
      expect(target.latestVersion()).toBeDefined();
      expect(target.snapshot()).toStrictEqual({ a: { test: 'string' } });
    });

    it('slow loader time out await snapshot', async () => {
      const target = Ghii<{ a: { test: 'string' } }>()
        .section('a', {
          schema: Type => Type.Object({ test: Type.Optional(Type.String()) }),
        })
        .loader(() => fakeTimeoutLoader({}, 30));
      try {
        const promise = target.waitForFirstSnapshot({ timeout: 10 }, __dirname, './fakeModule');
        jest.advanceTimersToNextTimer();
        await promise;
        fail("This line isn't reachable, without a snapshot!");
      } catch (err) {
        // Good
      }
    });

    it('a loader reject awaiting snapshot', async () => {
      const guardFn = jest.fn();
      const target = Ghii<{ a: { test: 'string' } }>()
        .section('a', {
          schema: Type => Type.Object({ test: Type.Optional(Type.String()) }),
        })
        .loader(async () => {
          throw new Error('test error');
        });
      try {
        await target.waitForFirstSnapshot({ timeout: 20, onTimeout: guardFn }, __dirname, './fakeModule');
        fail("This line isn't reachable, without a snapshot!");
      } catch (err) {
        expect(guardFn).not.toBeCalled();
      }
    });
    it('on awaiting snapshot timeout onTimeout is called', async () => {
      const guardFn = jest.fn();
      const target = Ghii<{ a: { test: 'string' } }>()
        .section('a', {
          schema: Type => Type.Object({ test: Type.Optional(Type.String()) }),
        })
        .loader(() => fakeTimeoutLoader({ a: { test: 'string' } }, 30));
      try {
        const promise = target.waitForFirstSnapshot({ timeout: 10, onTimeout: guardFn }, __dirname, './fakeModule');
        jest.advanceTimersToNextTimer();
        await promise;
        fail("This line isn't reachable, without a snapshot!");
      } catch (err) {
        expect(guardFn).toBeCalled();
      }
    });

    it('await on missing module', async () => {
      const guardFn = jest.fn();
      const target = Ghii<{ a: { test: 'string' } }>().section('a', {
        schema: Type => Type.Optional(Type.String()),
      });
      try {
        await target.waitForFirstSnapshot({ timeout: 0 }, './missingModule');
        fail("This line isn't reachable, without a snapshot!");
      } catch (err) {
        expect(guardFn).not.toBeCalled();
        expect(err).toBeDefined();
      }
    });
    it('await on absolute module', async () => {
      const guardFn = jest.fn();
      const target = Ghii<{ a: { test: 'string' } }>().section('a', {
        schema: Type => Type.Optional(Type.String()),
      });
      await target.waitForFirstSnapshot({ timeout: 100, onTimeout: guardFn }, __dirname, './fakeModule');
    });
  });
});
