import { z } from 'zod';

export const SideSchema = z.enum(['LEFT', 'RIGHT', 'BOTH']);
export type SideValue = z.infer<typeof SideSchema>;

export const CreateLogSchema = z
  .object({
    side: SideSchema,
    qualityScore: z.number().int().min(1).max(5),
    durationMin: z.number().int().min(0).max(180),
    startTime: z
      .string()
      .datetime({ offset: true })
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
    endTime: z
      .string()
      .datetime({ offset: true })
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
    notes: z.string().max(1000).optional(),
  })
  .strict();

export type CreateLogInput = z.infer<typeof CreateLogSchema>;
