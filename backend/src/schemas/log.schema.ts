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

export const UpdateLogSchema = z
  .object({
    side: SideSchema.optional(),
    qualityScore: z.number().int().min(1).max(5).optional(),
    durationMin: z.number().int().min(0).max(180).optional(),
    startTime: z
      .string()
      .datetime({ offset: true })
      .optional()
      .transform((v) => (v ? new Date(v) : undefined)),
    endTime: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional()
      .transform((v) => (v === null ? null : v ? new Date(v) : undefined)),
    notes: z.string().max(1000).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export type UpdateLogInput = z.infer<typeof UpdateLogSchema>;
