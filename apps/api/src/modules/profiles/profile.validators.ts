import { z } from 'zod';

export const INTEREST_OPTIONS = [
  'Music',
  'Movies/Series',
  'Gaming',
  'Sports',
  'Gym/Fitness',
  'Travel',
  'Food',
  'Reading',
  'Coding/Tech',
  'Finance',
  'Other',
] as const;

export const createProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  age: z.number().int().min(18),
  academicYear: z.number().int().min(1).max(4),
  interestedIn: z.enum(['men', 'women', 'everyone']),
  lookingFor: z.enum(['dating', 'relationship', 'casual_dating', 'hookup', 'friendship', 'open_to_see_where_it_goes']),
  bio: z.string().trim().max(300).optional().or(z.literal('')),
  gender: z.enum(['woman', 'man', 'non_binary', 'prefer_not_to_say']),
  collegeId: z.string().uuid(),
  courseId: z.string().uuid(),
  semesterId: z.string().uuid().optional(),
  interests: z.array(z.enum(INTEREST_OPTIONS)).min(1).max(20),
  profilePhotoUrl: z.string().trim().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol)).optional().or(z.literal('')),
  discoverability: z.enum(['discoverable', 'hidden', 'incognito']).optional(),
});

export type ProfileSetupInput = z.infer<typeof createProfileSchema>;

export const updatePrivacySchema = z.object({
  discoverability: z.enum(['discoverable', 'hidden', 'incognito']).optional(),
  hideExactLocation: z.boolean().optional(),
  showGender: z.boolean().optional(),
  showCollege: z.boolean().optional(),
});
