# CosyHub — Inventaire & liste préparatoire

## État
Prototype d'interface uniquement, indépendant de Supabase. Aucune modification de `index.html`, `app.js`, du schéma SQL ou des automatisations Make.

## Parcours salarié
1. Choisir établissement, service et date.
2. Rechercher un produit et saisir la quantité disponible (les valeurs vides restent non comptées).
3. Visualiser l'avancement et les références en rupture.
4. Valider l'inventaire et afficher la liste préparatoire calculée.

## Parcours administrateur
- Modifier les quantités recommandées par produit.
- Les recommandations du prototype sont des données fictives.
- La règle de calcul est `à préparer = max(0, quantité recommandée - stock constaté)`.

## À décider avant le raccordement
- Catalogue officiel des produits, catégories, unités et conversions.
- Recommandations fixes par service ou calculées à partir du CA prévisionnel.
- Gestion des établissements et droits (salarié, manager, administrateur réseau).
- Gestion de produits pesés, conditionnements, décimales et stocks non comptés.
- Validation : verrouillage, auteur, horodatage, historique et possibilité de correction.
- Format final de la liste (PDF/impression/CSV) et destinataires.
- Déclenchement de Make : webhook, données envoyées et traitement des erreurs.
- Politiques Supabase RLS et séparation des données par établissement.

## Suite technique
1. Valider l'ergonomie avec des produits et quantités réels.
2. Importer le catalogue historique après inspection du fichier source.
3. Concevoir les tables et politiques de sécurité Supabase sans toucher aux données existantes.
4. Relier l'interface à la base et tester avec un établissement pilote.
5. Brancher l'export et l'automatisation Make après validation du flux.

## Fichier
`inventaire-prototype.html` : maquette autonome, responsive, avec recherche, catégories repliables, saisie de stock, réglage des recommandations, calcul local, impression/PDF via le navigateur et export CSV. Les données de démonstration sont enregistrées uniquement dans le stockage local du navigateur.
