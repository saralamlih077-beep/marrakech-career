"""Génère les notebooks versionnés dans data/notebooks sans dépendance externe."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NOTEBOOKS = ROOT / "data" / "notebooks"
NOTEBOOKS.mkdir(parents=True, exist_ok=True)

def markdown(text):
    return {"cell_type": "markdown", "metadata": {}, "source": text.splitlines(keepends=True)}

def code(text):
    return {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": text.splitlines(keepends=True)}

def save(name, cells):
    nb = {
        "cells": cells,
        "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}, "language_info": {"name": "python", "version": "3"}},
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    (NOTEBOOKS / name).write_text(json.dumps(nb, ensure_ascii=False, indent=2), encoding="utf-8")

save("01_collecte_entreprises_google_places.ipynb", [
    markdown("# 01 — Collecte des organisations de Marrakech\n\nCe notebook collecte des organisations publiques et privées via Google Places API (New). Il conserve les doublons dans le fichier brut, puis produit un fichier propre avec les **15 colonnes utilisées par Marrakech Career**.\n\n> Avant d'exécuter : activez Places API (New), la facturation Google, puis définissez la variable `GOOGLE_MAP_API`. La clé ne doit jamais être enregistrée dans ce dépôt."),
    code("from pathlib import Path\nimport sys\nROOT = Path.cwd().resolve().parents[1] if Path.cwd().name == 'notebooks' else Path.cwd()\nsys.path.insert(0, str(ROOT / 'data' / 'src'))\nfrom companies_pipeline import charger_requetes, collecter_entreprises, nettoyer_entreprises, exporter_excels\n\nCONFIG = ROOT / 'data' / 'config' / 'company_queries.json'\nOUTPUTS = ROOT / 'data' / 'outputs'\nprint('Racine :', ROOT)"),
    markdown("## Requêtes utilisées\n\nLes requêtes couvrent le secteur public et le secteur privé : informatique, tourisme, hôtellerie, immobilier, BTP, finance, formation, santé, industrie, logistique et commerce. Vous pouvez compléter `data/config/company_queries.json` sans modifier le code."),
    code("requetes = charger_requetes(CONFIG)\nprint(f'{len(requetes)} requêtes')\nrequetes[:5]"),
    markdown("## Collecte Google Places\n\nL'API est appelée avec un *field mask* minimal : nom, adresse, téléphone, site, lien Google Maps, note, avis, catégorie et coordonnées. La pagination, les erreurs réseau et les doublons sont gérés dans le module partagé."),
    code("# Le nombre de pages peut être réduit à 1 pendant les tests afin de maîtriser le coût.\ndf_brut = collecter_entreprises(requetes, pages_max=3)\nprint(df_brut.shape)\ndf_brut.head()"),
    markdown("## Nettoyage et classification\n\nLe nettoyage retire les doublons par `place_id`, conserve Marrakech à partir de l'adresse ou des coordonnées, normalise les champs et attribue domaine, sous-domaine et priorité. Le résultat conserve exactement les colonnes de l'application."),
    code("df_propre = nettoyer_entreprises(df_brut)\nprint(df_propre.shape)\nprint(df_propre.columns.tolist())\ndf_propre.head()"),
    code("avant, apres = exporter_excels(df_brut, df_propre, OUTPUTS)\nprint('Créé :', avant)\nprint('Créé :', apres)\nprint('Brut:', len(df_brut), '| unique propre:', len(df_propre))"),
    markdown("## Contrôles qualité\n\nÀ vérifier avant import dans Supabase : le nombre de `place_id` uniques, les coordonnées manquantes, la couverture des domaines et les organisations classées `Non classé`."),
    code("print('Doublons bruts :', df_brut.duplicated('place_id').sum())\nprint('Notes manquantes :', df_propre['note'].isna().sum())\nprint(df_propre['domaine'].value_counts())")
])

save("02_visualisation_et_comparaison.ipynb", [
    markdown("# 02 — Visualisation et comparaison des données\n\nCe notebook compare les fichiers avant/après nettoyage et visualise la répartition par domaine, priorité, note et avis."),
    code("from pathlib import Path\nimport pandas as pd\nimport matplotlib.pyplot as plt\nimport seaborn as sns\n\nROOT = Path.cwd().resolve().parents[1] if Path.cwd().name == 'notebooks' else Path.cwd()\nOUTPUTS = ROOT / 'data' / 'outputs'\nraw = pd.read_excel(OUTPUTS / 'entreprises_avant_nettoyage.xlsx')\nclean = pd.read_excel(OUTPUTS / 'entreprises_apres_nettoyage.xlsx', sheet_name='Entreprises')\nsns.set_theme(style='whitegrid')\nprint(raw.shape, clean.shape)"),
    code("comparaison = pd.DataFrame({\n    'Étape': ['Avant nettoyage', 'Après nettoyage'],\n    'Lignes': [len(raw), len(clean)],\n    'Colonnes': [raw.shape[1], clean.shape[1]],\n    'Doublons place_id': [raw.duplicated('place_id').sum(), 0],\n})\ncomparaison"),
    code("fig, ax = plt.subplots(figsize=(10, 6))\nordre = clean['domaine'].value_counts().sort_values().index\nsns.countplot(data=clean, y='domaine', order=ordre, color='#621E3E', ax=ax)\nax.set_title('Entreprises par domaine — Marrakech')\nax.set_xlabel('Nombre d organisations')\nax.set_ylabel('')\nplt.tight_layout()"),
    code("fig, axes = plt.subplots(1, 2, figsize=(12, 4))\nsns.histplot(clean['note'].dropna(), bins=10, color='#C6C954', ax=axes[0])\naxes[0].set_title('Distribution des notes Google')\nsns.boxplot(y=clean['nombre_avis'].dropna(), color='#621E3E', ax=axes[1])\naxes[1].set_yscale('log')\naxes[1].set_title('Nombre d avis (échelle log)')\nplt.tight_layout()"),
    code("priorites = clean['priorite'].value_counts()\npriorites.plot.pie(autopct='%1.1f%%', colors=['#621E3E', '#C6C954', '#D9A8B6'])\nplt.ylabel('')\nplt.title('Répartition des priorités')\nplt.tight_layout()"),
    code("rapport = {\n  'brut': len(raw), 'propre': len(clean),\n  'doublons_supprimes': raw.duplicated('place_id').sum(),\n  'taux_conservation': round(len(clean) / max(len(raw), 1) * 100, 1),\n  'entreprises_avec_site': int((clean['site_web'] != 'Non disponible').sum()),\n}\nrapport")
])

save("03_collecte_offres.ipynb", [
    markdown("# 03 — Collecte des offres d'emploi\n\nCe notebook normalise les offres provenant de sources autorisées. Il privilégie une API officielle. Ne tentez pas de contourner une restriction technique, un CAPTCHA, `robots.txt` ou les conditions d'utilisation d'un site."),
    code("from pathlib import Path\nimport sys\nROOT = Path.cwd().resolve().parents[1] if Path.cwd().name == 'notebooks' else Path.cwd()\nsys.path.insert(0, str(ROOT / 'data' / 'src'))\nfrom job_sources import collecter_jooble, sources_non_automatisees\nOUTPUTS = ROOT / 'data' / 'outputs'"),
    markdown("## Sources\n\n- **Jooble** : collecte avec une clé Jooble dans `JOOBLE_API_KEY`.\n- **JobSquare** : API partenaire prévue pour publier et gérer vos propres offres ; elle n'est pas utilisée comme moteur de recherche public.\n- **Stagiaire.ma** et **Trabajo** : activez-les uniquement si vous obtenez une API, un export ou une autorisation explicite."),
    code("sources_non_automatisees()"),
    code("MOTS_CLES = ['stagiaire', 'data analyst', 'développeur', 'marketing', 'commercial', 'comptabilité']\n# Décommentez après avoir défini JOOBLE_API_KEY :\n# offres_jooble = collecter_jooble(MOTS_CLES, location='Marrakech')\n# offres_jooble.head()"),
    code("# Exemple d export quand une source autorisée a renvoyé des lignes :\n# offres = offres_jooble.drop_duplicates(['source', 'source_id', 'url'])\n# offres.to_excel(OUTPUTS / 'offres_collectees.xlsx', index=False)\n# print(f'{len(offres)} offres exportées')")
])

print(f'Notebooks créés dans {NOTEBOOKS}')
