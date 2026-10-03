import type { RegisteredUser } from '../types/admin';

export function userDirectoryCsv(users: RegisteredUser[]) {
  const cell = (value: string | number) => {
    const text = String(value);
    const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const rows = users.map(user => [
    user.fullName, user.email, user.createdAt, user.applicationCount, user.sentApplicationCount,
    user.emailConfirmedAt ? 'Confirmé' : 'À confirmer',
  ]);
  return '\uFEFF' + [
    ['Nom', 'E-mail', 'Inscription', 'Candidatures enregistrées', 'Candidatures envoyées', 'Statut e-mail'],
    ...rows,
  ].map(row => row.map(cell).join(';')).join('\r\n');
}
