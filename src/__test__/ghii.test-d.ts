import { describe, expectTypeOf, it } from 'vitest';
import { ghii } from '../ghii';
import { zodEngine } from './zodEngine';

describe('Ghii Types Test', () => {
  it('Ghii instantce type contains expected properties', async () => {
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
    );

    type GhiiExpected = ReturnType<
      ghii<{
        foo: {
          prop1: string;
        };
        foo2: {
          prop1: string;
        };
      }>
    >;
    expectTypeOf(target).toExtend<GhiiExpected>();
  });
  it('snapshot type contains expected properties', async () => {
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
    );

    type SnapshotType = () => {
      foo: {
        prop1: string;
      };
      foo2: {
        prop1: string;
      };
    };

    expectTypeOf(target.snapshot).toExtend<SnapshotType>();
  });
});
