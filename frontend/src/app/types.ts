import type { Entreprise } from '../types/entreprise';

export type NavPage =
  | 'dashboard' | 'companies' | 'company-detail' | 'map'
  | 'matching' | 'opportunities' | 'assistant' | 'cv-studio' | 'cv-analyzer' | 'cv-tailored'
  | 'applications' | 'campaign' | 'automation'
  | 'favorites' | 'analytics' | 'admin-data' | 'admin-users' | 'admin-user-directory' | 'profile' | 'settings';

export type Company = Entreprise;

export interface ChatMessage { role: 'user' | 'ai'; text: string; cards?: number[] }
