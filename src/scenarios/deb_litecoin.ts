import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { EUR_USD, fromUsd, usd } from '../engine/chains'
import type { AddrKind } from '../engine/addressgen'
import { dusting } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Compte Instagram professionnel piraté, rendu « contre rançon » en
// litecoins. Le pirate utilise un vieux portefeuille qui renvoie toujours le
// rendu sur la MÊME adresse (réutilisation d'adresse) : toutes ses opérations
// tournent autour d'une seule adresse, qu'il faut lire transaction par
// transaction. Habillage : rançons d'autres commerçants piratés, cartes cadeaux
// et casino payés avec ces rançons, poussière. Sortie : regroupement de tout le
// solde vers un échangeur instantané sans compte (ChangeNOW), fin d'affaire
// hors exchange régulé.

const r2 = (v: number) => Math.round(v * 100) / 100
const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const ltcOfEur = (eur: number) => r2(fromUsd('LTC', eur * EUR_USD))

const SHOPS = [
  { kind: 'une pâtisserie', handle: 'patisserie' },
  { kind: 'un salon de tatouage', handle: 'tattoo.studio' },
  { kind: 'une boutique de fleurs', handle: 'fleurs.atelier' },
  { kind: 'un salon de coiffure', handle: 'coiffure' },
  { kind: 'une friperie', handle: 'friperie' },
] as const

export const debLitecoin: ScenarioTemplate = {
  id: 'deb-litecoin',
  title: 'Litecoin : la rançon du compte Instagram',
  tagline: 'Un compte professionnel piraté, une rançon en LTC, et une adresse qui reçoit tous ses rendus.',
  description:
    'Le compte Instagram d\'une commerçante a été piraté ; le pirate exige une rançon en litecoins pour le rendre. Litecoin fonctionne comme Bitcoin (entrées, sorties, rendu), mais le portefeuille du pirate renvoie chaque rendu sur la même adresse : tout se passe au même endroit, et il faut trier. Recensez les autres commerçants rançonnés, retrouvez la transaction qui emporte la rançon, identifiez le service de sortie, un échangeur instantané sans compte, et les dépenses qui trahissent les habitudes du pirate.',
  difficulty: 1,
  chains: ['ltc'],
  skills: ['lecture_tx', 'utxo', 'change', 'exchange_id', 'requisition'],
  estMinutes: 35,
  lessons: ['bases-blockchain', 'utxo', 'change-heuristics', 'exchanges'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r, 'f')
    const victimName = victimP.name
    const city = fakeCity(r)
    const shopKind = r.pick(SHOPS)
    const igHandle = `@${shopKind.handle}.${city.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')}`
    const pirate = fakeHandle(r)

    const cv = exchange(w, 'coinhouse', 'ltc')
    const cn = w.entity('changenow')
    const cnHot = w.addr('ltc', { entity: cn, label: 'ChangeNOW — Hot Wallet LTC', tags: ['liquid', 'hot'], kind: 'p2wpkh' })
    const cardhub = w.customEntity({ name: r.pick(['Kartaz', 'GiftLite', 'Cadolis']), category: 'merchant', known: true, description: 'Revendeur en ligne (fictif) de cartes cadeaux (consoles, boutiques en ligne) payables en litecoins ; conserve l\'adresse électronique de livraison des codes et l\'IP de commande.' })
    const orbit = w.customEntity({ name: r.pick(['Litebet', 'Silver Spins', 'CasinoLite']), category: 'gambling', known: true, description: 'Casino en ligne (fictif) acceptant le litecoin, inscription par simple adresse électronique, sans vérification d\'identité.' })
    const cardAddr = w.addr('ltc', { entity: cardhub, label: `${cardhub.name} — Adresse de paiement`, kind: 'p2wpkh' })
    const orbitAddr = w.addr('ltc', { entity: orbit, label: `${orbit.name} — Dépôt joueur`, kind: 'p2wpkh' })

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const suspect = w.customEntity({ name: `Pirate « ${pirate} » (inconnu)`, category: 'suspect', description: 'Pirate de comptes Instagram professionnels, rançons en litecoins.' })
    const hKind: AddrKind = r.pick(['p2pkh', 'p2sh'] as const)
    const H = w.addr('ltc', { entity: suspect, kind: hKind })
    const victim = w.addr('ltc', { entity: victimE, kind: 'p2wpkh' })
    const vChange = w.addr('ltc', { entity: victimE, kind: 'p2wpkh', wallet: w.get(victim).wallet })

    const T0 = w.at(0)
    /** Rançon d'un autre commerçant piraté. */
    const ransoms: { payer: string; eur: number; value: number; tx: Tx }[] = []
    const ransom = (t: number, not?: number) => {
      const payer = w.addr('ltc', { kind: 'p2wpkh' })
      const eur = r.pick([150, 200, 250, 300, 350, 400, 500].filter((e) => e !== not))
      const value = ltcOfEur(eur)
      w.fund(payer, r8(value * r.float(1.05, 1.6)), t - Math.round(r.float(3, 48) * HOUR))
      const tx = w.utxoTx({ time: t, from: [payer], to: [{ address: H, value }] })
      ransoms.push({ payer, eur, value, tx })
      return tx
    }
    /** Dépense du pirate : le rendu revient sur H (réutilisation d'adresse). */
    const spend = (t: number, to: string, share: number) => {
      const avail = w.unspentValue(H, t)
      const value = r2(avail * share)
      return w.utxoTx({ time: t, from: [H], to: [{ address: to, value }], change: H, autoFund: false })
    }

    // ── Avant les faits : rançons d'autres commerçants, cartes cadeaux, casino
    ransom(T0 - Math.round(r.float(22, 26) * DAY))
    ransom(T0 - Math.round(r.float(15, 19) * DAY))
    const cardTx = spend(T0 - Math.round(r.float(12, 14) * DAY), cardAddr, r.float(0.35, 0.55))
    ransom(T0 - Math.round(r.float(8, 10) * DAY))
    const casino1 = spend(T0 - Math.round(r.float(4, 6) * DAY), orbitAddr, r.float(0.3, 0.5))

    // ── La victime : achat sur Coinhouse, paiement de la rançon ─────────────
    const demandEur = r.pick([250, 300, 350, 400, 450, 500])
    const demand = ltcOfEur(demandEur)
    cv.withdraw(victim, r8(demand + r.float(0.3, 1.8)), T0 - Math.round(r.float(3, 20) * HOUR))
    const pay = w.utxoTx({ time: T0, from: [victim], to: [{ address: H, value: demand }], change: vChange })

    // ── Après les faits : un autre commerçant paie (signalé par un autre service)
    // Montant différent de celui de la victime : le signalement (montant + date) désigne une seule entrée
    const witnessTx = ransom(T0 + Math.round(r.float(8, 30) * HOUR), demandEur)
    const witness = ransoms.find((x) => x.tx === witnessTx)!

    // ── Sortie : TOUT le solde de H part vers ChangeNOW, rendu sur H ────────
    const swapT = T0 + Math.round(r.float(40, 70) * HOUR)
    const totalAtSwap = r8(w.unspentValue(H, swapT))
    const nInputs = w.utxosOf(H, swapT).length
    const cnDeposit = w.addr('ltc', { entity: cn, label: 'ChangeNOW — Adresse de dépôt', tags: ['deposit'], kind: 'p2wpkh' })
    const swapValue = Math.floor(totalAtSwap * r.float(0.84, 0.92) * 100) / 100
    const swap = w.utxoTx({ time: swapT, from: [H], to: [{ address: cnDeposit, value: swapValue }], change: H, spendAll: true })
    const swapChange = r8(swap.outputs.find((o) => o.address === H)?.value ?? 0)
    const cnFwdT = swapT + r.int(5, 25) * 60
    const cnFee = w.estimateFee('ltc', 1, 1)
    const cnSweep = w.utxoTx({ time: cnFwdT, from: [cnDeposit], to: [{ address: cnHot, value: r8(swapValue - cnFee) }], fee: cnFee, change: null, spendAll: true, tags: ['sweep'] })

    // ── Après la sortie : le rendu repart au casino (même compte joueur) ────
    const casino2 = spend(swapT + Math.round(r.float(18, 50) * HOUR), orbitAddr, r.float(0.4, 0.65))

    // ── Poussière (créée après le flux : jamais dépensée) ────────────────────
    const dust = dusting(w, H, { time: swapT + 20 * HOUR, n: 2, spreadH: 15 })

    // ── Bruit de fond ────────────────────────────────────────────────────────
    cv.noise(10, T0 - 5 * DAY, T0 + 5 * DAY)
    for (let i = 0; i < r.int(6, 10); i++) {
      // Autres clients de ChangeNOW (dépôts LTC rapatriés vers le hot wallet)
      const t = T0 + Math.round(r.float(-72, 96) * HOUR)
      const c = w.addr('ltc')
      const d = w.addr('ltc', { entity: cn, label: 'ChangeNOW — Adresse de dépôt', tags: ['deposit'], kind: 'p2wpkh' })
      const v = r2(r.float(0.4, 25))
      w.fund(c, r8(v * r.float(1.02, 1.4)), t - Math.round(r.float(2, 200) * HOUR))
      w.utxoTx({ time: t, from: [c], to: [{ address: d, value: v }] })
      const f = w.estimateFee('ltc', 1, 1)
      w.utxoTx({ time: t + r.int(5, 25) * 60, from: [d], to: [{ address: cnHot, value: r8(w.unspentValue(d) - f) }], fee: f, change: null, spendAll: true, tags: ['sweep'] })
    }

    // ── Réponses (monde final) ───────────────────────────────────────────────
    const spentBy = w.spentBy.get(`${pay.id}:${pay.outputs.find((o) => o.address === H)!.n}`)
    if (spentBy !== swap.id) throw new Error('deb-litecoin : la rançon de la victime doit partir dans la transaction vers ChangeNOW')
    const payers = new Set(w.txsOf(H).filter((t) => t.outputs.some((o) => o.address === H && o.value > 0.001)).flatMap((t) => t.inputs.map((i) => i.address)).filter((a) => a !== H))
    const nPayers = payers.size
    const totalRansoms = r2(ransoms.reduce((s, x) => s + x.value, 0) + demand)
    const held = r8(w.unspentValue(H))
    const cardValue = cardTx.outputs.find((o) => o.address === cardAddr)!.value
    const casinoTotal = r8([casino1, casino2].reduce((s, t) => s + t.outputs.filter((o) => o.address === orbitAddr).reduce((a, o) => a + o.value, 0), 0))
    const hTxs = w.txsOf(H).length
    const kindLabel = hKind === 'p2pkh' ? 'commence par « L » (format historique)' : 'commence par « M » (script P2SH)'
    const witnessP = fakePerson(r)
    const witnessCity = fakeCity(r)
    const second = r.pick([150, 200, 250])
    const swapEur = Math.round(usd('LTC', swapValue) / EUR_USD)
    // Pièces de procédure en journée (heure UTC 7–16, soit 8 h–18 h à Paris)
    const dayAt = (ts: number, h: number) => Math.floor(ts / DAY) * DAY + h * HOUR
    const plainteT = dayAt(T0 + 2 * DAY, 8) + r.int(0, 8 * 60) * 60
    const signalT = dayAt(T0 + 5 * DAY, 7) + r.int(0, 4 * 60) * 60
    const noteT = signalT + r.int(60, 240) * 60
    const brigade = `brigade ${de(witnessCity)}`

    return {
      world: w,
      title: `Rançon du compte ${igHandle} — ${city}`,
      briefing:
        `${victimName} tient ${shopKind.kind} à ${city} ; son compte Instagram professionnel (${igHandle}) est sa vitrine. Elle a reçu un message « Meta Business » lui annonçant une violation de droits d'auteur, a cliqué, saisi son mot de passe et le code reçu par SMS. Une heure plus tard, l'adresse électronique et la double authentification du compte avaient changé.\n\n` +
        `Le pirate lui a écrit depuis le compte piraté lui-même : ${demandEur} € en litecoins pour le récupérer. Elle a payé. Il a alors exigé ${second} € de plus « pour désactiver la double authentification ». Elle a refusé et porte plainte.\n\n` +
        `Litecoin reprend le modèle de Bitcoin (UTXO, entrées, sorties, rendu). Le portefeuille du pirate a une particularité : il renvoie chaque rendu sur la même adresse. Votre mission : identifier cette adresse, recenser les autres commerçants rançonnés, retrouver la transaction qui emporte la rançon et le service où elle aboutit, relever les dépenses qui trahissent le pirate et ce qu'il détient encore.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteT, author: victimName,
          body:
            `« Je n'y connaissais rien. J'ai acheté des litecoins sur Coinhouse, le pirate m'a expliqué comment faire. J'ai payé ${amt(demand, 'LTC')}, c'était le montant qu'il demandait pour ${demandEur} €, le ${fmtDate(pay.time)}.\n\n` +
            `Mon adresse Litecoin : ${A(w, victim)}\n` +
            `Transaction : ${pay.hash} »`,
        },
        {
          id: 'dm', type: 'capture', title: `Capture — messages reçus depuis le compte ${igHandle}`, date: T0 + 4 * HOUR, author: igHandle,
          body:
            `ton compte est a moi maintenant 🙂\n` +
            `tu veux le recuperer ? ${demandEur}€ en LTC (litecoin), pas de banque, pas de paypal\n` +
            `adresse : ${A(w, H)}\n` +
            `tu as 24h sinon je supprime tout et je vends le compte\n` +
            `[${fmtDate(T0 + 3 * HOUR)}] bien recu. pour le code 2FA c'est ${second}€ de plus, meme adresse`,
        },
        {
          id: 'phishing', type: 'email', title: 'Message d\'hameçonnage (copie fournie par la victime)', date: T0 - 30 * HOUR, author: '« Meta Business Support »',
          body:
            `Votre compte ${igHandle} a fait l'objet d'un signalement pour violation des droits d'auteur.\n` +
            `Sans contestation sous 24 heures, il sera définitivement désactivé.\n\n` +
            `Contester : meta-business-appeal[.]help/${igHandle.slice(1)}\n\n` +
            `(Le domaine n'appartient pas à Meta.)`,
        },
        {
          id: 'signalement', type: 'pv', title: `Signalement de la ${brigade}`, date: signalT, author: `Brigade ${de(witnessCity)}`,
          body:
            `Plainte ${de(witnessP.name)}, gérant${witnessP.g('', 'e')} d'un commerce : compte Instagram professionnel piraté après un faux message « Meta », rançon exigée en litecoins.\n\n` +
            `${witnessP.g('Le plaignant', 'La plaignante')} a payé ${witness.eur} €, soit ${amt(witness.value, 'LTC')}, le ${fmtDate(witness.tx.time, false)}. Adresse de destination non conservée.\n\n` +
            `Transmis pour rapprochement éventuel.`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe', date: noteT, author: 'Chef de groupe',
          body:
            `L'adresse du pirate revient comme sortie dans presque toutes ses propres transactions : c'est son rendu, son portefeuille ne change jamais d'adresse. Ne prends pas ces sorties pour des paiements reçus.\n` +
            `Pour savoir où part la rançon, il faut la transaction qui DÉPENSE la sortie créée par le paiement de la victime : regarde les entrées, pas seulement les dates.\n` +
            `Un échangeur instantané n'a pas de compte client, mais il garde chaque commande : la réquisition se construit sur le hash du dépôt.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 9,
          prompt: 'Quelle est l\'adresse Litecoin du pirate ?',
          answer: [H],
          hint: 'Elle figure dans le message du pirate ; vérifiez-la dans la transaction citée dans la plainte : l\'une des deux sorties correspond au montant exigé.',
          explanation: `La sortie de ${amt(demand, 'LTC')} (le montant exigé pour ${demandEur} €) va vers ${A(w, H)}, qui ${kindLabel}. L'autre sortie est le rendu de la victime. Cette adresse cumule ${hTxs} transactions : le pirate s'en sert pour tout.`,
        },
        {
          id: 'o6', type: 'address', points: 7,
          prompt: 'Dans la transaction de paiement de la victime, quelle sortie lui revient (son rendu) ?',
          answer: [vChange],
          hint: 'Comparez les deux sorties : format d\'adresse identique à celui de l\'entrée, montant non rond, et ce n\'est pas le montant exigé.',
          explanation: `${A(w, vChange)} reçoit le reste de l'entrée de la victime, moins les frais. Elle a le même format (ltc1…) que son adresse, un montant quelconque, et n'est pas le montant exigé : c'est son rendu, une adresse neuve créée par son propre portefeuille. Elle appartient à la victime, pas au pirate : ce n'est pas une piste.`,
        },
        {
          id: 'o7', type: 'number', points: 9, tolerance: 0, unit: 'commerçants',
          prompt: 'Combien de portefeuilles distincts (celui de la victime compris) ont payé une rançon au pirate ?',
          answer: nPayers,
          hint: 'Listez les transactions qui créditent l\'adresse du pirate. Écartez celles où le pirate se paie lui-même (son adresse est aussi en entrée) et les montants de 0,00000546 LTC.',
          explanation: `${nPayers} portefeuilles : la victime et ${nPayers - 1} autres, avec des montants qui tombent sur des sommes rondes en euros (${ransoms.map((x) => `${x.eur} €`).join(', ')}). Les autres sorties vers l'adresse du pirate sont ses propres rendus (l'adresse figure aussi en entrée de ces transactions) ; les ${dust.txs.length} montants de 546 litoshis sont de la poussière. Chaque payeur est un commerçant à identifier et à entendre.`,
        },
        {
          id: 'o8', type: 'tx', points: 9,
          prompt: 'Quelle transaction correspond à la rançon du commerçant signalé par l\'autre brigade ?',
          answer: [witness.tx.id],
          hint: 'Le signalement donne un montant en LTC et une date : cherchez l\'entrée de l\'adresse du pirate qui concorde.',
          explanation: `Le ${fmtDate(witness.tx.time)}, ${amt(witness.value, 'LTC')} arrivent sur ${A(w, H).slice(0, 10)}… depuis ${A(w, witness.payer).slice(0, 12)}… (${witness.tx.hash.slice(0, 12)}…) : montant et date concordent, et aucune autre entrée de ce montant n'arrive ce jour-là. La plainte transmise par la ${brigade} peut être jointe, et l'adresse ${witnessP.g('du plaignant', 'de la plaignante')} est retrouvée. Le pirate a été payé après la victime : il n'a pas cessé.`,
        },
        {
          id: 'o2', type: 'tx', points: 11,
          prompt: 'Quelle transaction dépense la rançon payée par la victime ?',
          answer: [swap.id],
          hint: 'Ouvrez la transaction de la victime et suivez la sortie vers le pirate : l\'outil indique la transaction qui la dépense. Vérifiez qu\'elle figure parmi les entrées.',
          explanation: `La rançon arrive le ${fmtDate(pay.time)}. Elle n'est dépensée que le ${fmtDate(swap.time)}, par la transaction ${swap.hash.slice(0, 12)}…, qui consomme les ${nInputs} pièces alors disponibles sur l'adresse du pirate (${amt(totalAtSwap, 'LTC')}) : il vide tout. Les dépenses de cartes cadeaux et de casino datées d'avant le paiement ne peuvent pas contenir la rançon ; la mise au casino postérieure ne dépense que le rendu de cette transaction.`,
        },
        {
          id: 'o9', type: 'entity', points: 10,
          prompt: 'Vers quel service la rançon est-elle partie ?',
          answer: ['changenow'],
          hint: 'Suivez la sortie de la transaction précédente qui ne revient pas au pirate : l\'adresse est étiquetée.',
          explanation: `${amt(swapValue, 'LTC')} (environ ${swapEur.toLocaleString('fr-FR')} €) partent vers une adresse de dépôt de ChangeNOW, rapatriée quelques minutes plus tard vers le hot wallet du service. ChangeNOW est un échangeur instantané : sans compte, on y dépose un actif pour recevoir un autre actif, sur une autre chaîne, à l'adresse de son choix. Le pirate convertit sa collecte, très probablement vers un actif plus discret.`,
        },
        {
          id: 'o3', type: 'address', points: 9,
          prompt: 'Quelle adresse de dépôt de ce service faut-il citer dans la réquisition ?',
          answer: [cnDeposit],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse qui reçoit la sortie du pirate, puis reverse tout au hot wallet.',
          explanation: `${A(w, cnDeposit)} : l'échangeur crée une adresse de dépôt par commande. Avec le hash ${swap.hash.slice(0, 12)}… et le montant, elle permet à ChangeNOW de retrouver la commande, donc l'adresse de destination choisie par le pirate et les données techniques de connexion.`,
        },
        {
          id: 'o4', type: 'amount', points: 8, unit: 'LTC', tolerance: 0.01,
          prompt: 'Combien de LTC ont été envoyés à ce service ?',
          answer: swapValue,
          hint: 'Dans la transaction de sortie, lisez la sortie vers l\'adresse de dépôt, pas le total des entrées.',
          explanation: `${amt(swapValue, 'LTC')}, soit plus que la rançon de la victime (${amt(demand, 'LTC')}) : la transaction regroupe aussi les rançons d'autres commerçants. Les ${amt(swapChange, 'LTC')} restants reviennent sur l'adresse du pirate.`,
        },
        {
          id: 'o10', type: 'choice', points: 7,
          prompt: 'La transaction vers ChangeNOW a une seconde sortie… vers l\'adresse du pirate elle-même. Que représente-t-elle ?',
          ...choice(r,
            'Le rendu : son portefeuille renvoie la monnaie sur l\'adresse dépensée (réutilisation d\'adresse)',
            [
              'Un remboursement de ChangeNOW, qui a refusé une partie de la commande',
              'Un nouveau paiement d\'une victime, arrivé dans la même transaction',
              'Les frais de réseau, restitués au pirate par les mineurs',
            ]),
          hint: 'Qui signe cette transaction, et d\'où viennent toutes ses entrées ?',
          explanation: `Toutes les entrées appartiennent au pirate ; une sortie va au service, l'autre revient sur ${A(w, H).slice(0, 10)}… : c'est le rendu, renvoyé sur l'adresse même qui paie. Les portefeuilles modernes créent une adresse neuve pour chaque rendu ; certains anciens logiciels, ou des réglages par défaut, réutilisent l'adresse. C'est une aubaine pour l'enquêteur : tout le portefeuille tient sur une adresse, mais il faut lire chaque transaction pour distinguer paiements reçus et rendus. Les frais ne reviennent jamais à l'émetteur.`,
        },
        {
          id: 'o11', type: 'entity', points: 8,
          prompt: 'Avant les faits, le pirate a dépensé une partie des rançons chez un vendeur de cartes cadeaux. Lequel ?',
          answer: [cardhub.id],
          hint: 'Parmi les transactions antérieures de l\'adresse du pirate, cherchez une sortie étiquetée qui n\'est pas un casino.',
          explanation: `Le ${fmtDate(cardTx.time)}, le pirate paie ${amt(cardValue, 'LTC')} à ${cardhub.name} (cartes cadeaux contre crypto), rendu sur sa propre adresse. ${cardhub.name} peut connaître une adresse électronique, une IP et le code des cartes émises, voire où elles ont été utilisées (console de jeux, boutique en ligne) : c'est une réquisition secondaire utile, indépendante de l'échangeur. Les mises sur ${orbit.name} (${amt(casinoTotal, 'LTC')} en deux fois, même adresse de dépôt joueur) complètent le profil, mais ce casino ne vérifie pas l'identité.`,
        },
        {
          id: 'o12', type: 'amount', points: 8, unit: 'LTC', tolerance: 0.02,
          prompt: 'Combien de LTC restent sur l\'adresse du pirate à la fin de l\'analyse ?',
          answer: held,
          hint: 'Lisez le solde non dépensé de l\'adresse dans son résumé.',
          explanation: `${amt(held, 'LTC')} : le rendu de la sortie vers ChangeNOW, diminué de la dernière mise au casino (qui renvoie elle aussi son rendu sur la même adresse), plus quelques litoshis de poussière. C'est peu, mais l'adresse reste active : à surveiller. Le total des rançons connues s'élève à ${amt(totalRansoms, 'LTC')}.`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Que peut-on attendre d\'une réquisition adressée à ChangeNOW ?',
          ...choice(r,
            'Les données de la commande retrouvée par le hash du dépôt : actif et adresse de destination, IP, éventuellement un e-mail',
            [
              'L\'identité vérifiée du pirate, puisque tout client d\'un échangeur passe un contrôle KYC complet',
              'Le gel immédiat des litecoins, toujours présents sur le compte du pirate chez ChangeNOW',
              'Rien : un échangeur instantané ne conserve aucune donnée sur ses opérations',
            ]),
          hint: 'Un échangeur instantané a-t-il des comptes clients ? Garde-t-il les fonds ?',
          explanation: `ChangeNOW ne tient pas de compte client et ne garde pas les fonds : la conversion est exécutée en quelques minutes. Mais chaque commande est enregistrée (montants, adresse de destination, horodatages, données techniques de connexion). ${procedureFor(cn)} L'adresse de destination ouvre la suite du traçage, sauf si elle est sur Monero. Pas de gel possible côté échangeur : les fonds sont déjà repartis. Le KYC n'est demandé qu'exceptionnellement.`,
        },
        {
          id: 'o13', type: 'choice', points: 6,
          prompt: 'Pour l\'enquêteur, qu\'est-ce qui change entre Litecoin et Bitcoin ?',
          ...choice(r,
            'Peu de choses : même modèle UTXO avec rendu, seuls les formats d\'adresse diffèrent',
            [
              'Tout : Litecoin est un modèle à comptes, le solde reste donc sur l\'adresse',
              'Les adresses L… et M… sont des adresses Bitcoin : les fonds ont changé de chaîne',
              'Litecoin n\'a pas d\'explorateur public : seules les plateformes lisent les transactions',
            ]),
          hint: 'Pensez au modèle de transaction (entrées, sorties, rendu) plutôt qu\'à l\'apparence des adresses.',
          explanation: 'Litecoin reprend le code de Bitcoin : UTXO, entrées et sorties, rendu, mêmes heuristiques (type d\'adresse, montant rond, adresse neuve ou réutilisée). Les préfixes diffèrent (ltc1, L, M) et les blocs sont plus rapides (environ 2 min 30). Les explorateurs publics existent. Seule nuance : l\'extension optionnelle MWEB permet des transactions confidentielles, peu utilisées et repérables à leur entrée et à leur sortie de ce bloc d\'extension.',
        },
      ],
      truth: {
        path: [pay.id, swap.id, cnSweep.id],
        addresses: [H, cnDeposit, cardAddr],
        debrief:
          `1. Après un faux message « Meta Business », le compte ${igHandle} est piraté. ${victimName} paie ${amt(demand, 'LTC')} (${demandEur} €) à ${A(w, H)} ; sa transaction a deux sorties : la rançon et son propre rendu ${A(w, vChange)}.\n` +
          `2. L'adresse du pirate concentre tout son portefeuille (${hTxs} transactions) : ${nPayers} commerçants rançonnés, dont celui signalé par la ${brigade}, et des rendus qui reviennent toujours sur la même adresse.\n` +
          `3. Avant les faits, il dépense une partie des rançons chez ${cardhub.name} (cartes cadeaux) et sur ${orbit.name}.\n` +
          `4. Le ${fmtDate(swap.time)}, il vide les ${nInputs} pièces de son adresse : ${amt(swapValue, 'LTC')} vers une adresse de dépôt ChangeNOW, rendu de ${amt(swapChange, 'LTC')} sur sa propre adresse. ChangeNOW rapatrie le dépôt vers son hot wallet : fin du traçage on-chain, la suite dépend de la commande.\n` +
          `5. Le rendu repart en partie au casino ; ${amt(held, 'LTC')} restent sur l'adresse.\n\n` +
          `À retenir : Litecoin se lit comme Bitcoin. Quand un portefeuille réutilise son adresse pour le rendu, toutes les sorties « vers lui-même » sont des rendus, pas des paiements reçus ; pour savoir où part un paiement précis, on cherche la transaction qui dépense sa sortie. Un échangeur instantané n'est pas un exchange : pas de compte, pas de gel, mais une commande à requérir.\n\n` +
          `Réflexes de l'enquêteur : réquisition à ChangeNOW (hash du dépôt, adresse de dépôt, montant) pour obtenir l'adresse de destination et les données de connexion ; réquisition à ${cardhub.name} sur l'achat de cartes cadeaux ; demande à Meta sur les connexions au compte piraté (IP du pirate) ; jonction avec la plainte transmise par la ${brigade} et identification des autres commerçants payeurs ; surveillance de l'adresse du pirate.`,
      },
      hints: [
        'Ouvrez la transaction de la plainte depuis la pièce : une sortie correspond au montant exigé, l\'autre est le rendu de la victime.',
        'Sur l\'adresse du pirate, une transaction où son adresse est à la fois en entrée et en sortie est une dépense avec rendu, pas un paiement reçu.',
        'Pour savoir où part la rançon, suivez la sortie créée par le paiement de la victime jusqu\'à la transaction qui la dépense.',
        'Une adresse étiquetée « ChangeNOW — Adresse de dépôt » qui reverse tout au hot wallet : arrêtez-vous et préparez la réquisition sur la commande.',
      ],
    }
  },
}
