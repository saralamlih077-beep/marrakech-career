# Événements au Maroc

La page candidat « Événements » utilise `frontend/public/events/catalog.json`. Le catalogue initial est une sélection éditoriale vérifiée le 7 octobre 2026 auprès des organisateurs ; ce n’est pas une collecte automatique. Aucune inscription ni donnée de profil n’est envoyée par la page. L’utilisateur ouvre le site de l’organisateur pour consulter les modalités et s’inscrire.

Les dates sont inclusives, sans heures inventées. Le statut en cours et l’exclusion des événements terminés utilisent le jour du Maroc (`Africa/Casablanca`), actualisé chaque minute. Recherche, domaine, ville et période se combinent. Un domaine sans annonce publiée donne un état vide explicite. Les lieux et tarifs non annoncés restent indiqués comme à consulter. Les explications pédagogiques sont des synthèses éditoriales des thèmes annoncés, pas des promesses de l’organisateur.

## Mettre à jour la sélection

Modifier le JSON après vérification de l’édition courante sur la source officielle, puis déployer. Conserver un identifiant unique par édition et ville, le pays `MA`, les dates ISO, les domaines reconnus, le statut `published`, un lien HTTPS et la date réelle de vérification. Pour retirer une annulation, supprimer la fiche ou passer son statut à `cancelled`. Ne pas réutiliser les tarifs ou lieux d’une édition précédente. `schemaVersion` vaut 1. Le navigateur revalide le catalogue à chaque ouverture ; les annonces nouvelles nécessitent une mise à jour du fichier et une publication.

Les fiches actuelles renvoient vers :

- https://marrakechairshow2026.com/ — 7–10 octobre 2026, Marrakech.
- https://globalgreen.ma/ — 14–17 octobre 2026, Casablanca.
- https://www.sib.ma/infos-pratique — 25–29 novembre 2026, El Jadida ; entrée gratuite sous conditions.
- https://www.etudiant.ma/forums-salons — forums 2027 à Rabat, Tanger, Agadir et Fès. La page source annonce des salles génériques à Tanger ; aucun lieu plus précis n’est déduit.
- https://www.etudiant.ma/forums/forum-international-de-letudiant-casablanca — 15–18 avril 2027, Casablanca.
- https://www.salon-agriculture.ma/en/ — 19–27 avril 2027, Meknès.
- https://gitexafrica.com/who-attends — 26–28 avril 2027, Marrakech.
- https://logismed.ma/presentation-du-salon/ et https://logismed.ma/page/3/ — 11–13 mai 2027, Casablanca.
- https://www.siemamaroc.com/ — 7–9 septembre 2027, Casablanca. Le lieu et le prix de 2026 ne sont pas reportés sur 2027.

Validation : `node --test --test-isolation=none tests/morocco-events.test.mjs`, puis `npm run build`. Vérifier aussi le chargement réel, les filtres et le menu sur mobile.
