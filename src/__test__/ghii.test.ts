import { Type } from '@sinclair/typebox';
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
      const target = ghii(T =>
        T.Object({
          foo: T.Object({
            prop1: T.String({ default: 'prop1' }),
          }),
          foo2: T.Object({
            prop1: T.String({ description: 'Another foo' }),
          }),
        })
      ).loader(async () => ({ foo2: { prop1: 'prop1' } }));
      const result = await target.takeSnapshot();
      expect(result).toStrictEqual({
        foo: { prop1: 'prop1' },
        foo2: { prop1: 'prop1' },
      });
    });
  });
  it('loader (valid) options', async () => {
    const target = ghii(
      Type.Object({
        foo: Type.Object({
          prop: Type.String({ default: 'goodbye' }),
        }),
      })
    );
    target.loader(async () => ({ foo: { prop: 'ciao' } }));
    const result = await target.takeSnapshot();
    expect(result).toStrictEqual({ foo: { prop: 'ciao' } });
  });

  it('simple property (valid) options', async () => {
    const target = ghii(
      Type.Object({
        foo: Type.Union([Type.Literal('a'), Type.Literal('b')], { default: 'a' }),
      })
    );
    target.loader(async () => ({ foo: 'b' }));
    const result = await target.takeSnapshot();
    expect(result).toStrictEqual({ foo: 'b' });
  });

  it('loader without defaults (valid) options', async () => {
    const target = ghii(
      Type.Object({
        foo: Type.Object({
          prop: Type.String(),
        }),
      })
    );
    target.loader(async () => ({ foo: { prop: 'ciao' } }));
    const result = await target.takeSnapshot();
    expect(result).toStrictEqual({ foo: { prop: 'ciao' } });
  });

  it('loader without defaults (valid) options', async () => {
    const target = ghii(
      Type.Object({
        foo: Type.Object({
          prop: Type.String(),
        }),
      })
    );
    target.loader(async () => ({ foo: { prop: 'ciao' } }));
    const result = await target.takeSnapshot();
    expect(result).toStrictEqual({ foo: { prop: 'ciao' } });
  });
  it('load default (invalid) options', () => {
    const target = ghii(
      Type.Object({
        foo: Type.Object({
          prop: Type.String({ maxLength: 10, minLength: 10, default: 'goodbye' }),
        }),
      })
    );
    return expect(target.takeSnapshot()).rejects.toMatchObject([{ path: '/foo/prop', value: 'goodbye' }]);
  });

  it('load loader (invalid) options', () => {
    const target = ghii(
      Type.Object({
        foo: Type.Object({
          prop: Type.String({ maxLength: 7, minLength: 7, default: 'goodbye' }),
        }),
      })
    );
    target.loader(async () => ({ foo: { prop: 'ciao' } }));
    return expect(target.takeSnapshot()).rejects.toMatchObject([{ path: '/foo/prop', value: 'ciao' }]);
  });

  it('load loader (invalid) options', () => {
    const target = ghii(
      Type.Object({
        foo: Type.Object({
          prop: Type.String({ maxLength: 3, minLength: 3 }),
        }),
      })
    );
    target.loader(async () => ({ foo: { prop: 'ciao' } }));
    return expect(target.takeSnapshot()).rejects.toMatchObject([{ path: '/foo/prop', value: 'ciao' }]);
  });

  describe('history and version', () => {
    it('have empty history and latestVersion if no snapshot is taken', () => {
      const target = ghii(
        Type.Object({
          a: Type.Union([
            Type.Object({
              test: Type.Union([Type.Literal('defaults'), Type.Literal('string')], { default: 'defaults' }),
            }),
            Type.Undefined(),
          ]),
        })
      );

      expect(target.history()).toStrictEqual([]);
      expect(target.latestVersion()).toBeUndefined();
      expect(target.snapshot()).toStrictEqual({ a: { test: 'defaults' } });
    });

    it('have history and latestVersion if  snapshot is taken', () => {
      const target = ghii(
        Type.Object({
          a: Type.Union([
            Type.Object({
              test: Type.Optional(Type.Union([Type.Literal('string')])),
            }),
            Type.Undefined(),
          ]),
        })
      );
      target.snapshot({ a: { test: 'string' } });
      expect(target.history()).toHaveLength(1);
      expect(target.latestVersion()).toBeDefined();
      expect(target.snapshot()).toStrictEqual({ a: { test: 'string' } });
    });
    it('await snapshot', async () => {
      const target = ghii(
        Type.Object({
          a: Type.Union([
            Type.Object({
              test: Type.Optional(Type.Union([Type.Literal('string'), Type.Literal('done')])),
            }),
            Type.Undefined(),
          ]),
        })
      ).loader(() => fakeTimeoutLoader({ a: { test: 'done' } }, 10));
      const firstPromise = target.waitForFirstSnapshot({}, __dirname, './fakeModule');
      jest.advanceTimersToNextTimer();
      await firstPromise;
      expect(target.history()).toHaveLength(1);
      expect(target.latestVersion()).toBeDefined();
      expect(target.snapshot()).toStrictEqual({ a: { test: 'done' } });
    });
    it('await snapshot (without options)', async () => {
      const target = ghii(
        Type.Object({
          a: Type.Union([
            Type.Object({
              test: Type.Optional(Type.Union([Type.Literal('string'), Type.Literal('done')])),
            }),
            Type.Undefined(),
          ]),
        })
      ).loader(() => fakeTimeoutLoader({ a: { test: 'done' } }, 10));
      const firstPromise = target.waitForFirstSnapshot(undefined, __dirname, './fakeModule');
      jest.advanceTimersToNextTimer();
      await firstPromise;
      expect(target.history()).toHaveLength(1);
      expect(target.latestVersion()).toBeDefined();
      expect(target.snapshot()).toStrictEqual({ a: { test: 'done' } });
    });
    it('await when a snapshot is available', async () => {
      const target = ghii(
        Type.Object({
          a: Type.Union([
            Type.Object({
              test: Type.Optional(Type.Union([Type.Literal('string')])),
            }),
            Type.Undefined(),
          ]),
        })
      );
      target.snapshot({ a: { test: 'string' } });
      await target.waitForFirstSnapshot({ timeout: 10 }, __dirname, './fakeModule');

      expect(target.history()).toHaveLength(1);
      expect(target.latestVersion()).toBeDefined();
      expect(target.snapshot()).toStrictEqual({ a: { test: 'string' } });
    });

    it('await when a snapshot is available after change', async () => {
      const target = ghii(
        Type.Object({
          a: Type.Union([
            Type.Object({
              test: Type.Optional(Type.Union([Type.Literal('string'), Type.Literal('defaults')])),
            }),
            Type.Undefined(),
          ]),
        })
      );

      target.snapshot({ a: { test: 'defaults' } });
      await target.waitForFirstSnapshot({ timeout: 10 }, __dirname, './fakeModule');
      target.snapshot({ a: { test: 'string' } });
      await target.waitForFirstSnapshot({ timeout: 10 }, __dirname, './fakeModule');

      const fakeModule = await import('./fakeModule');
      expect(fakeModule.default).toStrictEqual(1);
      expect(target.history()).toHaveLength(2);
      expect(target.latestVersion()).toBeDefined();
      expect(target.history().reverse()[1].value).toStrictEqual({ a: { test: 'defaults' } });
      expect(target.snapshot()).toStrictEqual({ a: { test: 'string' } });
    });

    it('await when a snapshot is available after default change', async () => {
      const target = ghii(
        Type.Object({
          a: Type.Object({
            test: Type.Union([Type.Literal('string'), Type.Literal('defaults')], {
              default: 'defaults',
            }),
          }),
        })
      );

      await target.waitForFirstSnapshot({ timeout: 10 }, __dirname, './fakeModule');
      target.snapshot({ a: { test: 'string' } });
      await target.waitForFirstSnapshot({ timeout: 10 }, __dirname, './fakeModule');

      const fakeModule = await import('./fakeModule');
      expect(fakeModule.default).toStrictEqual(1);
      expect(target.history()).toHaveLength(2);
      expect(target.latestVersion()).toBeDefined();
      expect(target.history().reverse()[1].value).toStrictEqual({ a: { test: 'defaults' } });
      expect(target.snapshot()).toStrictEqual({ a: { test: 'string' } });
    });

    it('await when a snapshot is available and history not changed', async () => {
      const target = ghii(
        Type.Object({
          a: Type.Object({
            test: Type.Union([Type.Literal('string'), Type.Literal('defaults')], {
              default: 'string',
            }),
          }),
        })
      );

      await target.waitForFirstSnapshot({ timeout: 10 }, __dirname, './fakeModule');
      target.snapshot({ a: { test: 'string' } });
      await target.waitForFirstSnapshot({ timeout: 10 }, __dirname, './fakeModule');
      target.snapshot({ a: { test: 'string' } });
      await target.waitForFirstSnapshot({ timeout: 10 }, __dirname, './fakeModule');

      const fakeModule = await import('./fakeModule');
      expect(fakeModule.default).toStrictEqual(1);
      expect(target.history()).toHaveLength(1);
      expect(target.latestVersion()).toBeDefined();
      expect(target.snapshot()).toStrictEqual({ a: { test: 'string' } });
    });

    it('slow loader time out await snapshot', async () => {
      const target = ghii(
        Type.Object({
          a: Type.Union([
            Type.Object({
              test: Type.Optional(Type.Union([Type.Literal('string')])),
            }),
            Type.Undefined(),
          ]),
        })
      ).loader(() => fakeTimeoutLoader({}, 30));
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
      const target = ghii(
        Type.Object({
          a: Type.Union([
            Type.Object({
              test: Type.Optional(Type.Union([Type.Literal('string')])),
            }),
            Type.Undefined(),
          ]),
        })
      ).loader(async () => {
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
      const target = ghii(
        Type.Object({
          a: Type.Union([
            Type.Object({
              test: Type.Optional(Type.Union([Type.Literal('string')])),
            }),
            Type.Undefined(),
          ]),
        })
      ).loader(() => fakeTimeoutLoader({ a: { test: 'string' } }, 30));
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
      const target = ghii(
        Type.Object({
          a: Type.Union([
            Type.Object({
              test: Type.Optional(Type.Union([Type.Literal('string')])),
            }),
            Type.Undefined(),
          ]),
        })
      );
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
      const target = ghii(
        Type.Object({
          a: Type.Union([
            Type.Object({
              test: Type.Optional(Type.Union([Type.Literal('string')])),
            }),
            Type.Undefined(),
          ]),
        })
      );
      await target.waitForFirstSnapshot({ timeout: 100, onTimeout: guardFn }, __dirname, './fakeModule');
    });
  });
});
