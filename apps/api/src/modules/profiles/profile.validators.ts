import { z } from 'zod';

export const createProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  bio: z.string().trim().max(300).optional().or(z.literal('')),
  gender: z.enum(['woman', 'man', 'non_binary', 'prefer_not_to_say']).optional(),
  collegeId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  interests: z.array(z.string()).max(20).optional(),
  discoverability: z.enum(['discoverable', 'hidden', 'incognito']).optional(),
});

export const updatePrivacySchema = z.object({
  discoverability: z.enum(['discoverable', 'hidden', 'incognito']).optional(),
  hideExactLocation: z.boolean().optional(),
  showGender: z.boolean().optional(),
  showCollege: z.boolean().optional(),
});
