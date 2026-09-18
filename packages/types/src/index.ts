export type UserRole = 'student' | 'admin' | 'moderator';
export type AccountStatus = 'active' | 'pending_verification' | 'suspended' | 'deleted';
export type Discoverability = 'discoverable' | 'hidden' | 'incognito';
export type Gender = 'woman' | 'man' | 'non_binary' | 'prefer_not_to_say';
export type ReportCategory =
  | 'harassment'
  | 'spam'
  | 'fake_profile'
  | 'inappropriate_content'
  | 'impersonation'
  | 'threatening_behavior'
  | 'other';

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: null | {
    code: string;
    message: string;
  };
}

export interface College {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollegeInput {
  name: string;
  domains: string[];
  active?: boolean;
}
