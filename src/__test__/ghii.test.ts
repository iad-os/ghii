import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ghii } from '../ghii.js';
import { zodEngine } from './zodEngine.js';

describe('Ghii Config', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  it('Ghii is instantiable', () => {
    expect(ghii).toBeDefined();
  });

  describe('base configs', () => {
    it('load default (valid) options', async () => {
      const target = ghii(
        zodEngine(z =>
          z.object({
            foo: z
              .object({
                prop1: z.string(),
              })
              .default({ prop1: 'prop1' }),
            foo2: z.object({
              prop1: z.string().describe('Another foo'),
            }),
          })
        )
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
      zodEngine(z =>
        z.object({
          foo: z.object({
            prop: z.string().default('goodbye'),
          }),
        })
      )
    );
    target.loader(async () => ({ foo: { prop: 'ciao' } }));
    const result = await target.takeSnapshot();
    expect(result).toStrictEqual({ foo: { prop: 'ciao' } });
  });

  it('simple property (valid) options', async () => {
    const target = ghii(
      zodEngine(z =>
        z.object({
          foo: z.union([z.literal('a'), z.literal('b')]).default('a'),
        })
      )
    );
    target.loader(async () => ({ foo: 'b' }));
    const result = await target.takeSnapshot();
    expect(result).toStrictEqual({ foo: 'b' });
  });

  it('loader without defaults (valid) options', async () => {
    const target = ghii(
      zodEngine(z =>
        z.object({
          foo: z.object({
            prop: z.string(),
          }),
        })
      )
    );
    target.loader(async () => ({ foo: { prop: 'ciao' } }));
    const result = await target.takeSnapshot();
    expect(result).toStrictEqual({ foo: { prop: 'ciao' } });
  });

  it('loader without defaults (valid) options', async () => {
    const target = ghii(
      zodEngine(z =>
        z.object({
          foo: z.object({
            prop: z.string(),
          }),
        })
      )
    );
    target.loader(async () => ({ foo: { prop: 'ciao' } }));
    const result = await target.takeSnapshot();
    expect(result).toStrictEqual({ foo: { prop: 'ciao' } });
  });
  it('load default (invalid) options', async () => {
    const target = ghii(
      zodEngine(z =>
        z.object({
          foo: z
            .object({
              prop: z.string().max(1),
            })
            .prefault({ prop: 'goodbye' }),
        })
      )
    );

    return expect(target.takeSnapshot()).rejects.toMatchInlineSnapshot(`
      [
        {
          "_raw": {
            "code": "too_big",
            "inclusive": true,
            "maximum": 1,
            "message": "Too big: expected string to have <=1 characters",
            "origin": "string",
            "path": [
              "foo",
              "prop",
            ],
          },
          "details": "too_big",
          "input": undefined,
          "message": "Too big: expected string to have <=1 characters",
          "path": "foo.prop",
        },
      ]
    `);
  });

  it('load loader (invalid) options', () => {
    const target = ghii(
      zodEngine(z =>
        z.object({
          foo: z.object({
            prop: z.string().max(7).min(7).default('goodbye'),
          }),
        })
      )
    );
    target.loader(async () => ({ foo: { prop: 'ciao' } }));
    return expect(target.takeSnapshot()).rejects.toMatchInlineSnapshot(`
      [
        {
          "_raw": {
            "code": "too_small",
            "inclusive": true,
            "message": "Too small: expected string to have >=7 characters",
            "minimum": 7,
            "origin": "string",
            "path": [
              "foo",
              "prop",
            ],
          },
          "details": "too_small",
          "input": undefined,
          "message": "Too small: expected string to have >=7 characters",
          "path": "foo.prop",
        },
      ]
    `);
  });

  it('load loader (invalid) options', () => {
    const target = ghii(
      zodEngine(z =>
        z.object({
          foo: z.object({
            prop: z.string().max(3).min(3),
          }),
        })
      )
    );
    target.loader(async () => ({ foo: { prop: 'ciao' } }));
    return expect(target.takeSnapshot()).rejects.toMatchInlineSnapshot(`
      [
        {
          "_raw": {
            "code": "too_big",
            "inclusive": true,
            "maximum": 3,
            "message": "Too big: expected string to have <=3 characters",
            "origin": "string",
            "path": [
              "foo",
              "prop",
            ],
          },
          "details": "too_big",
          "input": undefined,
          "message": "Too big: expected string to have <=3 characters",
          "path": "foo.prop",
        },
      ]
    `);
  });
  it('email format', async () => {
    const guardFn = vi.fn();
    const target = ghii(
      zodEngine(z =>
        z.object({
          foo: z.object({
            email: z.email().default(''),
          }),
        })
      )
    ).loader(async () => ({ foo: { email: 'pippo@pippo.it' } }));
    await target.waitForSnapshot({ timeout: 10, onTimeout: guardFn });
    vi.advanceTimersToNextTimer();
    expect(target.snapshot()).toStrictEqual({
      foo: { email: 'pippo@pippo.it' },
    });
  });
  it('load format types (invalid default)', async () => {
    const target = ghii(
      zodEngine(z =>
        z.object({
          foo: z
            .object({
              email: z.email(),
            })
            .prefault({ email: 'not an email' }),
        })
      )
    );
    return expect(target.takeSnapshot()).rejects.toMatchInlineSnapshot(`
      [
        {
          "_raw": {
            "code": "invalid_format",
            "format": "email",
            "message": "Invalid email address",
            "origin": "string",
            "path": [
              "foo",
              "email",
            ],
            "pattern": "/^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$/",
          },
          "details": "invalid_format",
          "input": undefined,
          "message": "Invalid email address",
          "path": "foo.email",
        },
      ]
    `);
  });
  it('load format types (invalid)', async () => {
    const target = ghii(
      zodEngine(z =>
        z.object({
          foo: z.object({
            email: z.email().default(''),
          }),
        })
      )
    ).loader(async () => ({ foo: { email: '127.0.0.0' } }));
    return expect(target.takeSnapshot()).rejects.toMatchInlineSnapshot(`
      [
        {
          "_raw": {
            "code": "invalid_format",
            "format": "email",
            "message": "Invalid email address",
            "origin": "string",
            "path": [
              "foo",
              "email",
            ],
            "pattern": "/^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$/",
          },
          "details": "invalid_format",
          "input": undefined,
          "message": "Invalid email address",
          "path": "foo.email",
        },
      ]
    `);
  });
  it('load without default and loader', () => {
    const target = ghii(
      zodEngine(z =>
        z.object({
          foo: z
            .object({
              prop: z.string().max(7).min(7),
            })
            .prefault({ prop: 'ghenghi' }),
        })
      )
    );
    return expect(target.takeSnapshot()).resolves.toMatchInlineSnapshot(`
      {
        "foo": {
          "prop": "ghenghi",
        },
      }
    `);
  });
  it('return a valid jsonSchema for a configuration ', () => {
    const target = ghii(
      zodEngine(z =>
        z.object({
          foo: z.object({
            prop: z
              .string()
              .max(7)
              .min(7)
              .default('ghenghi')
              .describe('a nice property')
              .meta({ title: 'A nice property', examples: ['ghenghi', 'ghenghi2'] }),
          }),
        })
      )
    );
    return expect(target.jsonSchema()).toMatchInlineSnapshot(
      `"{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"foo":{"type":"object","properties":{"prop":{"default":"ghenghi","description":"a nice property","title":"A nice property","examples":["ghenghi","ghenghi2"],"type":"string","minLength":7,"maxLength":7}},"required":["prop"],"additionalProperties":false}},"required":["foo"],"additionalProperties":false}"`
    );
  });
});
