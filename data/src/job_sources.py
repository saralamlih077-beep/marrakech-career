"""Connecteurs d'offres : API officielle d'abord, pages publiques seulement si autorisées."""
from __future__ import annotations

import os
import json
from datetime import datetime, timezone
from typing import Iterable
from urllib.request import Request, urlopen

import pandas as pd

OFFRE_COLUMNS = ["source", "source_id", "titre", "entreprise", "ville", "contrat", "date_publication", "url", "description", "collectee_le"]


def collecter_jooble(mots_cles: Iterable[str], location: str = "Marrakech") -> pd.DataFrame:
    """Collecte via l'API REST Jooble, avec une clé fournie par Jooble."""
    key = os.getenv("JOOBLE_API_KEY")
    if not key:
        raise RuntimeError("Définissez JOOBLE_API_KEY avant la collecte Jooble.")
    rows = []
    for keyword in mots_cles:
        payload = json.dumps({"keywords": keyword, "location": location, "page": 1}).encode("utf-8")
        request = Request(f"https://jooble.org/api/{key}", data=payload, headers={"Content-Type": "application/json"}, method="POST")
        with urlopen(request, timeout=30) as response:
            body = json.loads(response.read().decode("utf-8"))
        for item in body.get("jobs", []):
            rows.append({
                "source": "Jooble", "source_id": item.get("id"), "titre": item.get("title"),
                "entreprise": item.get("company"), "ville": item.get("location"), "contrat": item.get("type"),
                "date_publication": item.get("updated"), "url": item.get("link"),
                "description": item.get("snippet"), "collectee_le": datetime.now(timezone.utc).isoformat(),
            })
    return pd.DataFrame(rows, columns=OFFRE_COLUMNS).drop_duplicates(["source", "source_id", "url"])


def sources_non_automatisees() -> pd.DataFrame:
    """Trace les sources à collecter manuellement ou via accord API, sans tenter de les contourner."""
    return pd.DataFrame([
        {"source": "JobSquare", "statut": "API partenaire : publication/gestion, pas une API publique de recherche"},
        {"source": "Stagiaire.ma", "statut": "À activer seulement avec autorisation explicite ou export fourni"},
        {"source": "Trabajo", "statut": "À activer seulement avec autorisation explicite ou export fourni"},
    ])
