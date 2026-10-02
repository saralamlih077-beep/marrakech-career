export interface Entreprise {
  id: number;
  nom: string;
  domaine: string | null;
  sous_domaine: string | null;
  categorie: string | null;
  telephone: string | null;
  email: string | null;
  site_web: string | null;
  adresse: string | null;
  latitude: number | null;
  longitude: number | null;
  note: number | null;
  nombre_avis: number | null;
  priorite: string | null;
  score_priorite: number | null;
  google_maps: string | null;
  about_summary?: string | null;
  about_source_url?: string | null;
  about_updated_at?: string | null;
}
