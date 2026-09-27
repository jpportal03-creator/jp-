import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128),
}).refine((data) => data.currentPassword !== data.newPassword, {
  path: ['newPassword'],
  message: 'Choose a password different from your current password',
});

export const deleteAccountSchema = z.object({
  password: z.string().min(8).max(128),
  confirmation: z.literal('DELETE'),
});
