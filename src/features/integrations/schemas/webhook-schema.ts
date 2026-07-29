import { z } from "zod";

export const createWebhookSchema = z
  .object({
    url: z.url().max(2048),
    description: z.string().trim().max(160).optional(),
    eventPatterns: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(100)
          .regex(
            /^[a-z][a-z0-9_-]*(?:\.(?:[a-z][a-z0-9_-]*|\*))+$/,
            "Use event names like resource.created or resource.*.",
          ),
      )
      .min(1)
      .max(25)
      .transform((patterns) => [...new Set(patterns)]),
  })
  .strict();

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
