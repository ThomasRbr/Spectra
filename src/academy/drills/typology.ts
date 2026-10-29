// Exercice « reconnaître la typologie » : un récit de victime généré à partir
// de modèles variés, à rattacher au bon schéma de fraude.
import { Rng } from '../../engine/rng'
import type { DrillDef } from '../model'
import { CITIES, de, FIRST_NAMES, fr, mkChoice, rngFor } from './util'

type Typ = 'romance' | 'fakeinvest' | 'conseiller' | 'sextortion' | 'poisoning' | 'drainer' | 'rugpull' | 'ransomware' | 'recovery' | 'simswap'

const LABEL: Record<Typ, string> = {
  romance: 'Escroquerie sentimentale menant à un faux investissement (« pig butchering »)',
  fakeinvest: 'Faux placement en ligne (publicité frauduleuse, fausse plateforme)',
  conseiller: 'Fraude au faux conseiller bancaire',
  sextortion: 'Sextorsion',
  poisoning: 'Address poisoning (empoisonnement de l\'historique)',
  drainer: 'Hameçonnage avec drainer (signature malveillante)',
  rugpull: 'Rug pull',
  ransomware: 'Rançongiciel',
  recovery: 'Arnaque au recouvrement (faux récupérateurs de fonds)',
  simswap: 'SIM swap (détournement de la ligne téléphonique)',
}

const MARKERS: Record<Typ, string> = {
  romance: 'relation affective construite sur la durée par un contact rencontré en ligne, qui amène progressivement la victime vers une plateforme de trading fictive affichant de faux gains, puis exige des « frais » pour tout retrait.',
  fakeinvest: 'démarchage par publicité (souvent une fausse caution de célébrité) ou appel d\'un « conseiller », fausse plateforme affichant des gains, prise en main à distance, sans relation sentimentale.',
  conseiller: 'usurpation de l\'identité de la banque (numéro falsifié, connaissance d\'informations personnelles), prétexte de « sécuriser » l\'épargne en urgence, conversion en crypto vers une adresse « sûre » dictée par l\'escroc.',
  sextortion: 'menace de diffuser des images intimes (réelles ou prétendues) sauf paiement en crypto, souvent sous un délai court.',
  poisoning: 'une adresse « sosie » (mêmes premiers et derniers caractères) injecte une transaction de montant nul ou infime dans l\'historique, en pariant que la victime copiera la mauvaise adresse.',
  drainer: 'site piégé ou faux airdrop qui fait signer une autorisation (approve, permit) : un contrat vide ensuite le portefeuille sans nouvelle action de la victime.',
  rugpull: 'les créateurs d\'un jeton ou d\'un projet retirent la liquidité ou abusent d\'une fonction privilégiée du contrat, faisant s\'effondrer la valeur, puis disparaissent.',
  ransomware: 'chiffrement des systèmes d\'une organisation et demande de rançon en crypto, souvent doublée d\'une menace de publication des données (double extorsion).',
  recovery: 'nouvelle escroquerie ciblant une victime déjà escroquée : de faux avocats, cabinets ou « services officiels » promettent de récupérer les fonds contre paiement préalable de frais.',
  simswap: 'la ligne de la victime est transférée sur une carte SIM contrôlée par l\'escroc, qui reçoit les codes SMS et prend le contrôle des comptes (messagerie, exchange).',
}

const REFLEX: Record<Typ, string> = {
  romance: 'Premiers réflexes : récupérer les adresses de dépôt fournies par la « plateforme », les hashes des virements crypto depuis l\'exchange de la victime, et prévenir la victime du risque d\'arnaque au recouvrement.',
  fakeinvest: 'Premiers réflexes : identifier l\'exchange d\'achat de la victime, les adresses de destination et le nom de domaine de la fausse plateforme (réquisitions hébergeur / registrar).',
  conseiller: 'Premiers réflexes : réquisitions rapides au prestataire d\'achat (distributeur, PSAN) et suivi immédiat des fonds vers un exchange pour demander un gel.',
  sextortion: 'Premiers réflexes : rassurer la victime (beaucoup de menaces sont du bluff, en masse), relever l\'adresse — souvent réutilisée pour de nombreuses victimes — et rechercher les autres paiements reçus.',
  poisoning: 'Premiers réflexes : comparer caractère par caractère l\'adresse habituelle et l\'adresse payée, identifier l\'adresse sosie et suivre les fonds (souvent vers un échangeur ou un mixeur) ; la fraude vise de nombreuses victimes en parallèle.',
  drainer: 'Premiers réflexes : révoquer les autorisations restantes, relever le contrat drainer et l\'adresse de réception, rechercher le kit de drainer (souvent partagé entre opérateurs, avec une commission reversée).',
  rugpull: 'Premiers réflexes : identifier l\'adresse du déployeur du contrat, la transaction de retrait de liquidité et la destination des fonds ; recenser les victimes acheteuses.',
  ransomware: 'Premiers réflexes : préserver les preuves, relever les adresses de paiement et les échanges de négociation, signaler (cybermalveillance, services spécialisés) et ne pas payer sans concertation.',
  recovery: 'Premiers réflexes : alerter la victime (aucun service sérieux ne fait payer à l\'avance une « restitution »), relever les adresses de paiement des frais : elles mènent parfois aux mêmes réseaux que l\'escroquerie initiale.',
  simswap: 'Premiers réflexes : réquisition à l\'opérateur téléphonique (changement de SIM, point de vente, pièces fournies), à l\'exchange (IP, retraits) et suivi des fonds retirés.',
}

const CONFUSE: Record<Typ, Typ[]> = {
  romance: ['fakeinvest', 'recovery', 'sextortion'],
  fakeinvest: ['romance', 'conseiller', 'recovery'],
  conseiller: ['simswap', 'fakeinvest', 'drainer'],
  sextortion: ['ransomware', 'romance', 'recovery'],
  poisoning: ['drainer', 'simswap', 'rugpull'],
  drainer: ['poisoning', 'rugpull', 'simswap'],
  rugpull: ['drainer', 'fakeinvest', 'poisoning'],
  ransomware: ['sextortion', 'drainer', 'simswap'],
  recovery: ['fakeinvest', 'romance', 'conseiller'],
  simswap: ['conseiller', 'drainer', 'poisoning'],
}

interface Vars {
  name: string
  age: number
  city: string
  amount: string
  small: string
  platform: string
  alias: string
  token: string
  btc: string
  app: string
}

const STORIES: Record<Typ, ((v: Vars) => string)[]> = {
  romance: [
    (v) => `${v.name}, ${v.age} ans, fait la connaissance de « ${v.alias} » sur une application de rencontre. Après plusieurs semaines de messages quotidiens et de confidences, ${v.alias} évoque ses gains en trading crypto et aide ${v.name} à ouvrir un compte sur « ${v.platform} ». Le tableau de bord affiche des gains spectaculaires ; ${v.name} y verse au total ${v.amount} €. Au moment de retirer, la plateforme réclame des « frais de déblocage ».`,
    (v) => `Un contact rencontré sur ${v.app}, qui se présente comme expert en finance installé à Singapour, entretient pendant deux mois une relation affectueuse avec ${v.name} (${v.age} ans, ${v.city}). Il lui montre comment acheter de l'USDT sur un exchange puis le transférer vers « ${v.platform} ». Après ${v.amount} € versés, impossible de retirer : on exige une « taxe » de 15 % et le contact se fâche quand ${v.name} hésite.`,
  ],
  fakeinvest: [
    (v) => `${v.name}, ${v.age} ans, clique sur une publicité où une personnalité de la télévision vante un placement crypto « garanti ». Un « conseiller » rappelle dans l'heure, fait installer un logiciel de prise en main à distance et guide l'achat de bitcoins envoyés vers « ${v.platform} ». Les gains affichés grimpent ; après ${v.amount} € investis, le conseiller ne répond plus.`,
    (v) => `Après avoir laissé ses coordonnées sur un comparateur de placements, ${v.name} (${v.city}) reçoit l'appel d'un « gestionnaire de patrimoine » de « ${v.platform} ». Documents soignés, faux numéro d'agrément, tableau de bord en ligne : ${v.amount} € sont convertis en crypto et envoyés à l'adresse indiquée. Le site disparaît trois mois plus tard.`,
  ],
  conseiller: [
    (v) => `${v.name} reçoit un appel affichant le numéro de sa propre banque. Le « conseiller anti-fraude » signale des opérations suspectes et explique qu'il faut « sécuriser » l'épargne sans attendre : acheter des cryptos via une application, puis les envoyer vers un « compte sécurisé » dont il dicte l'adresse. ${v.amount} € partent ainsi en une après-midi.`,
    (v) => `Un SMS annonce un paiement suspect sur le compte ${de(v.name)} ; quelques minutes plus tard, un « conseiller » appelle, connaît le nom de l'agence ${de(v.city)} et les dernières opérations. Il fait convertir l'épargne en USDT « le temps de bloquer le pirate » et transférer ${v.amount} € vers une adresse « de protection ».`,
  ],
  sextortion: [
    (v) => `${v.name} reçoit un courriel affirmant que sa webcam a été piratée et qu'une vidéo intime sera envoyée à tous ses contacts, sauf paiement de ${v.small} € en bitcoins sur l'adresse indiquée sous 48 heures. Le message cite un ancien mot de passe réellement utilisé par ${v.name}.`,
    (v) => `Après un appel vidéo avec une personne rencontrée sur ${v.app}, ${v.name}, ${v.age} ans, reçoit un enregistrement compromettant et la menace de l'envoyer à sa famille et à son employeur, sauf versement de ${v.small} € en crypto avant le soir.`,
  ],
  poisoning: [
    (v) => `${v.name} envoie chaque mois des USDT vers son propre compte d'exchange. Un jour, une transaction de 0 USDT apparaît dans l'historique, venant d'une adresse qui commence et finit par les mêmes caractères que l'adresse habituelle. Le mois suivant, ${v.name} copie l'adresse depuis l'historique et envoie ${v.amount} USDT… qui n'arrivent jamais sur son compte.`,
    (v) => `Une entreprise ${de(v.city)} paie un fournisseur en USDC. Quelques minutes après un paiement de test, une adresse dont les 5 premiers et les 4 derniers caractères sont identiques à ceux du fournisseur envoie un montant infime à l'entreprise. Le comptable, pressé, reprend l'adresse dans l'historique pour le paiement principal de ${v.amount} USDC.`,
  ],
  drainer: [
    (v) => `${v.name} voit passer sur X l'annonce d'un « airdrop » gratuit d'un jeton populaire. Sur le site, il faut connecter son portefeuille et signer une demande présentée comme une simple vérification. Quelques secondes plus tard, USDT, ETH et NFT sont transférés vers une adresse inconnue, sans qu'aucun envoi n'ait été validé par ${v.name}.`,
    (v) => `Un faux support technique sur Discord oriente ${v.name} vers un site imitant un protocole DeFi connu. ${v.name} approuve une autorisation de dépense illimitée pour « réparer » son portefeuille ; le lendemain, ses ${v.amount} USDC sont prélevés par un contrat inconnu.`,
  ],
  rugpull: [
    (v) => `${v.name} a acheté le nouveau jeton « ${v.token} », très promu sur Telegram et X par des influenceurs. Une semaine plus tard, les développeurs retirent toute la liquidité du pool sur le DEX : le prix s'effondre de 99 %, le site et le groupe Telegram disparaissent. ${v.name} y avait mis ${v.amount} €.`,
    (v) => `Un projet de jeu « play-to-earn » vend son jeton « ${v.token} » à des milliers d'investisseurs, dont ${v.name}. Une fois le pool alimenté, le déployeur du contrat, qui s'était réservé une fonction de création illimitée de jetons, en émet des milliards et les revend contre tout l'ETH du pool.`,
  ],
  ransomware: [
    (v) => `Une PME ${de(v.city)} découvre un lundi matin que tous ses serveurs sont chiffrés. Un fichier « LISEZ-MOI » exige ${v.btc} BTC sous 72 heures pour obtenir la clé de déchiffrement et menace de publier les données volées sur un site de fuite.`,
    (v) => `La clinique ${de(v.city)} ne peut plus accéder à ses dossiers patients : les fichiers portent une extension inconnue et une note renvoie vers un site .onion de « négociation » avec un compte à rebours. Le montant demandé : ${v.btc} BTC.`,
  ],
  recovery: [
    (v) => `Après avoir perdu ${v.amount} € sur une fausse plateforme, ${v.name} est contacté par un « cabinet d'avocats spécialisé en récupération de cryptos » qui affirme avoir localisé les fonds grâce à un « traçage blockchain ». Il réclame ${v.small} € de frais de dossier en USDT avant de lancer la « restitution ».`,
    (v) => `Un courriel au nom d'un « service européen de restitution des avoirs numériques » informe ${v.name} que les ${v.amount} € perdus l'an dernier ont été saisis et peuvent être rendus, contre le paiement préalable d'une « taxe de déblocage » de ${v.small} € en bitcoins.`,
  ],
  simswap: [
    (v) => `Un soir, le téléphone ${de(v.name)} perd tout réseau. Pendant ce temps, quelqu'un obtient une nouvelle carte SIM à son nom en boutique, réinitialise le mot de passe de sa messagerie et de son compte d'exchange grâce aux codes reçus par SMS, puis retire l'équivalent de ${v.amount} € en cryptos.`,
    (v) => `${v.name} reçoit de son opérateur un SMS confirmant un « changement de carte SIM » jamais demandé, puis son téléphone n'a plus de réseau. Dans l'heure, son compte d'exchange, protégé par une double authentification par SMS, est vidé de ${v.amount} € de bitcoins.`,
  ],
}

const ALIASES = ['Daniel', 'Lucas W.', 'Mei', 'Alessandro', 'Sarah K.', 'Victor', 'Jenny', 'Marco']
const PLATFORMS = ['AuroraTrade', 'CryptoNova Invest', 'BitPrime Capital', 'Zenith Markets', 'Velora FX', 'Orion Assets']
const TOKENS = ['MOONFROG', 'SAFEPANDA', 'ELONRUSH', 'GIGAWOLF', 'TURBOCAT', 'NOVAPEPE']
const APPS = ['Instagram', 'Facebook', 'LinkedIn', 'Telegram', 'une application de rencontre']

export const typology: DrillDef = {
  id: 'typology',
  title: 'Reconnaître la typologie',
  description: 'Rattacher le récit d\'une victime au bon schéma de fraude pour orienter les premiers actes.',
  level: 2,
  track: 'typologies',
  icon: 'Siren',
  generate(seed) {
    const rng = rngFor(seed, 'typology')
    const typ = rng.pick(Object.keys(LABEL) as Typ[])
    const v: Vars = {
      name: rng.pick(FIRST_NAMES),
      age: rng.int(24, 79),
      city: rng.pick(CITIES),
      amount: fr(rng.int(3, 180) * 500),
      small: fr(rng.int(4, 40) * 50),
      platform: rng.pick(PLATFORMS),
      alias: rng.pick(ALIASES),
      token: rng.pick(TOKENS),
      btc: String(rng.pick([2, 3, 5, 8, 12, 15, 25])),
      app: rng.pick(APPS),
    }
    const story = rng.pick(STORIES[typ])(v)
    const confusions = rng.shuffle([...CONFUSE[typ]])
    const others = rng.shuffle((Object.keys(LABEL) as Typ[]).filter((t) => t !== typ && !confusions.includes(t)))
    const n = rng.pick([4, 4, 5])
    const pool = [...confusions.slice(0, n === 5 ? 3 : 2), ...others]
    const { options, answer } = mkChoice(rng, LABEL[typ], pool.map((t) => LABEL[t]), n)
    const shown = (Object.keys(LABEL) as Typ[]).filter((t) => t !== typ && options.includes(LABEL[t]) && CONFUSE[typ].includes(t))
    return {
      prompt: 'De quelle typologie relève ce récit ?',
      context: rng.pick(['Extrait du procès-verbal d\'audition de la victime.', 'Résumé de la plainte reçue en brigade.', 'Signalement transmis par une plateforme de lutte contre la cybermalveillance.']),
      visual: { type: 'list', title: 'Récit', items: [story] },
      kind: 'choice',
      options,
      answer,
      explain:
        `${LABEL[typ]} : ${MARKERS[typ]}\n\n` +
        (shown.length ? `À ne pas confondre avec : ${shown.map((t) => `« ${LABEL[t]} » (${MARKERS[t].replace(/\.$/, '')})`).join(' ; ')}\n\n` : '') +
        REFLEX[typ],
    }
  },
}
