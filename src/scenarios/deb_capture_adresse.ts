import { World } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { EUR_USD, fromUsd, usd } from '../engine/chains'
import { genAddress } from '../engine/addressgen'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, forwardAll, procedureFor, receivedIn } from './util'

// Seul indice : une capture d'écran d'application mobile où l'adresse de
// destination est tronquée (début…fin). L'enquêteur retrouve l'adresse complète
// avec la recherche (fragment de 4 caractères minimum) ou par le montant et
// l'heure, en écartant deux adresses qui ne partagent que le début ou la fin.
// Il remonte ensuite au portefeuille de la victime et à sa plateforme d'achat,
// puis suit le regroupement, le dépôt sur l'exchange et le rendu de l'escroc.

const PRE = 8
const SUF = 5
const r4 = (v: number) => Math.round(v * 1e4) / 1e4
const r5 = (v: number) => Math.round(v * 1e5) / 1e5
const eur = (v: number) => `${(Math.round(v * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export const debCaptureAdresse: ScenarioTemplate = {
  id: 'deb-capture-adresse',
  title: 'L\'adresse tronquée',
  tagline: 'Une capture d\'écran, une adresse coupée en deux : retrouvez-la sans rien deviner.',
  description:
    'Le téléphone de la victime a été réinitialisé : il ne reste qu\'une capture d\'écran de son paiement, sur laquelle l\'application n\'affiche que le début et la fin de l\'adresse de destination. Retrouvez l\'adresse complète grâce à la recherche et aux détails de la capture, en écartant les leurres, remontez au portefeuille de la victime et à sa plateforme d\'achat, puis suivez les fonds jusqu\'à l\'exchange et jusqu\'au rendu de l\'escroc.',
  difficulty: 1,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'exchange_id', 'osint'],
  estMinutes: 30,
  lessons: ['explorateur-blocs', 'premiers-reflexes', 'bases-blockchain', 'exchanges'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const relative = fakePerson(r)
    const city = fakeCity(r)

    const cv = exchange(w, 'coinhouse', 'btc')
    const destKey = r.pick(['binance', 'kraken', 'bitstamp', 'okx'] as const)
    const dest = exchange(w, destKey, 'btc')

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const suspect = w.customEntity({ name: 'Faux conseiller en placement (inconnu)', category: 'suspect' })
    const victim = w.addr('btc', { entity: victimE, kind: 'p2wpkh' })
    const s1 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const full = A(w, s1)
    const pre = full.slice(0, PRE)
    const suf = full.slice(-SUF)

    // Leurres : même début (fin différente) et même fin (début différent)
    let dp = pre + genAddress(r, 'btc', 'p2wpkh').slice(PRE)
    while (dp.slice(-SUF) === suf || dp === full) dp = pre + genAddress(r, 'btc', 'p2wpkh').slice(PRE)
    let ds = genAddress(r, 'btc', 'p2wpkh').slice(0, -SUF) + suf
    while (ds.slice(0, PRE) === pre || ds === full) ds = genAddress(r, 'btc', 'p2wpkh').slice(0, -SUF) + suf
    const decoyP = w.addr('btc', { addr: dp, kind: 'p2wpkh' })
    const decoyS = w.addr('btc', { addr: ds, kind: 'p2wpkh' })

    // ── Paiement de la victime ──────────────────────────────────────────────
    const priceEur = r.int(15, 60) * 100
    const value = r5(fromUsd('BTC', priceEur * EUR_USD))
    const T0 = w.at(0)
    const buyTx = cv.withdraw(victim, r5(value + r.float(0.002, 0.012)), T0 - Math.round(r.float(3, 30) * HOUR))
    const pay = w.utxoTx({ time: T0, from: [victim], to: [{ address: s1, value }] })

    // Leurres datés et chiffrés différemment
    cv.withdraw(decoyP, r5(value * r.pick([r.float(0.45, 0.7), r.float(1.3, 1.6)])), T0 + Math.round(r.float(2, 6) * HOUR) * (r.chance(0.5) ? 1 : -1))
    w.fund(decoyS, r5(value * r.float(1.03, 1.08)), T0 + Math.round(r.float(2, 5) * DAY) * (r.chance(0.5) ? 1 : -1))

    // ── Un autre paiement vers l'escroc, puis regroupement et dépôt ─────────
    const otherV = r5(fromUsd('BTC', (r.int(10, 50) * 100 + 50) * EUR_USD))
    const otherTx = w.fund(s1, otherV, T0 + Math.round(r.float(5, 30) * HOUR))
    const s2 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const hop = forwardAll(w, s1, s2, T0 + Math.round(r.float(36, 60) * HOUR))
    const total = w.unspentValue(s2)
    const depValue = r4(total * r.float(0.75, 0.9))
    const deposit = dest.newDeposit()
    const out = w.utxoTx({ time: hop.time + Math.round(r.float(4, 20) * HOUR), from: [s2], to: [{ address: deposit, value: depValue }] })
    const sweep = dest.sweep([deposit], out.time + Math.round(r.float(1, 6) * HOUR))[0]
    const credited = receivedIn(w, out, deposit)
    const chgOut = out.outputs.find((o) => o.address !== deposit)!
    const changeAddr = chgOut.address

    // ── Bruit de fond ────────────────────────────────────────────────────────
    dest.noise(14, w.at(-4 * 24), w.at(8 * 24))
    cv.noise(10, w.at(-4 * 24), w.at(6 * 24))

    const destName = dest.entity.name
    const shown = `${pre}…${suf}`
    const valueEur = usd('BTC', value) / EUR_USD
    const otherEur = Math.round(usd('BTC', otherV) / EUR_USD)
    const child = g('son fils', 'sa fille')

    return {
      world: w,
      title: `L'adresse tronquée — ${city}`,
      briefing:
        `${victimName}, ${r.int(68, 82)} ans, demeurant à ${city}, dépose plainte pour escroquerie. Un « conseiller en placement » lui a fait installer un logiciel de prise en main à distance, puis une application de portefeuille bitcoin, et lui a fait acheter des bitcoins pour un « placement garanti ». ${g('Il', 'Elle')} a validé un envoi depuis son téléphone.\n\n` +
        `Depuis, le téléphone a été réinitialisé par un réparateur. Il ne reste qu'une capture d'écran du paiement, envoyée à ${child}. Comme beaucoup d'applications, le portefeuille n'y affiche que le début et la fin de l'adresse de destination.\n\n` +
        `Votre mission : retrouver l'adresse complète de l'escroc sans rien deviner, en écartant les fausses pistes ; remonter au portefeuille de la victime et à sa plateforme d'achat ; puis suivre les fonds jusqu'à la plateforme où ils ont été déposés, sans oublier ce que l'escroc a gardé. Aucune adresse n'est épinglée au départ : la recherche (Ctrl K) accepte un fragment d'adresse.`,
      evidence: [
        {
          id: 'capture', type: 'capture', title: 'Capture d\'écran du paiement (application mobile)', date: T0, author: relative.name,
          body:
            `✓ Envoyé\n` +
            `−${amt(value, 'BTC')}\n` +
            `≈ ${eur(valueEur)}\n\n` +
            `À : ${shown}\n` +
            `Date : ${fmtDate(pay.time)}\n` +
            `Frais réseau : ${amt(pay.fee, 'BTC')}\n` +
            `Statut : Confirmé`,
        },
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: out.time + DAY, author: victimName,
          body:
            `« Le conseiller voyait mon écran. Il m'a dit de coller l'adresse qu'il m'avait envoyée par message et de valider. Ses messages ont disparu avec la réinitialisation du téléphone.\n\n` +
            `Je ne connais pas l'adresse de mon portefeuille. J'avais fait une capture pour la montrer à ${child}, c'est tout ce qui me reste. »`,
        },
        {
          id: 'audition', type: 'pv', title: `Procès-verbal d'audition — ${relative.name}`, date: out.time + 2 * DAY, author: 'Enquêteur',
          body:
            `${relative.name}, ${g('fils du plaignant', 'fille de la plaignante')}, déclare :\n\n` +
            `« ${g('Mon père', 'Ma mère')} m'a envoyé la capture par messagerie le jour même, quelques minutes après l'envoi. Son téléphone était réglé à l'heure de Paris.\n` +
            `${g('Il', 'Elle')} m'a dit avoir acheté les bitcoins peu avant, sur une plateforme française, avec sa carte bancaire, sur les conseils du "conseiller". ${g('Il', 'Elle')} ne se souvient plus du nom.\n` +
            `Je n'ai jamais eu l'adresse complète. »`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe', date: out.time + DAY, author: 'Chef de groupe',
          body:
            `Interdiction de « compléter » l'adresse de mémoire ou au hasard.\n` +
            `Plusieurs adresses du périmètre peuvent commencer ou finir pareil : on ne retient que celle qui correspond aux deux extrémités ET à la transaction de la capture (montant, date). Les autres sont à documenter comme écartées.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse complète vers laquelle la victime a payé ?',
          answer: [s1],
          hint: 'Tapez dans la recherche les caractères visibles du début (au moins 4), puis ceux de la fin. Comparez les résultats et ouvrez la transaction entrante de chaque candidate.',
          explanation: `${full} est la seule adresse qui commence par ${pre} ET finit par ${suf}, et elle reçoit exactement ${amt(value, 'BTC')} le ${fmtDate(pay.time)}. Deux autres adresses du périmètre ne partagent qu'une extrémité.`,
        },
        {
          id: 'o5', type: 'addresses', points: 10,
          prompt: 'Quelles adresses du périmètre ne partagent qu\'une extrémité avec la capture et doivent être écartées ?',
          answer: [decoyP, decoyS],
          hint: 'Les recherches sur le début et sur la fin renvoient chacune plusieurs résultats : retenez ceux qui n\'apparaissent que dans une seule des deux listes.',
          explanation: `${A(w, decoyP)} a le même début (${pre}) mais une autre fin, et reçoit un montant différent à une autre heure. ${A(w, decoyS)} a la même fin (${suf}) mais un autre début, et reçoit des fonds un autre jour. Les consigner comme écartées, avec la raison, protège la procédure : on montre que l'adresse retenue n'a pas été choisie au hasard parmi plusieurs candidates.`,
        },
        {
          id: 'o6', type: 'address', points: 9,
          prompt: 'La victime ignore l\'adresse de son propre portefeuille. Laquelle est-ce ?',
          answer: [victim],
          hint: 'Ouvrez la transaction de paiement retrouvée : l\'adresse dépensée en entrée appartient au portefeuille de la victime.',
          explanation: `${A(w, victim)} est l'unique entrée de la transaction de paiement : c'est l'adresse du portefeuille de ${victimName}, qui avait reçu ses bitcoins juste avant. L'autre sortie de la transaction (hors paiement) est son rendu, une adresse neuve du même portefeuille. Connaître l'adresse de la victime permet de remonter à son achat et de vérifier qu'elle n'a pas fait d'autres paiements.`,
        },
        {
          id: 'o9', type: 'amount', points: 9, unit: 'BTC', tolerance: 0.01,
          prompt: 'Avant d\'être vidée, l\'adresse de l\'escroc reçoit un second versement. De quel montant ?',
          answer: otherV,
          hint: 'Listez les transactions entrantes de l\'adresse retrouvée : en plus du paiement de la capture, une autre la crédite.',
          explanation: `${amt(otherV, 'BTC')} (environ ${otherEur.toLocaleString('fr-FR')} €), reçus le ${fmtDate(otherTx.time)} depuis des adresses sans lien avec la victime. Un montant qui correspond à un « placement » rond en euros : très probablement une autre victime du même faux conseiller, à identifier en remontant ses adresses.`,
        },
        {
          id: 'o8', type: 'address', points: 9,
          prompt: 'Vers quelle adresse l\'escroc regroupe-t-il les deux versements ?',
          answer: [s2],
          hint: 'Dépliez les sorties de l\'adresse retrouvée : une seule transaction la vide entièrement, avec deux entrées et une seule sortie.',
          explanation: `La transaction ${hop.hash.slice(0, 12)}… dépense les deux versements reçus par ${A(w, s1)} et envoie tout (moins les frais) vers ${A(w, s2)}. Deux entrées, une seule sortie, aucun rendu : c'est un regroupement (consolidation), typique d'un même propriétaire qui rassemble ses fonds avant de les déplacer.`,
        },
        {
          id: 'o2', type: 'entity', points: 9,
          prompt: 'Sur quelle plateforme les fonds ont-ils été déposés ?',
          answer: [destKey],
          hint: 'Depuis l\'adresse de regroupement, dépliez les sorties : une transaction dont une sortie part vers une adresse ensuite balayée vers un hot wallet étiqueté.',
          explanation: `Depuis ${A(w, s2)}, l'escroc envoie ${amt(credited, 'BTC')} vers une adresse de dépôt ${destName}, balayée avec d'autres dépôts clients vers le hot wallet. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o3', type: 'amount', points: 9, unit: 'BTC', tolerance: 0.01,
          prompt: 'Combien de BTC ont été crédités sur l\'adresse de dépôt de cette plateforme ?',
          answer: credited,
          hint: 'Dans la transaction vers l\'adresse de dépôt, l\'autre sortie est le rendu de l\'escroc : ne l\'ajoutez pas.',
          explanation: `${amt(credited, 'BTC')} ; le reste de la transaction revient à l'escroc sous forme de rendu.`,
        },
        {
          id: 'o10', type: 'address', points: 9,
          prompt: 'Dans la transaction de dépôt, quelle sortie est le rendu de l\'escroc ?',
          answer: [changeAddr],
          hint: 'Des deux sorties, l\'une va vers l\'adresse de dépôt de l\'exchange ; l\'autre, de même type que l\'entrée et au montant non rond, ne mène à aucun service.',
          explanation: `${A(w, changeAddr)} reçoit ${amt(chgOut.value, 'BTC')} : même format bc1q… que l'entrée, montant quelconque, adresse neuve qui n'est pas balayée vers un hot wallet. C'est le rendu, qui reste sous le contrôle de l'escroc. Ces fonds ne sont pas sur l'exchange : il faut surveiller cette adresse pour savoir où ils partiront.`,
        },
        {
          id: 'o7', type: 'entity', points: 9,
          prompt: 'Sur quelle plateforme la victime a-t-elle acheté ses bitcoins ?',
          answer: ['coinhouse'],
          hint: 'Dépliez les entrées de l\'adresse de la victime : elle a été alimentée par une adresse étiquetée.',
          explanation: `Le ${fmtDate(buyTx.time)}, l'adresse de la victime reçoit des bitcoins du hot wallet de Coinhouse : c'est son retrait après achat, conforme à l'audition (« une plateforme française »). Une réquisition à Coinhouse confirmera l'achat (date, montant payé par carte, adresse de retrait) et documentera le préjudice. ${procedureFor(cv.entity)}`,
        },
        {
          id: 'o4', type: 'choice', points: 8,
          prompt: 'Pourquoi ne faut-il jamais recopier une adresse à la main ni la compléter d\'après une capture ?',
          hint: 'Pensez aux leurres que vous venez d\'écarter.',
          ...choice(r,
            'Une erreur ou un caractère deviné peut désigner l\'adresse d\'un tiers : on copie-colle et on vérifie',
            [
              'Les adresses changent de forme chaque jour : une copie manuelle serait déjà périmée au moment de la réquisition',
              'La recopie manuelle d\'une adresse est interdite par le code de procédure pénale',
              'Les explorateurs de blocs refusent les adresses tapées au clavier, par sécurité',
            ]),
          explanation: 'Une adresse désigne un compte précis : un caractère faux ou deviné peut pointer vers une autre personne, et une réquisition visant la mauvaise adresse ferait interroger un innocent. Les formats récents (bc1…) intègrent une somme de contrôle qui détecte la plupart des fautes de frappe, mais pas un « complément » plausible, et certains formats n\'en ont pas. De nombreuses adresses partagent le même début ou la même fin (c\'est le ressort de l\'address poisoning). Méthode : copier-coller depuis la source, vérifier début, milieu et fin, et rattacher l\'adresse à une transaction (montant, date).',
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Avant de rapprocher l\'heure de la capture de celle d\'une transaction, que faut-il vérifier ?',
          hint: 'Le téléphone, l\'explorateur et l\'outil d\'analyse n\'affichent pas forcément l\'heure de la même façon.',
          ...choice(r,
            'Le fuseau horaire de chaque source (téléphone, explorateur, outil), pour comparer des heures exprimées de la même façon',
            [
              'Rien : l\'heure d\'une transaction est la même partout, quel que soit l\'affichage',
              'Seulement le montant : l\'heure affichée par une application mobile n\'a aucune valeur probante',
              'Le numéro de bloc : la capture doit l\'indiquer, sinon elle est inexploitable',
            ]),
          explanation: `Une blockchain horodate les blocs en temps universel ; chaque application convertit ensuite selon ses réglages. Le téléphone était réglé à l'heure de Paris (une ou deux heures d'écart avec l'UTC selon la saison) : sans cette précaution, on peut écarter la bonne transaction ou retenir un leurre. On note dans le procès-verbal le fuseau de chaque source, et l'on croise toujours l'heure avec le montant (${amt(value, 'BTC')}) et les extrémités de l'adresse.`,
        },
      ],
      truth: {
        path: [pay.id, hop.id, out.id, sweep.id],
        addresses: [s1, s2, deposit, changeAddr, victim],
        debrief:
          `1. La capture ne montre que ${shown}. La recherche sur le début (${pre}) fait aussi apparaître ${A(w, decoyP)} ; celle sur la fin (${suf}) fait apparaître ${A(w, decoyS)}. Une seule adresse figure dans les deux listes : ${full}.\n` +
          `2. Contrôle croisé : cette adresse reçoit ${amt(value, 'BTC')} le ${fmtDate(pay.time)}, exactement comme sur la capture (heure de Paris). Les deux leurres (même début ou même fin) ont des montants et des dates différents.\n` +
          `3. L'entrée de la transaction de paiement est l'adresse de la victime, ${A(w, victim)}, alimentée peu avant par un retrait Coinhouse : c'est son achat.\n` +
          `4. L'adresse de l'escroc reçoit aussi ${amt(otherV, 'BTC')} d'une autre origine (autre victime probable), puis l'escroc regroupe les deux versements sur ${A(w, s2)}.\n` +
          `5. Il envoie ${amt(credited, 'BTC')} vers une adresse de dépôt ${destName} ${A(w, deposit)}, balayée vers le hot wallet, et garde ${amt(chgOut.value, 'BTC')} en rendu sur ${A(w, changeAddr)}.\n\n` +
          `À retenir : une adresse tronquée n'est pas une adresse. On la retrouve par recoupement (début + fin + montant + date, dans le bon fuseau horaire), jamais par déduction, et l'on documente les candidates écartées.\n\n` +
          `Réflexes de l'enquêteur : requérir ${destName} sur l'adresse de dépôt avec demande de gel ; requérir Coinhouse, qui connaît l'achat et l'adresse de retrait de la victime ; surveiller l'adresse de rendu ; rechercher l'autre victime à partir du second versement ; conserver la capture originale (fichier, métadonnées) comme pièce.`,
      },
      hints: [
        'Ouvrez la recherche (Ctrl K) et collez les caractères visibles au début de l\'adresse (au moins 4).',
        'Plusieurs adresses peuvent commencer ou finir pareil : recherchez aussi la fin, puis vérifiez montant et date de la transaction entrante.',
        'La transaction de paiement a une entrée (la victime) : remontez-la pour trouver d\'où viennent ses bitcoins.',
        'Une fois l\'adresse confirmée, dépliez ses sorties : un regroupement, puis une transaction dont une sortie est balayée vers un hot wallet étiqueté et l\'autre est le rendu.',
      ],
    }
  },
}
