"""Pipeline réutilisable de collecte et nettoyage des organisations de Marrakech."""
from __future__ import annotations

import json
import os
import re
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd

PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
MARRAKECH = {"latitude": 31.6295, "longitude": -7.9811}
RAYON_METRES = 25_000
FIELD_MASK = ",".join([
    "places.id", "places.displayName", "places.formattedAddress", "places.location",
    "places.googleMapsUri", "places.websiteUri", "places.nationalPhoneNumber",
    "places.rating", "places.userRatingCount", "places.primaryTypeDisplayName", "nextPageToken",
])

COLONNES_RAW = [
    "search_query", "place_id", "nom", "adresse", "telephone", "site_web", "google_maps",
    "note", "nombre_avis", "categorie", "latitude", "longitude", "secteur", "source", "date_collecte",
]
COLONNES_APP = [
    "nom", "domaine", "sous_domaine", "categorie", "telephone", "email", "site_web", "adresse",
    "latitude", "longitude", "note", "nombre_avis", "priorite", "score_priorite", "google_maps",
]

DOMAINES = {
    "IT & Digital": ["informatique", "software", "web", "digital", "data", "ia", "tech", "cloud", "cyber", "application"],
    "Santé": ["santé", "sante", "clinique", "médical", "medical", "pharma", "laboratoire", "dentaire"],
    "Éducation & Formation": ["école", "ecole", "université", "universite", "formation", "institut", "academy"],
    "Marketing & Communication": ["marketing", "communication", "publicité", "publicite", "branding", "media", "design"],
    "Finance & Assurance": ["banque", "finance", "assurance", "comptab", "audit", "fiduciaire"],
    "Immobilier & Construction": ["immobilier", "real estate", "construction", "btp", "architect", "bâtiment", "batiment"],
    "Tourisme & Hôtellerie": ["hôtel", "hotel", "tourisme", "voyage", "travel", "restaurant", "riad"],
    "Commerce & Distribution": ["commerce", "distribution", "magasin", "retail", "grossiste"],
    "Industrie & Logistique": ["industrie", "logistique", "transport", "fabrication", "agroalimentaire", "textile"],
    "Secteur public": ["public", "université", "universite", "hôpital", "hopital", "office", "agence"],
}


def charger_requetes(path: str | Path) -> list[dict]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def obtenir_cle_api() -> str:
    key = os.getenv("GOOGLE_MAP_API") or os.getenv("GOOGLE_MAPS_API_KEY")
    if not key:
        raise RuntimeError("Définissez GOOGLE_MAP_API avant de lancer la collecte.")
    return key


def _headers(api_key: str) -> dict:
    return {"Content-Type": "application/json", "X-Goog-Api-Key": api_key, "X-Goog-FieldMask": FIELD_MASK}


def rechercher_places(api_key: str, query: str, pages_max: int = 3, pause_s: float = 1.0) -> list[dict]:
    """Interroge Text Search (New), avec pagination et reprise simple sur erreur réseau."""
    resultats, token = [], None
    for _ in range(pages_max):
        payload = {
            "textQuery": query, "languageCode": "fr", "regionCode": "MA", "pageSize": 20,
            "locationBias": {"circle": {"center": MARRAKECH, "radius": RAYON_METRES}},
        }
        if token:
            payload["pageToken"] = token
        request = Request(PLACES_URL, data=json.dumps(payload).encode("utf-8"), headers=_headers(api_key), method="POST")
        with urlopen(request, timeout=30) as response:
            body = json.loads(response.read().decode("utf-8"))
        resultats.extend(body.get("places", []))
        token = body.get("nextPageToken")
        if not token:
            break
        time.sleep(pause_s)
    return resultats


def _ligne_place(place: dict, query: str, secteur: str) -> dict:
    location = place.get("location", {}) or {}
    return {
        "search_query": query, "place_id": place.get("id"),
        "nom": (place.get("displayName") or {}).get("text"), "adresse": place.get("formattedAddress"),
        "telephone": place.get("nationalPhoneNumber"), "site_web": place.get("websiteUri"),
        "google_maps": place.get("googleMapsUri"), "note": place.get("rating"),
        "nombre_avis": place.get("userRatingCount"),
        "categorie": (place.get("primaryTypeDisplayName") or {}).get("text"),
        "latitude": location.get("latitude"), "longitude": location.get("longitude"),
        "secteur": secteur, "source": "Google Places API (New)",
        "date_collecte": datetime.now(timezone.utc).isoformat(),
    }


def collecter_entreprises(requetes: Iterable[dict], pages_max: int = 3) -> pd.DataFrame:
    api_key = obtenir_cle_api()
    lignes: list[dict] = []
    for item in requetes:
        query, secteur = item["requete"], item["secteur"]
        print(f"Collecte : {query}")
        try:
            lignes.extend(_ligne_place(p, query, secteur) for p in rechercher_places(api_key, query, pages_max))
        except (HTTPError, URLError, TimeoutError) as exc:
            print(f"  Échec : {exc}")
    return pd.DataFrame(lignes, columns=COLONNES_RAW)


def _texte(row: pd.Series) -> str:
    return " ".join(str(row.get(c, "") or "") for c in ["nom", "categorie", "search_query", "site_web"]).lower()


def classer_domaine(row: pd.Series) -> tuple[str, str]:
    text = _texte(row)
    scores = {nom: sum(mot in text for mot in mots) for nom, mots in DOMAINES.items()}
    domaine = max(scores, key=scores.get)
    if scores[domaine] == 0:
        domaine = "Non classé"
    if row.get("secteur") == "Public":
        return domaine if domaine != "Non classé" else "Secteur public", "Organisme public"
    return domaine, "-"


def calculer_priorite(row: pd.Series) -> tuple[int, str]:
    score = 0
    note, avis = row.get("note"), row.get("nombre_avis")
    if pd.notna(note): score += 2 if note >= 4.5 else 1 if note >= 4 else 0
    if pd.notna(avis): score += 2 if avis >= 20 else 1 if avis >= 5 else 0
    score += 2 if row.get("site_web") != "Non disponible" else 0
    score += 1 if row.get("telephone") != "Non disponible" else 0
    score += 2 if row.get("email") != "Non disponible" else 0
    score += 1 if row.get("domaine") == "IT & Digital" else 0
    return score, "Haute" if score >= 7 else "Moyenne" if score >= 4 else "Faible"


def nettoyer_entreprises(raw: pd.DataFrame) -> pd.DataFrame:
    """Déduplique, filtre Marrakech, normalise et produit les 15 colonnes de l'application."""
    df = raw.copy()
    df = df.dropna(subset=["place_id", "nom"]).drop_duplicates("place_id", keep="first")
    for col in ["nom", "adresse", "telephone", "site_web", "google_maps", "categorie"]:
        df[col] = df[col].astype("string").str.strip().str.replace(r"\s+", " ", regex=True)
        df[col] = df[col].replace({"": pd.NA, "nan": pd.NA}).fillna("Non disponible")
    for col in ["note", "nombre_avis", "latitude", "longitude"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    in_marrakech = df["adresse"].str.contains("Marrakech|Marrakesh", case=False, na=False)
    in_radius = df["latitude"].between(31.35, 31.90) & df["longitude"].between(-8.30, -7.65)
    df = df[in_marrakech | in_radius].copy()
    df[["domaine", "sous_domaine"]] = df.apply(lambda r: pd.Series(classer_domaine(r)), axis=1)
    df["email"] = "Non disponible"
    scores = df.apply(calculer_priorite, axis=1)
    df["score_priorite"] = [s[0] for s in scores]
    df["priorite"] = [s[1] for s in scores]
    return df.reindex(columns=COLONNES_APP).sort_values(["score_priorite", "note"], ascending=[False, False]).reset_index(drop=True)


def exporter_excels(raw: pd.DataFrame, clean: pd.DataFrame, output_dir: str | Path) -> tuple[Path, Path]:
    output_dir = Path(output_dir); output_dir.mkdir(parents=True, exist_ok=True)
    raw_path = output_dir / "entreprises_avant_nettoyage.xlsx"
    clean_path = output_dir / "entreprises_apres_nettoyage.xlsx"
    with pd.ExcelWriter(raw_path, engine="openpyxl") as writer:
        raw.to_excel(writer, index=False, sheet_name="Données brutes")
    with pd.ExcelWriter(clean_path, engine="openpyxl") as writer:
        clean.to_excel(writer, index=False, sheet_name="Entreprises")
        clean["domaine"].value_counts().rename_axis("domaine").reset_index(name="nombre").to_excel(writer, index=False, sheet_name="Domaines")
    return raw_path, clean_path
