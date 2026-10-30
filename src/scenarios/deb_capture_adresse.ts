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
    'Le téléphone de la victime a été réinitialisé : il ne reste qu\'une capture d\'écran de son paiement, sur laquelle l\'application n\'affiche que le début et la fin de l\'adresse de destination. Retrouvez l\'adresse complète grâce à la recherche et aux détails de la capture, puis suivez les fonds jusqu\'à l\'exchange.',
  difficulty: 1,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'exchange_id', 'osint'],
  estMinutes: 15,
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
    cv.withdraw(victim, r5(value + r.float(0.002, 0.012)), T0 - Math.round(r.float(3, 30) * HOUR))
    const pay = w.utxoTx({ time: T0, from: [victim], to: [{ address: s1, value }] })

    // Leurres datés et chiffrés différemment
    cv.withdraw(decoyP, r5(value * r.pick([r.float(0.45, 0.7), r.float(1.3, 1.6)])), T0 + Math.round(r.float(2, 6) * HOUR) * (r.chance(0.5) ? 1 : -1))
    w.fund(decoyS, r5(value * r.float(1.03, 1.08)), T0 + Math.round(r.float(2, 5) * DAY) * (r.chance(0.5) ? 1 : -1))

    // ── Un autre paiement vers l'escroc, puis regroupement et dépôt ─────────
    const otherV = r5(fromUsd('BTC', (r.int(10, 50) * 100 + 50) * EUR_USD))
    w.fund(s1, otherV, T0 + Math.round(r.float(5, 30) * HOUR))
    const s2 = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const hop = forwardAll(w, s1, s2, T0 + Math.round(r.float(36, 60) * HOUR))
    const total = w.unspentValue(s2)
    const depValue = r4(total * r.float(0.75, 0.9))
    const deposit = dest.newDeposit()
    const out = w.utxoTx({ time: hop.time + Math.round(r.float(4, 20) * HOUR), from: [s2], to: [{ address: deposit, value: depValue }] })
    const sweep = dest.sweep([deposit], out.time + Math.round(r.float(1, 6) * HOUR))[0]
    const credited = receivedIn(w, out, deposit)

    // ── Bruit de fond ────────────────────────────────────────────────────────
    dest.noise(14, w.at(-4 * 24), w.at(8 * 24))
    cv.noise(10, w.at(-4 * 24), w.at(6 * 24))

    const destName = dest.entity.name
    const shown = `${pre}…${suf}`
    const valueEur = usd('BTC', value) / EUR_USD

    return {
      world: w,
      title: `L'adresse tronquée — ${city}`,
      briefing:
        `${victimName}, ${r.int(68, 82)} ans, demeurant à ${city}, dépose plainte pour escroquerie. Un « conseiller en placement » lui a fait installer un logiciel de prise en main à distance, puis une application de portefeuille bitcoin, et lui a fait acheter des bitcoins pour un « placement garanti ». ${g('Il', 'Elle')} a validé un envoi depuis son téléphone.\n\n` +
        `Depuis, le téléphone a été réinitialisé par un réparateur. Il ne reste qu'une capture d'écran du paiement, envoyée à ${g('son fils', 'sa fille')}. Comme beaucoup d'applications, le portefeuille n'y affiche que le début et la fin de l'adresse de destination.\n\n` +
        `Votre mission : retrouver l'adresse complète de l'escroc sans rien deviner, puis suivre les fonds jusqu'à la plateforme où ils ont été déposés. Aucune adresse n'est épinglée au départ : la recherche (Ctrl K) accepte un fragment d'adresse.`,
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
            `Je ne connais pas l'adresse de mon portefeuille. J'avais fait une capture pour la montrer à ${g('mon fils', 'ma fille')}, c'est tout ce qui me reste. »`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe', date: out.time + DAY, author: 'Chef de groupe',
          body:
            `Interdiction de « compléter » l'adresse de mémoire ou au hasard.\n` +
            `Plusieurs adresses du périmètre peuvent commencer ou finir pareil : on ne retient que celle qui correspond aux deux extrémités ET à la transaction de la capture (montant, date).`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 30,
          prompt: 'Quelle est l\'adresse complète vers laquelle la victime a payé ?',
          answer: [s1],
          hint: 'Tapez dans la recherche les caractères visibles du début (au moins 4), puis ceux de la fin. Comparez les résultats et ouvrez la transaction entrante de chaque candidate.',
          explanation: `${full} est la seule adresse qui commence par ${pre} ET finit par ${suf}, et elle reçoit exactement ${amt(value, 'BTC')} le ${fmtDate(pay.time)}. Deux autres adresses du périmètre ne partagent qu'une extrémité : ${A(w, decoyP)} (même début, montant et heure différents) et ${A(w, decoyS)} (même fin, autre jour).`,
        },
        {
          id: 'o2', type: 'entity', points: 25,
          prompt: 'Sur quelle plateforme les fonds ont-ils été déposés ?',
          answer: [destKey],
          hint: 'Depuis l\'adresse retrouvée, dépliez les sorties : un regroupement, puis une transaction dont une sortie part vers une adresse ensuite balayée vers un hot wallet étiqueté.',
          explanation: `L'escroc regroupe le paiement avec un autre versement sur ${A(w, s2)}, puis envoie ${amt(credited, 'BTC')} vers une adresse de dépôt ${destName}, balayée avec d'autres dépôts clients vers le hot wallet. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o3', type: 'amount', points: 20, unit: 'BTC', tolerance: 0.01,
          prompt: 'Combien de BTC ont été crédités sur l\'adresse de dépôt de cette plateforme ?',
          answer: credited,
          hint: 'Dans la transaction vers l\'adresse de dépôt, l\'autre sortie est le rendu de l\'escroc : ne l\'ajoutez pas.',
          explanation: `${amt(credited, 'BTC')} ; le reste de la transaction revient à l'escroc sous forme de rendu.`,
        },
        {
          id: 'o4', type: 'choice', points: 25,
          prompt: 'Pourquoi ne faut-il jamais recopier une adresse à la main ni la compléter d\'après une capture ?',
          ...choice(r,
            'Une erreur ou un caractère deviné peut désigner l\'adresse d\'un tiers : on copie-colle et on vérifie',
            [
              'Les adresses changent de forme chaque jour : une copie manuelle serait déjà périmée au moment de la réquisition',
              'La recopie manuelle d\'une adresse est interdite par le code de procédure pénale',
              'Les explorateurs de blocs refusent les adresses tapées au clavier, par sécurité',
            ]),
          explanation: 'Une adresse désigne un compte précis : un caractère faux ou deviné peut pointer vers une autre personne, et une réquisition visant la mauvaise adresse ferait interroger un innocent. Les formats récents (bc1…) intègrent une somme de contrôle qui détecte la plupart des fautes de frappe, mais pas un « complément » plausible, et certains formats n\'en ont pas. De nombreuses adresses partagent le même début ou la même fin (c\'est le ressort de l\'address poisoning). Méthode : copier-coller depuis la source, vérifier début, milieu et fin, et rattacher l\'adresse à une transaction (montant, date).',
        },
      ],
      truth: {
        path: [pay.id, hop.id, out.id, sweep.id],
        addresses: [s1, s2, deposit],
        debrief:
          `1. La capture ne montre que ${shown}. La recherche sur le début (${pre}) fait aussi apparaître ${A(w, decoyP)} ; celle sur la fin (${suf}) fait apparaître ${A(w, decoyS)}. Une seule adresse figure dans les deux listes : ${full}.\n` +
          `2. Contrôle croisé : cette adresse reçoit ${amt(value, 'BTC')} le ${fmtDate(pay.time)}, exactement comme sur la capture. Les deux leurres (même début ou même fin) ont des montants et des dates différents.\n` +
          `3. L'escroc regroupe ce paiement et un autre versement sur ${A(w, s2)}, puis envoie ${amt(credited, 'BTC')} vers une adresse de dépôt ${destName} ${A(w, deposit)}, balayée vers le hot wallet.\n` +
          `4. Bonus : l'adresse de la victime apparaît désormais en entrée de la transaction de paiement ; on peut remonter jusqu'à son achat chez Coinhouse.\n\n` +
          `À retenir : une adresse tronquée n'est pas une adresse. On la retrouve par recoupement (début + fin + montant + date), jamais par déduction.\n\n` +
          `Réflexes de l'enquêteur : faire préciser l'heure et le fuseau de la capture ; requérir ${destName} sur l'adresse de dépôt avec demande de gel ; requérir aussi la plateforme d'achat de la victime, qui connaît l'adresse de retrait et l'historique ; conserver la capture originale (fichier, métadonnées) comme pièce.`,
      },
      hints: [
        'Ouvrez la recherche (Ctrl K) et collez les caractères visibles au début de l\'adresse (au moins 4).',
        'Plusieurs adresses peuvent commencer ou finir pareil : recherchez aussi la fin, puis vérifiez montant et date de la transaction entrante.',
        'Une fois l\'adresse confirmée, ajoutez-la au graphe et dépliez ses sorties jusqu\'à une adresse balayée vers un hot wallet étiqueté.',
      ],
    }
  },
}
