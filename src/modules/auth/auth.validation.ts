import { z } from 'zod';

export const loginSchema = z
  .object({
    username: z.string().trim().optional(),
    email: z.string().trim().optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((data) => !!(data.username || data.email), {
    message: 'Username or email is required',
    path: ['username'],
  });

export const forgotPasswordSchema = z
  .object({
    identifier: z.string().trim().min(1, 'Identifier must not be empty').optional(),
    email: z.string().trim().min(1).optional(),
    username: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).optional(),
    mobile: z.string().trim().min(1).optional(),
  })
  .refine(
    (data) => !!(data.identifier || data.email || data.username || data.phone || data.mobile),
    {
      message: 'Identifier (email, username, or phone/mobile number) is required',
    }
  );

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'New password must be at least 8 characters long'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
