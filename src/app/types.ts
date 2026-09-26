import type { Entreprise } from '../types/entreprise';

export type NavPage =
  | 'dashboard' | 'companies' | 'company-detail' | 'map'
  | 'opportunities' | 'cv-studio' | 'cv-analyzer'
  | 'applications' | 'campaign'
  | 'favorites' | 'analytics' | 'admin' | 'profile' | 'settings';

export type Company = Entreprise;

export interface ChatMessage { role: 'user' | 'ai'; text: string; cards?: number[] }
