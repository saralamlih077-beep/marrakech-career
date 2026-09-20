import type { ChatMessage } from './types';

export const DOMAIN_COLORS: Record<string, string> = {
  'IT & Digital': '#621E3E', 'Tourism & Hospitality': '#667436',
  'Finance & Consulting': '#C6A054', 'Renewable Energy': '#3B7A57',
  'Architecture & Design': '#D9828D', 'Healthcare': '#7C6FA0',
};

export const sectorChartData = [
  { s: 'IT & Digital', n: 48 }, { s: 'Tourism', n: 35 },
  { s: 'Finance', n: 28 }, { s: 'Manufacturing', n: 24 },
  { s: 'Healthcare', n: 19 }, { s: 'Architecture', n: 16 },
  { s: 'Energy', n: 14 }, { s: 'Marketing', n: 12 },
];

export const opportunityData = [
  { name: 'Internship', value: 42, color: '#621E3E' },
  { name: 'CDI', value: 31, color: '#667436' },
  { name: 'CDD', value: 18, color: '#C6C954' },
  { name: 'Freelance', value: 9, color: '#D9828D' },
];

export const skillsDemandData = [
  { s: 'Excel', v: 85 }, { s: 'SQL', v: 78 }, { s: 'Python', v: 72 },
  { s: 'Power BI', v: 58 }, { s: 'ML', v: 45 }, { s: 'Tableau', v: 38 },
];

export const appTrendData = [
  { m: 'Jan', n: 0 }, { m: 'Feb', n: 1 }, { m: 'Mar', n: 2 },
  { m: 'Apr', n: 4 }, { m: 'May', n: 3 }, { m: 'Jun', n: 5 },
];

export const matchDistData = [
  { r: '90-100%', n: 12 }, { r: '80-90%', n: 34 }, { r: '70-80%', n: 45 },
  { r: '60-70%', n: 28 }, { r: '50-60%', n: 18 }, { r: '<50%', n: 71 },
];

export const KANBAN_DATA = {
  saved: [
    { id: 1, company: 'MarraTech Solutions', position: 'Data Analyst Intern', date: '10 Jun', match: 91, email: 'Draft', cv: 'Modern CV v2' },
    { id: 2, company: 'DataViz Maroc', position: 'BI Developer', date: '12 Jun', match: 85, email: 'Not started', cv: 'ATS CV v1' },
  ],
  prepared: [
    { id: 3, company: 'Al Makan Digital', position: 'Data Analyst', date: '08 Jun', match: 87, email: 'Ready', cv: 'Modern CV v2' },
  ],
  applied: [
    { id: 4, company: 'Green Atlas Energy', position: 'Data Intern', date: '05 Jun', match: 78, email: 'Sent', cv: 'Professional' },
    { id: 5, company: 'Dar Al Medina', position: 'Junior Analyst', date: '03 Jun', match: 65, email: 'Sent', cv: 'ATS CV v1' },
  ],
  interview: [
    { id: 6, company: 'Hôtel La Mamounia', position: 'Data Coordinator', date: '28 May', match: 72, email: 'Confirmed', cv: 'Professional' },
  ],
  result: [] as { id: number; company: string; position: string; date: string; match: number; email: string; cv: string }[],
};

export const INITIAL_MESSAGES: ChatMessage[] = [
  { role: 'ai', text: "Bonjour ! Je suis votre Assistant Carrière IA pour Marrakech. Je connais les entreprises partenaires de la plateforme et je peux vous aider à trouver des opportunités, améliorer votre CV ou préparer vos entretiens. Comment puis-je vous aider aujourd'hui ?" },
];
