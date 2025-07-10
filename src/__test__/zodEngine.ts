import * as z from 'zod/v4';

export function zodEngine<ZodConfig extends z.ZodType, Config = z.infer<ZodConfig>>(
  makeSchema: (zod: typeof z) => ZodConfig
) {
  const schema = makeSchema(z);
  return {
    validate: (toValidate: Config) => {
      const result = z.safeParse(schema, toValidate);

      if (result.success) {
        return { success: true, value: result.data as Config } as const;
      } else {
        return {
          success: false,
          errors: result.error.issues.map(issue => ({
            path: issue.path.join('.'),
            input: issue.input,
            details: issue.code,
            message: issue.message,
            _raw: issue,
          })),
        } as const;
      }
    },
    toSchema: () => {
      return z.toJSONSchema(schema);
    },
  };
}
