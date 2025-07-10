import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ghii } from '../ghii.js';
import { fakeTimeoutLoader } from './fakeLoaders.js';
import { zodEngine } from './zodEngine.js';

describe('Ghii Snapshot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('await snapshot', async () => {
    const target = ghii(
      zodEngine(z =>
        z.object({
          a: z.union([z.object({ test: z.optional(z.union([z.literal('string'), z.literal('done')])) }), z.any()]),
        })
      )
    ).loader(() => fakeTimeoutLoader({ a: { test: 'done' } }, 10));
    const firstPromise = target.waitForSnapshot({});
    vi.advanceTimersToNextTimer();
    await firstPromise;
    expect(target.snapshot()).toStrictEqual({ a: { test: 'done' } });
  });

  it('await snapshot (callback)', async () => {
    const target = ghii(
      zodEngine(z =>
        z.object({
          a: z.union([z.object({ test: z.optional(z.union([z.literal('string'), z.literal('done')])) }), z.boolean()]),
        })
      )
    ).loader(() => fakeTimeoutLoader({ a: { test: 'done' } }, 10));
    const firstPromise = target.waitForSnapshot({
      async onValidSnapshot() {
        const v = await import('./fakeModule');
        expect(v.default).toBeGreaterThan(0);
      },
    });
    vi.advanceTimersToNextTimer();
    expect(await firstPromise).toStrictEqual({ a: { test: 'done' } });
    expect(target.snapshot()).toStrictEqual({ a: { test: 'done' } });
  });
  it('await snapshot (without options)', async () => {
    const target = ghii(
      zodEngine(z =>
        z.object({
          a: z.union([
            z.object({ test: z.optional(z.union([z.literal('string'), z.literal('done')])) }),
            z.array(z.number()),
          ]),
        })
      )
    ).loader(() => fakeTimeoutLoader({ a: { test: 'done' } }, 10));
    const firstPromise = target.waitForSnapshot(undefined);
    vi.advanceTimersToNextTimer();
    await firstPromise;
    expect(target.snapshot()).toStrictEqual({ a: { test: 'done' } });
  });

  it('await when a snapshot is available after default change (callback)', async () => {
    const target = ghii(
      zodEngine(z =>
        z
          .object({
            a: z
              .object({
                test: z.union([z.literal('string'), z.literal('defaults')]),
              })
              .prefault({ test: 'string' }),
          })
          .default({ a: { test: 'string' } })
      )
    );

    expect(
      await target.waitForSnapshot({
        timeout: 10,
        async onValidSnapshot() {
          return;
        },
      })
    ).toStrictEqual({ a: { test: 'string' } });
    target.loader(async () => ({ a: { test: 'defaults' } }));
    await target.takeSnapshot();
    await expect(
      target.waitForSnapshot({
        timeout: 10,
        async onValidSnapshot() {
          return;
        },
      })
    ).resolves.toStrictEqual({ a: { test: 'defaults' } });
  });

  it('slow loader time out await snapshot', async () => {
    const target = ghii(
      zodEngine(z =>
        z.object({
          a: z.optional(
            z.object({
              test: z.optional(z.union([z.literal('string')])),
            })
          ),
        })
      )
    ).loader(() => fakeTimeoutLoader({}, 30));
    const promise = target.waitForSnapshot({ timeout: 10 });
    vi.advanceTimersToNextTimer();
    await expect(promise).rejects.toMatchInlineSnapshot(`
        {
          "reason": [Error: timeout waiting for snapshot],
        }
      `);
  });

  it('a loader reject awaiting snapshot', async () => {
    const guardFn = vi.fn();
    const target = ghii(
      zodEngine(z =>
        z.object({
          a: z.union([
            z.object({
              test: z.optional(z.union([z.literal('string')])),
            }),
            z.boolean(),
          ]),
        })
      )
    ).loader(async () => {
      throw new Error('test error');
    });
    await expect(target.waitForSnapshot({ timeout: 20, onTimeout: guardFn })).rejects.toMatchInlineSnapshot(
      `[Error: test error]`
    );
    expect(guardFn).not.toBeCalled();
  });
  it('on awaiting snapshot timeout onTimeout is called', async () => {
    const guardFn = vi.fn();
    const target = ghii(
      zodEngine(z =>
        z.object({
          a: z.union([
            z.object({
              test: z.optional(z.union([z.literal('string')])),
            }),
            z.null(),
          ]),
        })
      )
    ).loader(() => fakeTimeoutLoader({ a: { test: 'string' } }, 30));

    const promise = target.waitForSnapshot({ timeout: 10, onTimeout: guardFn });
    vi.advanceTimersToNextTimer();
    await expect(promise).rejects.toMatchInlineSnapshot(`
          {
            "reason": [Error: timeout waiting for snapshot],
          }
        `);
    expect(guardFn).toBeCalled();
  });
});
