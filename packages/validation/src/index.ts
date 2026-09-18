import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email();

export const collegeDomainSchema = z.string().trim().toLowerCase().refine((value) => {
  return value.includes('.') && !value.startsWith('.') && !value.endsWith('.');
}, 'Invalid domain format');

export const createCollegeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  domains: z.array(collegeDomainSchema).min(1),
  active: z.boolean().optional().default(true),
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  bio: z.string().trim().max(300).optional(),
  gender: z.enum(['woman', 'man', 'non_binary', 'prefer_not_to_say']).optional(),
  collegeId: z.string().uuid(),
  courseId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.nullable(),
    error: apiErrorSchema.nullable(),
  });
