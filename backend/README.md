# Backend

Le backend est basé sur Supabase.

- `supabase/functions/` : Edge Functions (Gmail, n8n, assistant IA, synchronisation d'offres).
- `supabase/migrations/` : évolutions versionnées de la base de données.
- `supabase/config.toml` : configuration Supabase.

Depuis la racine du dépôt, utilisez `supabase --workdir backend` pour les commandes CLI Supabase.
