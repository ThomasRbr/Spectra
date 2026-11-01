// Logos des entités fictives du catalogue, dessinés pour SPECTRA. Chaque
// symbole évoque l'activité de l'entité ; aucun ne reprend une marque réelle.
// Format commun : tuile 64 × 64 pleine, symbole centré.

const tile = (bg: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/>${body}</svg>`

const S = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'

export const FICTIVE_LOGOS: Record<string, string> = {
  // Exchange offshore : un H dont la barre est un double échange
  huobex: tile('#0f3d3e', `<g ${S} stroke="#5eead4" stroke-width="5"><path d="M19 16v32M45 16v32"/><path d="M24 27h16l-4-4M40 37H24l4 4"/></g>`),
  // Courtier de gré à gré : une mallette
  satsdesk: tile('#3b2a17', `<g ${S} stroke="#f2c27e" stroke-width="4"><rect x="13" y="22" width="38" height="26" rx="4"/><path d="M25 22v-4a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M13 33h38"/></g><rect x="28" y="30" width="8" height="6" rx="1.5" fill="#f2c27e"/>`),
  // Bridge de liquidité : une arche sur deux piles
  arcbridge: tile('#312e81', `<g ${S} stroke="#c7d2fe" stroke-width="4.5"><path d="M12 44h40M16 44V36a16 16 0 0 1 32 0v8"/><path d="M24 44v-6M32 44v-8M40 44v-6" stroke-width="3"/></g>`),
  // Protocole de prêt : deux cercles qui se recouvrent (prêter, emprunter)
  lendora: tile('#064e3b', `<g ${S} stroke-width="4.5"><circle cx="26" cy="32" r="12" stroke="#6ee7b7"/><circle cx="38" cy="32" r="12" stroke="#a7f3d0" stroke-opacity=".7"/></g>`),
  // Inscriptions ordinales : un sat (cercle) portant une inscription
  ordinalia: tile('#1c1917', `<circle cx="32" cy="32" r="17" fill="none" stroke="#fb923c" stroke-width="4.5"/><rect x="25" y="25" width="14" height="14" rx="2" fill="#fb923c"/><path d="M28 31h8M28 35h5" stroke="#1c1917" stroke-width="2" stroke-linecap="round"/>`),
  // Bridge à 9 validateurs dont 5 signent : la grille de multisignature
  nexusbridge: tile('#1e1b4b', [0, 1, 2, 3, 4, 5, 6, 7, 8]
    .map((i) => `<circle cx="${18 + (i % 3) * 14}" cy="${18 + Math.floor(i / 3) * 14}" r="5" ${[0, 2, 4, 6, 8].includes(i) ? 'fill="#a5b4fc"' : 'fill="none" stroke="#6366f1" stroke-width="2"'}/>`)
    .join('')),
  // Fausse plateforme d'investissement : une aurore et une flèche trop belle
  aurora: tile('#3b0764', `<g ${S} stroke-width="4"><path d="M10 40c8-10 14-10 22 0s14 10 22 0" stroke="#f0abfc"/><path d="M10 30c8-10 14-10 22 0s14 10 22 0" stroke="#e879f9" stroke-opacity=".6"/><path d="M38 20l8-8m0 0h-7m7 0v7" stroke="#fdf4ff"/></g>`),
  // Casino en ligne : une planète et son anneau, un dé en orbite
  orbit: tile('#7f1d1d', `<circle cx="32" cy="32" r="11" fill="#fde68a"/><ellipse cx="32" cy="32" rx="22" ry="8" fill="none" stroke="#fde68a" stroke-width="3" transform="rotate(-20 32 32)"/><rect x="45" y="13" width="9" height="9" rx="2" fill="#fde68a"/><circle cx="49.5" cy="17.5" r="1.4" fill="#7f1d1d"/>`),
  // Cartes cadeaux : une carte et son ruban
  cardhub: tile('#0c4a6e', `<g ${S} stroke="#7dd3fc" stroke-width="4"><rect x="12" y="19" width="40" height="27" rx="4"/><path d="M26 19v27M12 30h40"/><path d="M26 30c-4-6-10-4-8 0M26 30c4-6 10-4 8 0" stroke-width="3"/></g>`),
  // Réseau de DAB crypto : un distributeur avec écran et fente
  cryptoguichet: tile('#78350f', `<g ${S} stroke="#fcd34d" stroke-width="4"><rect x="17" y="11" width="30" height="42" rx="4"/><rect x="23" y="17" width="18" height="12" rx="1.5"/><path d="M24 38h16M27 46h10"/></g>`),
  // Portefeuille Lightning custodial : un éclair dans une poche
  voltpocket: tile('#422006', `<path d="M14 16h36v18a18 18 0 0 1-36 0z" fill="none" stroke="#facc15" stroke-width="4" stroke-linejoin="round"/><path d="M35 20l-9 14h7l-4 12 10-15h-7l3-11z" fill="#facc15"/>`),
  // Fournisseur de services Lightning : un nœud et ses canaux
  lumen_lsp: tile('#0f172a', `<g ${S} stroke="#67e8f9" stroke-width="3.5"><path d="M32 32L14 16M32 32l18-16M32 32L14 48M32 32l18 16"/></g><circle cx="32" cy="32" r="8" fill="#67e8f9"/><g fill="#0f172a" stroke="#67e8f9" stroke-width="3"><circle cx="14" cy="16" r="4.5"/><circle cx="50" cy="16" r="4.5"/><circle cx="14" cy="48" r="4.5"/><circle cx="50" cy="48" r="4.5"/></g>`),
  // Portefeuille dans une messagerie : une bulle qui contient une pièce
  tonpocket: tile('#0b3954', `<path d="M14 18h36a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H28l-9 8v-8h-5a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4z" fill="none" stroke="#7cc4fa" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="31" r="7" fill="#7cc4fa"/>`),
  // Place de marché NFT : une mosaïque
  mosaique: tile('#1f2937', `<rect x="13" y="13" width="17" height="17" rx="3" fill="#f472b6"/><rect x="34" y="13" width="17" height="17" rx="3" fill="#60a5fa"/><rect x="13" y="34" width="17" height="17" rx="3" fill="#fbbf24"/><rect x="34" y="34" width="17" height="17" rx="3" fill="#34d399"/>`),
  // Plateforme de lancement de jetons : un croissant et une trajectoire
  moonpad: tile('#111827', `<path d="M38 12a20 20 0 1 0 14 30A16 16 0 0 1 38 12z" fill="#e5e7eb"/><path d="M18 46l12-12m0 0h-8m8 0v8" fill="none" stroke="#111827" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
  // Fausse plateforme de rendement : une étoile et une courbe qui ne baisse jamais
  yieldnova: tile('#14532d', `<path d="M12 48c10 0 18-4 24-14s10-16 16-18" fill="none" stroke="#86efac" stroke-width="4" stroke-linecap="round"/><path d="M44 10l2.5 6.5L53 19l-6.5 2.5L44 28l-2.5-6.5L35 19l6.5-2.5z" fill="#bbf7d0"/>`),
}
