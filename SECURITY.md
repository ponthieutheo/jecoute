# Sécurité

## Signaler une faille

Merci de ne pas publier de faille dans une issue, une discussion ou une pull request : signale-la **en privé**, avec
le signalement privé de GitHub. Onglet **Security** du dépôt, puis **Report a vulnerability**, ou directement :
<https://github.com/ponthieutheo/jecoute/security/advisories/new>.

Indique si possible :

- la version de J’écoute et le système (version de Windows) ;
- la faille, son impact et les conditions nécessaires (accès local, interaction de l'utilisateur…) ;
- les étapes pour la reproduire ou une preuve de concept ;
- une piste de correction, si tu en as une.

## Délais

- Accusé de réception sous 7 jours.
- Premier diagnostic (faille confirmée ou non, gravité) sous 14 jours.
- Correctif publié dès que possible selon la gravité ; je te tiens au courant de l'avancement.

La divulgation est coordonnée : merci de ne rien publier avant la sortie du correctif, ou au plus tard 90 jours
après ton signalement sans accord contraire. Une fois la version corrigée publiée, un avis de sécurité GitHub
décrit la faille, avec ton nom si tu le souhaites.

## Versions prises en charge

Seule la dernière version publiée reçoit des correctifs de sécurité. Une installation existante la propose d'elle-même
(mise à jour automatique).

| Version                 | Prise en charge |
| ----------------------- | --------------- |
| Dernière version        | Oui             |
| Versions plus anciennes | Non             |

## Périmètre

Dans le périmètre :

- l'application J’écoute : le code de ce dépôt, y compris le cœur hérité de Handy ;
- ses installeurs et sa mise à jour automatique (`latest.json`, signatures de mise à jour) ;
- les workflows GitHub Actions de ce dépôt et les fichiers des releases.

Le cœur de J’écoute vient de [Handy](https://github.com/cjpais/Handy) (transcription, audio, raccourcis, mise à
jour). Si la faille existe aussi dans Handy, elle doit être corrigée en amont : signale-la aussi à son auteur, en
privé. Tu peux aussi la signaler seulement ici et je la transmettrai.

Hors périmètre :

- les failles des dépendances (bibliothèques, modèles de transcription) : à signaler à leurs auteurs, et ici si
  J’écoute y est exposé ;
- les services tiers choisis par l'utilisateur, comme les fournisseurs d'IA en ligne du post-traitement ;
- l'avertissement SmartScreen dû à l'absence de signature de code des installeurs (connu, expliqué dans le README).

## Vérifier un fichier téléchargé

Chaque release contient `SHA256SUMS.txt`, et les installeurs ainsi que `latest.json` portent une attestation de
provenance GitHub, qui prouve qu'ils ont été construits par le workflow de release de ce dépôt :

```
gh attestation verify Jecoute_<version>_x64-setup.exe --repo ponthieutheo/jecoute
```

## In English

Please do not report security issues in public issues, discussions or pull requests. Use GitHub's private
vulnerability reporting instead: **Security** tab, then **Report a vulnerability**
(<https://github.com/ponthieutheo/jecoute/security/advisories/new>). Reports in English are welcome. Only the latest
release receives security fixes. Expect an acknowledgement within 7 days and a first assessment within 14 days;
disclosure is coordinated (up to 90 days). Issues in the core inherited from [Handy](https://github.com/cjpais/Handy)
should also be reported upstream, privately; you may report them here only and they will be forwarded.
