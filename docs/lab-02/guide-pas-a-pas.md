# Guide pas-à-pas complet — Lab 2 TokTickIT

Ce guide part du principe que tu ne connais rien du tout. Suis les étapes **dans l'ordre**, une par
une. Ne saute pas d'étape. Chaque commande est à taper telle quelle dans un **terminal**.

> **Terminal, c'est quoi ?** Sur Mac : l'app "Terminal". Sur Windows : installe et utilise
> "Git Bash" (installé automatiquement avec Git, voir Étape 1) plutôt que l'invite de commandes
> classique — les commandes de ce guide sont écrites pour Bash/macOS/Linux.

---

## PARTIE 0 — Comprendre ce que tu vas faire (2 minutes)

Tu vas construire une petite application web avec :
- une **base de données** (PostgreSQL) qui stocke les tickets ;
- un **backend** (serveur, dossier `server/`) qui parle à la base de données et expose une API ;
- un **frontend** (interface visible dans le navigateur, dossier `client/`) qui parle au backend.

Le code de base est déjà écrit et livré dans `toktickit-lab2-scaffold.zip`. Ton travail : l'installer,
le faire tourner, le tester, le pousser sur GitHub avec un vrai historique de branches/PR, prendre des
captures d'écran, compléter les documents, et assembler un PDF.

---

## PARTIE 1 — Installer les outils sur ton ordinateur

Fais ceci une seule fois.

### 1.1 Installer Node.js
1. Va sur https://nodejs.org
2. Télécharge la version "LTS" (recommandée) et installe-la (clique "Next" partout).
3. Vérifie que ça marche : ouvre un terminal et tape :
   ```bash
   node -v
   npm -v
   ```
   Tu dois voir des numéros de version (ex: `v20.x.x`). Si tu vois "command not found", relance ton
   ordinateur et réessaie.

### 1.2 Installer Git
1. Va sur https://git-scm.com/downloads et installe Git pour ton système.
2. Vérifie :
   ```bash
   git --version
   ```
3. Configure ton identité (remplace par tes vraies infos) :
   ```bash
   git config --global user.name "Ton Nom"
   git config --global user.email "ton.email@kmutt.ac.th"
   ```

### 1.3 Installer PostgreSQL
1. Va sur https://www.postgresql.org/download/ et choisis ton système (Windows/Mac).
2. Pendant l'installation, on te demande un mot de passe pour l'utilisateur `postgres` — **note-le
   quelque part**, tu en auras besoin.
3. Laisse le port par défaut (`5432`).
4. Vérifie que ça marche :
   ```bash
   psql --version
   ```
   Si `psql` n'est pas reconnu, ajoute PostgreSQL à ton PATH (l'installateur le propose
   généralement, coche la case) ou redémarre le terminal.

### 1.4 Installer un éditeur de code
Télécharge et installe **VS Code** : https://code.visualstudio.com

### 1.5 Créer un compte GitHub
Si tu n'en as pas déjà un : https://github.com/join

---

## PARTIE 2 — Mettre en place le dépôt GitHub

### 2.1 Créer le dépôt vide sur GitHub
1. Va sur https://github.com/new
2. Nom du dépôt : par exemple `cpe334-toktickit`
3. Laisse-le "Private" ou "Public" selon les consignes du cours.
4. **Ne coche pas** "Add a README" (on va importer notre propre code).
5. Clique "Create repository". Garde cette page ouverte, elle te donne l'URL du dépôt
   (ex : `https://github.com/tonpseudo/cpe334-toktickit.git`).

### 2.2 Préparer le dossier sur ton ordinateur
1. Choisis un endroit sur ton disque, ex. `Documents/`.
2. Dans le terminal :
   ```bash
   cd ~/Documents
   mkdir cpe334-toktickit
   cd cpe334-toktickit
   git init
   git branch -M main
   ```
3. Décompresse `toktickit-lab2-scaffold.zip` que je t'ai donné **directement dans ce dossier**
   `cpe334-toktickit` (le contenu du zip — `client/`, `server/`, `docs/`, etc. — doit se retrouver
   directement à la racine du dossier, pas dans un sous-dossier `toktickit-lab2-scaffold/`).

### 2.3 Premier commit sur `main`
```bash
git add .
git commit -m "Initial scaffold: Lab 2 contract + backend/frontend skeleton"
git remote add origin https://github.com/TONPSEUDO/cpe334-toktickit.git
git push -u origin main
```
GitHub va te demander de te connecter (suis les instructions à l'écran, ou utilise GitHub Desktop
si tu préfères une interface graphique : https://desktop.github.com).

### 2.4 Créer la branche `lab2-staging`
```bash
git checkout -b lab2-staging
git push -u origin lab2-staging
```
À partir de maintenant, **tu ne travailles jamais directement sur `main` ni sur `lab2-staging`** —
tu crées une branche par tâche (voir Partie 8).

---

## PARTIE 3 — Configurer la base de données PostgreSQL

### 3.1 Créer la base de données
Dans le terminal :
```bash
createdb toktickit
```
Si ça échoue avec une erreur de mot de passe, utilise plutôt :
```bash
psql -U postgres
```
puis dans l'invite `postgres=#` qui apparaît :
```sql
CREATE DATABASE toktickit;
\q
```

### 3.2 Configurer le fichier `.env` du serveur
```bash
cd server
cp .env.example .env
```
Ouvre `server/.env` dans VS Code et remplace par tes vraies infos :
```
DATABASE_URL="postgresql://postgres:TON_MOT_DE_PASSE@localhost:5432/toktickit?schema=public"
PORT=4000
```
(remplace `TON_MOT_DE_PASSE` par le mot de passe noté à l'étape 1.3).

---

## PARTIE 4 — Lancer le backend (serveur)

Toujours dans le dossier `server/` :

```bash
npm install
```
→ ça télécharge toutes les librairies nécessaires (Express, Prisma…). Ça prend 1-2 minutes.

```bash
npx prisma migrate dev --name init
```
→ ça crée les tables dans ta base PostgreSQL à partir de `prisma/schema.prisma`. Réponds "y" si on
te demande une confirmation.

```bash
npx prisma db seed
```
→ ça remplit la base avec les données de départ (catégories, systèmes, requesters). Tu dois voir
`Seed complete: 4 categories, 7 related systems, 4 active + 1 inactive requester.`

```bash
npm run dev
```
→ le serveur démarre. Tu dois voir `TokTickIT API listening on http://localhost:4000`.
**Laisse ce terminal ouvert et tourner** — n'appuie pas sur `Ctrl+C`.

### 4.1 Vérifier que le backend répond
Ouvre un **nouveau** terminal (laisse l'ancien tourner) et tape :
```bash
curl http://localhost:4000/api/requesters
```
Tu dois voir une réponse JSON avec 4 requesters (Jennifer Anderson, Michael Brown, Sarah Johnson,
David Lee) — pas "Former Employee" (il est inactif, c'est normal, voir BR-04).

---

## PARTIE 5 — Lancer le frontend (interface)

Ouvre encore un **nouveau** terminal (le 3e), et fais :
```bash
cd ~/Documents/cpe334-toktickit/client
npm install
npm run dev
```
Tu dois voir quelque chose comme `Local: http://localhost:5173/`.

Ouvre ce lien dans ton navigateur (Chrome de préférence). Tu dois voir l'écran "Select Development
Requester".

**Récapitulatif : tu dois avoir 3 terminaux ouverts en même temps** :
1. `server` avec `npm run dev` qui tourne
2. `client` avec `npm run dev` qui tourne
3. un terminal libre pour taper des commandes git

---

## PARTIE 6 — Tester l'application à la main dans le navigateur

1. Sélectionne un Requester (ex. Jennifer Anderson) → clique "Continue".
2. Clique "+ Create Ticket".
3. Remplis le formulaire (Summary, Description, choisis Category/Related System/Priority).
4. Ajoute une image (JPG/PNG) en pièce jointe si tu veux tester ça.
5. Clique "Submit Ticket" → tu dois voir le numéro de ticket généré (ex. `TKT-2026-000001`).
6. Retourne sur "My Tickets" → ton ticket doit apparaître dans la liste.
7. Clique dessus → tu arrives sur le détail, avec la pièce jointe.
8. Teste "Remove" sur la pièce jointe (avec une raison de suppression) → elle doit passer dans
   "Removed Attachments" et son lien "Download" doit disparaître.
9. Clique "Change Requester" en haut à droite → sélectionne un autre Requester (ex. Sarah Johnson)
   → retourne sur "My Tickets" → le ticket créé avec Jennifer ne doit **pas** apparaître.

Si tout ça fonctionne, les fonctions de base marchent. **Fais des captures d'écran maintenant** pour
la Partie 6 du barème (états initial, erreur de validation, en cours d'envoi, succès, échec API,
pièce jointe invalide) — voir Partie 10 de ce guide pour les captures responsive avec Playwright.

---

## PARTIE 7 — Lancer les tests automatisés

### 7.1 Tests backend (unitaires + API)
Le serveur doit être **arrêté** pour ces tests si tu utilises la même base de données, car les
tests vident les tables avant chaque test (`resetDatabase`). Le plus sûr : crée une base séparée
pour les tests.

```bash
createdb toktickit_test
```
Crée un fichier `server/.env.test` :
```
DATABASE_URL="postgresql://postgres:TON_MOT_DE_PASSE@localhost:5432/toktickit_test?schema=public"
```
Puis, dans `server/`, applique le schéma à cette base de test :
```bash
DATABASE_URL="postgresql://postgres:TON_MOT_DE_PASSE@localhost:5432/toktickit_test?schema=public" npx prisma migrate deploy
```
Lance les tests en pointant vers cette base :
```bash
DATABASE_URL="postgresql://postgres:TON_MOT_DE_PASSE@localhost:5432/toktickit_test?schema=public" npm run test
```
Tu dois voir une liste de tests en vert (PASS). **Copie ce résultat** (capture d'écran ou copier-coller
du terminal) — c'est l'évidence demandée en Partie 3 du barème ("Test DD and Traceability").

### 7.2 Tests frontend
```bash
cd ../client
npm run test
```
Même chose : copie le résultat.

### 7.3 Si un test échoue
Lis le message d'erreur — il te dit quel fichier et quelle ligne. Corrige le code correspondant
(pas le test, sauf si le test lui-même est faux), relance `npm run test`. Ne commente jamais un
test qui échoue pour le faire "passer" — c'est explicitement interdit par le barème (Definition of
Done §13.1 : "No required test is skipped, disabled, or commented out").

---

## PARTIE 8 — Le workflow Git/GitHub (branches et Pull Requests)

C'est la partie la plus importante pour la note "Git Use with Engineering Workflow" (10 points).

### 8.1 Principe
Pour **chaque Issue** de `docs/lab-02/github-issues-plan.md`, tu fais :
1. Repartir de `lab2-staging` à jour.
2. Créer une branche.
3. Faire tes modifications, committer.
4. Pousser la branche sur GitHub.
5. Ouvrir une Pull Request (PR) vers `lab2-staging`.
6. Faire relire par un camarade (ou toi-même si solo, mais documente-le honnêtement).
7. Fusionner ("Merge") la PR.

### 8.2 Exemple concret, étape par étape

Repartir à jour :
```bash
git checkout lab2-staging
git pull origin lab2-staging
```

Créer une branche pour l'Issue 4 (Create Ticket) :
```bash
git checkout -b create-ticket
```

Fais tes modifications de code dans VS Code. Ensuite :
```bash
git add .
git commit -m "Implement Create Ticket API and UI (closes #4)"
git push -u origin create-ticket
```

Va sur GitHub → tu verras un bandeau "Compare & pull request" → clique dessus.
- **Base** : `lab2-staging` — **Compare** : `create-ticket`.
- Titre : "Create Ticket: API + UI + tests".
- Description : liste les FR/BR/AC couverts (copie-colle depuis `specification.md`), et les tests
  qui passent (copie depuis `tests.md`).
- Clique "Create pull request".

### 8.3 Revue par les pairs
- Demande à un camarade de classe de relire ta PR (commentaires directement sur GitHub).
- S'il n'y a personne : relis-toi toi-même sérieusement 24h plus tard, laisse au moins un commentaire
  constructif, et note-le honnêtement dans `reviewer.md`.
- Une fois approuvée, clique "Merge pull request" sur GitHub.

### 8.4 Répète pour chaque Issue
Refais les étapes 8.2–8.3 pour chaque ligne de `docs/lab-02/github-issues-plan.md` (spec-and-tests,
db-schema-and-seed, dev-requester-context, create-ticket, my-tickets,
ticket-detail-and-attachments, ui-style-and-responsive, e2e-and-integration).

### 8.5 PR finale de release
Une fois toutes les Issues fusionnées dans `lab2-staging` et tous les tests verts :
```bash
git checkout lab2-staging
git pull origin lab2-staging
```
Sur GitHub, ouvre une PR **de `lab2-staging` vers `main`**, relis-la, fusionne-la.

### 8.6 Capturer l'historique Git pour le PDF
```bash
git log --oneline --graph --all
```
Fais une capture d'écran de ce résultat — c'est l'évidence "commit history" demandée en Partie 1
du barème.

---

## PARTIE 9 — Créer les Issues et le tableau Kanban sur GitHub

1. Sur ton dépôt GitHub, va dans l'onglet **"Issues"** → "New issue".
2. Crée une Issue pour chaque ligne de `docs/lab-02/github-issues-plan.md` (8 Issues au minimum).
   Copie le contenu de la colonne "Scope" dans la description.
3. Va dans l'onglet **"Projects"** → "New project" → choisis le modèle "Board" (Kanban).
4. Crée les colonnes : Backlog, Specified, Started, PR Review, Fixing, Done.
5. Ajoute chaque Issue au tableau et déplace-la de colonne au fur et à mesure de ton avancement.
6. À la fin, toutes les Issues doivent être dans "Done". Fais une capture d'écran du tableau final.

---

## PARTIE 10 — Captures d'écran responsive avec Playwright

### 10.1 Installer Playwright
```bash
cd ~/Documents/cpe334-toktickit
npm install -D @playwright/test
npx playwright install --with-deps
```

### 10.2 Lancer les captures
Assure-toi que `client` (port 5173) ET `server` (port 4000) tournent toujours (Partie 4 et 5).
Dans un nouveau terminal :
```bash
npx playwright test e2e/lab-02 --project=desktop
npx playwright test e2e/lab-02 --project=tablet
npx playwright test e2e/lab-02 --project=mobile
```
Les captures automatiques (en cas d'échec) atterrissent dans `test-results/`. Pour des captures
**volontaires** (pas seulement en cas d'échec), le plus simple pour un débutant : ouvre le site dans
Chrome, appuie sur `F12` (outils développeur), clique l'icône "Toggle device toolbar" (icône
téléphone/tablette), choisis "iPhone 13" ou "iPad", et utilise `Cmd+Shift+P` (Mac) ou `Ctrl+Shift+P`
(Windows) → tape "Capture screenshot" → Entrée. Range les fichiers dans :
```
artifacts/lab-02/screenshots/create-ticket/{desktop,tablet,mobile}.png
artifacts/lab-02/screenshots/my-tickets/{desktop,tablet,mobile}.png
artifacts/lab-02/screenshots/ticket-detail/{desktop,tablet,mobile}.png
```

### 10.3 Vérifier la checklist visuelle
Ouvre `docs/lab-02/ui-spec.md` §14 et coche chaque ligne en comparant tes captures aux règles
(pas de texte coupé, pas de scroll horizontal, couleurs correctes, etc.).

---

## PARTIE 11 — Compléter les documents restants

### 11.1 `docs/lab-02/tests.md`
Remplace la section "6. Final Results" par le vrai résultat de tes commandes `npm run test`
(nombre de tests passés/échoués, copié-collé du terminal ou capture d'écran) — fais-le **après**
avoir tout fait passer au vert.

### 11.2 `docs/lab-02/reviewer.md`
Remplis le tableau des PR avec les vrais liens GitHub, les vrais noms, les vrais commentaires reçus.

### 11.3 `docs/lab-02/ai-use.md`
Remplis "My Reflection" avec 2-4 phrases sincères sur ton expérience (ce qui a bien marché, ce que
tu as dû corriger toi-même).

### 11.4 Mets à jour `README.md`
Vérifie que les commandes d'installation/lancement/test fonctionnent vraiment telles qu'écrites (en
partant d'un dossier vide et en les suivant à la lettre) — c'est explicitement vérifié dans le
Definition of Done.

---

## PARTIE 12 — Assembler le PDF final

Le PDF doit contenir, **dans cet ordre exact**, les titres "Answer Part 1" à "Answer Part 9" :

| Titre | Contenu à coller |
|---|---|
| Answer Part 1 | Capture `git log --graph`, capture du tableau Kanban "Done", rendu de `reviewer.md`, contenu de `README.md`/`.gitignore`, arborescence du dossier dans VS Code |
| Answer Part 2 | Lien + rendu de `specification.md`, capture prouvant qu'il existait avant les PR d'implémentation (regarde la date du premier commit qui l'ajoute) |
| Answer Part 3 | Lien + rendu de `tests.md`, sortie complète des tests qui passent |
| Answer Part 4 | Rendu de `ai-use.md` |
| Answer Part 5 | (0 point, inclus dans Part 6) |
| Answer Part 6 | Captures Create Ticket : initial, erreur de validation, en cours d'envoi, succès, échec API (coupe le serveur et réessaie), pièce jointe invalide |
| Answer Part 7 | Captures My Tickets : Requester A puis B (montrer que les tickets changent), recherche, filtres, tri, pagination, état vide, état "no results" |
| Answer Part 8 | Captures Ticket Detail : ajout pièce jointe, téléchargement, suppression douce avec raison, tentative d'accès à un ticket d'un autre Requester (échoue) |
| Answer Part 9 | Rendu de `ui-spec.md` + captures desktop/tablet/mobile + checklist visuelle cochée |

### Comment créer le PDF
- Le plus simple : écris tout dans un document Google Docs ou Word, colle tes captures d'écran
  (glisser-déposer l'image directement dans le document), puis "Fichier → Télécharger → PDF".
- Assure-toi que chaque capture est lisible **sans zoomer** (redimensionne si besoin, mais garde le
  texte net).

---

## PARTIE 13 — Checklist finale avant de rendre

- [ ] `main` contient le code final, `lab2-staging` a été fusionnée dedans par PR
- [ ] Toutes les Issues sont en colonne "Done"
- [ ] `npm run test` passe sans erreur dans `server/` et `client/`
- [ ] Aucun test n'est commenté ou désactivé
- [ ] Le seed tourne deux fois de suite sans créer de doublons (`npx prisma db seed` deux fois)
- [ ] Les captures desktop/tablet/mobile existent pour les 3 écrans principaux
- [ ] `reviewer.md` et `ai-use.md` sont remplis avec du vrai contenu (pas de `_[name]_` restant)
- [ ] Le PDF contient les 9 parties dans l'ordre, avec des liens qui fonctionnent
- [ ] Tu es capable d'expliquer n'importe quelle ligne de code si on te le demande à l'oral

Si un point de cette liste n'est pas coché, ne rends pas encore — reviens à la partie correspondante
de ce guide.
