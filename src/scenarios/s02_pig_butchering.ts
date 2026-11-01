import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import { decoyBranches, type Branch } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakeName, fakePerson, fmtDate, procedureFor } from './util'

const trunc = (a: string) => `${a.slice(0, 6)}…${a.slice(-5)}`
/** Heure de Paris (0–23) d'un horodatage. */
const parisHour = (ts: number) => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' }).format(new Date(ts * 1000)))
/** Même jour que `ts`, à `h` heures pile (heure de Paris). */
const atHour = (ts: number, h: number) => ts - (ts % HOUR) + (h - parisHour(ts)) * HOUR
const FATE: Record<Branch['fate'], string> = {
  dort: 'n\'a plus bougé',
  'dépensée': 'a servi à de petits paiements',
  retour: 'a été reversée au portefeuille des faux retraits',
  'éclatée': 'a été ré-éclatée en petites sommes',
}

export const s02PigButchering: ScenarioTemplate = {
  id: 'pig-butchering-tron',
  title: 'Romance & faux trading (USDT-TRC20)',
  tagline: 'Escroquerie sentimentale à l\'investissement : faux retraits pour rassurer, plusieurs victimes, un collecteur, un courtier OTC au bout.',
  description:
    'Une victime rencontrée sur une application de rencontre a « investi » sur AuroraTrade en plusieurs versements, rassurée par de petits retraits qui fonctionnaient. Les USDT transitent sur Tron. Retrouvez le portefeuille collecteur, l\'adresse qui paie les faux retraits, les autres victimes, le montant total, le financeur de gas du réseau, une piste d\'identification inattendue, les plateformes de sortie et les fonds encore gelables.',
  difficulty: 2,
  chains: ['tron'],
  skills: ['tron', 'tokens', 'typologies', 'exchange_id', 'gel', 'requisition'],
  estMinutes: 50,
  lessons: ['comptes-evm', 'tron-usdt', 'typologies', 'gel-saisie'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r, 'f')
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const scamE = w.entity('aurora', { known: false })
    const operator = w.customEntity({ name: 'Réseau AuroraTrade (opérateurs)', category: 'suspect' })
    const datingE = w.customEntity({
      name: 'HeartLink Premium (fictif)', category: 'merchant', known: true, country: 'Chypre',
      description: 'Application de rencontre (fictive) qui accepte l\'USDT pour ses abonnements « Premium ». Conserve les comptes, profils, journaux de connexion et paiements.',
      compliance: { contact: 'Service juridique de HeartLink', cooperation: 'eio', responseDays: [20, 60], canFreeze: false, kyc: 'faible' },
    })

    const cv = exchange(w, 'coinhouse', 'tron')
    const kzKey = r.pick(['okx', 'binance'] as const)
    const kz = exchange(w, kzKey, 'tron')
    const hx = exchange(w, 'huobex', 'tron')
    // Plateforme qui a fourni les TRX du réseau (pivot d'identification des opérateurs)
    const gasSrcKey = r.pick((['binance', 'kraken', 'bitstamp'] as const).filter((k) => k !== kzKey))
    const gasSrc = exchange(w, gasSrcKey, 'tron')
    const otc = w.entity('satsdesk')
    const otcAddr = w.addr('tron', { entity: otc, label: 'SatsDesk OTC — Collecte', tags: ['liquid'] })

    // Portefeuille collecteur, portefeuille de gas (TRX) et portefeuille des « retraits »
    const collector = w.addr('tron', { entity: operator })
    const gasWallet = w.addr('tron', { entity: operator })
    const payout = w.addr('tron', { entity: operator })
    const gasFundTx = gasSrc.withdraw(gasWallet, 25000, w.at(-45 * 24), 'TRX')
    w.transfer({ time: w.at(-40 * 24), from: gasWallet, to: collector, value: 600, asset: 'TRX' })
    w.transfer({ time: w.at(-40 * 24 + r.float(1, 20)), from: gasWallet, to: payout, value: 300, asset: 'TRX' })

    // ── Victimes (dont la plaignante) ────────────────────────────────────────
    const nVictims = r.int(4, 7)
    const victims: { name: string; addr: string; deposit: string; total: number; nPay: number; pays: Tx[]; txs: string[] }[] = []
    for (let i = 0; i < nVictims; i++) {
      const name = i === 0 ? victimName : fakeName(r)
      const ve = w.customEntity({ name, category: 'victim' })
      const va = w.addr('tron', { entity: ve })
      // Chaque victime a une « adresse de dépôt AuroraTrade » propre
      const dep = w.addr('tron', { entity: scamE, label: 'AuroraTrade — dépôt' })
      const start = i === 0 ? w.at(-r.float(26, 30) * 24) : w.at(-r.float(14, 34) * 24)
      w.transfer({ time: start - r.int(6, 48) * HOUR, from: gasWallet, to: dep, value: 60, asset: 'TRX' })
      const nPay = r.int(2, 4)
      let total = 0
      let t = start
      const txs: string[] = []
      const pays: Tx[] = []
      for (let k = 0; k < nPay; k++) {
        // Montants croissants : la confiance s'installe
        const value = roundAsset('USDT', Math.round(r.float(1500, 6000) * (1 + k * 0.6) / 100) * 100)
        // La victime achète ses USDT sur Coinhouse
        cv.withdraw(va, value + r.int(5, 40), t - r.int(1, 6) * HOUR, 'USDT')
        const tx = w.transfer({ time: t, from: va, to: dep, value, asset: 'USDT' })
        pays.push(tx)
        txs.push(tx.id)
        total += value
        // Remontée vers le collecteur
        const fw = w.transfer({ time: t + r.int(20, 180) * 60, from: dep, to: collector, value, asset: 'USDT', method: 'transfer (token)' })
        txs.push(fw.id)
        t += Math.round(r.float(i === 0 ? 48 : 24, i === 0 ? 110 : 80) * HOUR)
      }
      victims.push({ name, addr: va, deposit: dep, total, nPay, pays, txs })
    }
    const plaignante = victims[0]
    const firstTx = plaignante.pays[0].hash

    // ── Faux retraits : de petites sommes rendues pour installer la confiance ─
    type Retrait = { victim: number; time: number; value: number; tx?: Tx }
    const plan: Retrait[] = []
    const nRetP = plaignante.nPay >= 3 ? 2 : 1
    for (let k = 0; k < nRetP; k++) plan.push({ victim: 0, time: plaignante.pays[k].time + Math.round(r.float(20, 40) * HOUR), value: roundAsset('USDT', r.float(120, 480)) })
    for (let i = 1; i < nVictims; i++) {
      if (r.chance(0.55)) plan.push({ victim: i, time: victims[i].pays[0].time + Math.round(r.float(18, 50) * HOUR), value: roundAsset('USDT', r.float(80, 600)) })
    }
    plan.sort((a, b) => a.time - b.time)
    const refills: Tx[] = []
    for (const p of plan) {
      if (w.balanceOf(payout, 'USDT') < p.value) {
        refills.push(w.transfer({ time: p.time - r.int(1, 8) * HOUR, from: collector, to: payout, value: p.value > 400 ? 1000 : 500, asset: 'USDT' }))
      }
      p.tx = w.transfer({ time: p.time, from: payout, to: victims[p.victim].addr, value: p.value, asset: 'USDT', method: 'transfer (token)' })
    }
    const retraitsP = plan.filter((p) => p.victim === 0)
    const retraitP = roundAsset('USDT', retraitsP.reduce((s, p) => s + p.value, 0))
    const nRetraitVictims = new Set(plan.map((p) => p.victim)).size
    // La plaignante renvoie ses « gains » sur Coinhouse pour vérifier qu'ils sont réels
    const cashback = retraitsP.map((p) => cv.receive(plaignante.addr, p.value, p.time + Math.round(r.float(3, 30) * HOUR), { asset: 'USDT' }))

    // La plaignante paie ensuite la « taxe de déblocage » réclamée par l'escroc, sur la même adresse
    const feeT = w.at(-r.float(20, 40))
    const unlockFee = roundAsset('USDT', Math.round((plaignante.total * r.float(0.25, 0.4)) / 50) * 50)
    cv.withdraw(plaignante.addr, unlockFee + r.int(5, 40), feeT - r.int(1, 6) * HOUR, 'USDT')
    const feeTx = w.transfer({ time: feeT, from: plaignante.addr, to: plaignante.deposit, value: unlockFee, asset: 'USDT' })
    const feeFw = w.transfer({ time: feeT + r.int(20, 180) * 60, from: plaignante.deposit, to: collector, value: unlockFee, asset: 'USDT', method: 'transfer (token)' })
    plaignante.txs.push(feeTx.id, feeFw.id)

    const grand = roundAsset('USDT', victims.reduce((s, v) => s + v.total, 0) + unlockFee)

    // ── Dépenses des opérateurs : l'abonnement « Premium » du site de rencontre ─
    const subPrice = r.pick([19.99, 24.99, 29.99])
    const datingAddr = w.addr('tron', { entity: datingE, label: 'HeartLink — Paiements' })
    const subs: Tx[] = []
    const nSubs = r.int(3, 4)
    let tSub = Math.min(...victims.map((v) => v.pays[0].time)) + Math.round(r.float(24, 60) * HOUR)
    for (let k = 0; k < nSubs; k++) {
      subs.push(w.transfer({ time: tSub, from: collector, to: datingAddr, value: subPrice, asset: 'USDT' }))
      tSub += 7 * DAY + r.int(-3, 3) * HOUR
    }
    // Autres abonnés : des particuliers qui paient une partie de leur solde
    for (let i = 0; i < r.int(5, 9); i++) {
      const user = w.addr('tron')
      const tU = w.at(r.float(-70, 10) * 24)
      w.fundAccount(user, roundAsset('USDT', r.float(150, 3000)), 'USDT', tU - r.int(2, 60) * DAY)
      w.transfer({ time: tU, from: user, to: datingAddr, value: r.pick([9.99, 19.99, 24.99, 29.99]), asset: 'USDT' })
      w.transfer({ time: tU + r.int(1, 20) * DAY, from: user, to: w.addr('tron'), value: roundAsset('USDT', r.float(40, 120)), asset: 'USDT' })
    }

    // ── Décaissement depuis le collecteur ────────────────────────────────────
    const tOut = w.at(r.float(2, 6) * 24)
    const branches = decoyBranches(w, collector, { time: tOut - r.int(10, 30) * HOUR, share: r.float(0.07, 0.11), branches: 3, asset: 'USDT', returnTo: payout })
    const avail = w.balanceOf(collector, 'USDT')
    const kzShare = roundAsset('USDT', avail * r.float(0.45, 0.55))
    const hxShare = roundAsset('USDT', avail * r.float(0.15, 0.2))
    const otcShare = roundAsset('USDT', avail * r.float(0.12, 0.18))
    const kzRes = kz.receive(collector, kzShare, tOut, { asset: 'USDT' })
    const hxRes = hx.receive(collector, hxShare, tOut + r.int(2, 30) * HOUR, { asset: 'USDT' })
    const otcTx = w.transfer({ time: tOut + r.int(32, 60) * HOUR, from: collector, to: otcAddr, value: otcShare, asset: 'USDT' })

    // Bruit
    kz.noise(18, w.at(-10 * 24), w.at(10 * 24), 'USDT')
    hx.noise(10, w.at(-10 * 24), w.at(10 * 24), 'USDT')
    cv.noise(10, w.at(-25 * 24), w.at(5 * 24), 'USDT')
    gasSrc.noise(8, w.at(-45 * 24), w.at(5 * 24), 'TRX')
    for (let i = 0; i < 6; i++) w.fundAccount(otcAddr, roundAsset('USDT', r.float(5000, 90000)), 'USDT', w.at(r.float(-15, 15) * 24))

    // ── Réponses (monde final) ───────────────────────────────────────────────
    const remaining = roundAsset('USDT', w.balanceOf(collector, 'USDT'))
    const refillTotal = roundAsset('USDT', refills.reduce((s, t) => s + t.transfers[0].value, 0))
    const branchTotal = roundAsset('USDT', branches.reduce((s, b) => s + b.value, 0))
    const subTotal = roundAsset('USDT', subPrice * nSubs)
    const netLoss = roundAsset('USDT', plaignante.total + unlockFee - retraitP)
    const handle = fakeHandle(r)
    const gasSrcName = gasSrc.entity.name
    const kzName = kz.entity.name
    // Pseudonyme de l'escroc : hors de la liste des prénoms tirés pour les victimes (pas d'homonyme)
    const alias = r.pick(['Ethan', 'Ryan', 'Jason', 'Daniel', 'Steven', 'William'])
    // Page « Retraits » : solde affiché et gain cohérents ; la « taxe » réclamée en pourcentage de ce solde
    const shownBal = roundAsset('USDT', plaignante.total * r.float(2.6, 3.4))
    const shownPct = Math.round((shownBal / plaignante.total - 1) * 100)
    const feePct = Math.max(1, Math.round((unlockFee / shownBal) * 100))
    // Délais réels entre un versement et le faux retrait qui le suit
    const retDelays = retraitsP.map((p) => Math.round((p.time - Math.max(...plaignante.pays.filter((x) => x.time < p.time).map((x) => x.time))) / HOUR))
    const retDelayTxt = retDelays.length > 1 ? `respectivement ${retDelays.join(' et ')} heures` : `${retDelays[0]} heures`
    const allDelays = plan.map((p) => Math.round((p.time - Math.max(...victims[p.victim].pays.filter((x) => x.time < p.time).map((x) => x.time))) / HOUR))
    // Conversation Telegram : messages datés (premier retrait, puis veille du paiement de la taxe)
    const tgT1 = retraitsP[0].time + 40 * 60
    const tgT2 = feeT - DAY - 3 * HOUR
    const tgLines = [
      [tgT1, `Tu vois mon cœur, ton retrait est arrivé, la plateforme est fiable 😘`],
      [tgT1 + 4 * 60, `Maintenant c'est le moment de mettre plus, le marché va exploser`],
      [0, '[…]'],
      [tgT2, `Ton compte est à +${shownPct} % 🚀`],
      [tgT2 + 6 * 60, `Pour retirer il faut payer ${feePct} % de taxe de déblocage, soit ${amt(unlockFee, 'USDT')}, c'est la règle de Singapour`],
      [tgT2 + 7 * 60, `Envoie sur la même adresse, le support valide en 24 h`],
    ] as const
    // Profil capturé par la plaignante pendant l'abonnement « Premium » (après le dernier paiement hebdomadaire)
    const profilT = atHour(subs[nSubs - 1].time + 2 * DAY, 21) + 12 * 60
    const plainteT = atHour(w.at(7 * 24), 10) + 15 * 60

    return {
      world: w,
      title: `Opération Aurora — ${city}`,
      briefing:
        `${victimName} (${city}) a rencontré « ${alias} », trader basé à Singapour, sur l'application de rencontre HeartLink. Après plusieurs semaines de conversation, il l'a ${g('incité', 'incitée')} à investir sur la plateforme AuroraTrade, qui affichait des gains spectaculaires.\n\n` +
        `${g('Il', 'Elle')} a acheté des USDT sur Coinhouse (réseau Tron) et les a envoyés, en ${plaignante.nPay} fois, à l'adresse de dépôt fournie par la plateforme. Entre deux versements, ${g('il', 'elle')} a pu « retirer » de petits gains, ce qui l'a ${g('convaincu', 'convaincue')} de verser davantage. Quand ${g('il', 'elle')} a voulu tout retirer, on lui a réclamé des « frais de déblocage », qu'${g('il', 'elle')} a fini par payer.\n\n` +
        `Objectifs : remonter jusqu'au portefeuille collecteur du réseau, comprendre d'où viennent les faux retraits, mesurer l'ampleur (autres victimes, montant total), identifier l'infrastructure du réseau (financement du gas, dépenses des opérateurs), les plateformes de sortie et les fonds encore gelables.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Plainte — déclaration de la victime', date: plainteT, author: victimName,
          body:
            `« J'ai effectué ${plaignante.nPay} versements d'« investissement », pour un total de ${amt(plaignante.total, 'USDT')}. Le premier : ${firstTx}.\n` +
            `Mon adresse Tron (Coinhouse → portefeuille personnel) : ${A(w, plaignante.addr)}\n\n` +
            `Au début, j'ai pu retirer mes gains : ${retraitsP.length > 1 ? `deux fois, ${retraitsP.map((p) => amt(p.value, 'USDT')).join(' puis ')}` : `une fois, ${amt(retraitsP[0].value, 'USDT')}`}. Je les ai renvoyés sur Coinhouse et ils sont bien arrivés : c'est ce qui m'a ${g('convaincu', 'convaincue')} que c'était sérieux.\n\n` +
            `Ensuite, le ${fmtDate(feeT, false)}, j'ai payé la « taxe de déblocage » que ${alias} me réclamait, sur la même adresse de dépôt. Rien n'a jamais été débloqué et le site ne répond plus. »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Captures — pages « Dépôt » et « Retraits » d\'AuroraTrade', date: feeT - DAY,
          body:
            `AuroraTrade · Dépôt USDT\nRéseau : TRC20 uniquement\nVotre adresse personnelle de dépôt :\n${A(w, plaignante.deposit)}\n⚠️ Les dépôts sur un autre réseau seront perdus.\n\n` +
            `AuroraTrade · Historique des retraits\n` +
            retraitsP.map((p) => `${fmtDate(p.time)}  ${amt(p.value, 'USDT')}  ✅ Traité`).join('\n') +
            `\nSolde du compte : ${amt(shownBal, 'USDT')} (+${shownPct} %)`,
        },
        {
          id: 'telegram', type: 'telegram', title: `Conversation Telegram avec « ${alias} »`, author: `@${handle}`, date: tgT2 + 7 * 60,
          body:
            tgLines.map(([t, m]) => (t ? `[${fmtDate(t)}] ${alias} : ${m}` : m)).join('\n'),
        },
        {
          id: 'profil', type: 'capture', title: `Capture — profil de « ${alias} » sur HeartLink`, date: profilT, author: `${victimName} (remise lors de la plainte)`,
          body:
            `${alias}, 41 ans — Singapour · Trader indépendant\n` +
            `Badge : 💎 Membre Premium\n` +
            `« Passionné de voile et de marchés financiers. Je cherche une relation sincère, pas un jeu. »\n` +
            `(Capture réalisée par la plaignante le ${fmtDate(profilT)} ; le profil n'est plus accessible depuis.)`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : Tron, USDT et gas', date: atHour(w.at(8 * 24), 14), author: 'Cellule d\'appui',
          body:
            `• Sur Tron, chaque transfert d'USDT (TRC-20) consomme de l'énergie et de la bande passante, payées en TRX par l'adresse émettrice. Une adresse qui ne détient que des USDT doit donc d'abord recevoir des TRX.\n` +
            `• Les réseaux d'escroquerie alimentent souvent toutes leurs adresses depuis un même portefeuille de TRX : il relie des adresses qui n'échangent jamais d'USDT entre elles, et son propre approvisionnement est un pivot d'identification.\n` +
            `• Les « retraits » accordés aux victimes en début d'escroquerie sont payés avec l'argent des autres victimes : les retrouver on-chain démontre le caractère frauduleux de la plateforme.\n` +
            `• L'émetteur de l'USDT peut bloquer une adresse sur demande motivée des autorités ; les plateformes centralisées se requièrent sur l'adresse de dépôt du client, pas sur leur hot wallet.`,
        },
      ],
      seeds: [plaignante.addr],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Identifiez le portefeuille collecteur du réseau.',
          answer: [collector],
          hint: 'Suivez les USDT reçus par l\'adresse de dépôt AuroraTrade : où repartent-ils ?',
          explanation: `Chaque victime reçoit une adresse de dépôt « personnelle », mais toutes remontent vers ${A(w, collector)}, généralement dans les trois heures. C'est la signature typique des fausses plateformes d'investissement : l'adresse de dépôt donne l'illusion d'un compte, le collecteur reçoit tout.`,
        },
        {
          id: 'o13', type: 'address', points: 9,
          prompt: 'Quelle adresse a versé à la plaignante ses « gains » retirés ?',
          answer: [payout],
          hint: 'Parmi les entrées d\'USDT de la plaignante, écartez les retraits du hot wallet Coinhouse : il reste une autre adresse. Regardez ensuite qui l\'alimente.',
          explanation: `Les « retraits » arrivent de ${A(w, payout)}, et non d'une plateforme régulée. Cette adresse est alimentée par le collecteur (${refills.length} versement${refills.length > 1 ? 's' : ''}, ${amt(refillTotal, 'USDT')}) et paie de petites sommes à ${nRetraitVictims} victime${nRetraitVictims > 1 ? 's' : ''} : les gains sont versés avec l'argent des victimes elles-mêmes. C'est la preuve on-chain que la plateforme ne fait aucun trading. Les entrées venant du hot wallet Coinhouse sont, elles, les achats d'USDT de la plaignante.`,
        },
        {
          id: 'o12', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT la plaignante a-t-elle reçus au titre de ces faux retraits ?',
          answer: retraitP,
          hint: 'Additionnez les entrées d\'USDT de la plaignante venant de l\'adresse des retraits (pas celles du hot wallet Coinhouse).',
          explanation: `${retraitsP.length > 1 ? `${retraitsP.map((p) => amt(p.value, 'USDT')).join(' + ')} = ${amt(retraitP, 'USDT')},` : `${amt(retraitP, 'USDT')} en un seul retrait,`} ${retDelayTxt} après un versement, avant le suivant. La plaignante renvoie ces fonds sur Coinhouse, où ils sont bien crédités : le piège fonctionne. Préjudice net de la plaignante : ${amt(plaignante.total + unlockFee, 'USDT')} versés (taxe comprise) moins ${amt(retraitP, 'USDT')} rendus, soit ${amt(netLoss, 'USDT')}.`,
        },
        {
          id: 'o6', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant la plaignante a-t-elle versé au titre de la « taxe de déblocage » ?',
          answer: unlockFee,
          hint: 'La plainte donne la date du paiement : cherchez, parmi les sorties de la plaignante vers son adresse de dépôt, le versement de ce jour-là (c\'est le dernier).',
          explanation: `Le ${fmtDate(feeT)}, la plaignante envoie ${amt(unlockFee, 'USDT')} sur la même adresse de dépôt AuroraTrade, remontés vers le collecteur comme les versements précédents. Les « frais de déblocage » sont un classique du pig butchering : ils n'ouvrent aucun retrait, ils servent à extraire un dernier versement. À ne pas confondre avec ses envois vers Coinhouse, qui sont le renvoi de ses faux gains.`,
        },
        {
          id: 'o2', type: 'number', points: 9,
          prompt: 'Combien de victimes distinctes (adresses sources) alimentent le réseau via les adresses de dépôt ?',
          answer: nVictims,
          hint: 'Dépliez les entrées du collecteur, puis les entrées de chaque adresse de dépôt. Le portefeuille des faux retraits n\'est pas une adresse de dépôt.',
          explanation: `${nVictims} victimes : chaque adresse de dépôt AuroraTrade reçoit les versements d'une seule victime, achetés sur Coinhouse. ${nRetraitVictims > 1 ? `${nRetraitVictims} d'entre elles ont` : 'Seule la plaignante a'} aussi reçu un faux retrait. Les autres victimes peuvent être identifiées par réquisition à Coinhouse (titulaires des retraits qui alimentent les adresses sources).`,
        },
        {
          id: 'o3', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.03,
          prompt: 'Montant total d\'USDT collecté auprès des victimes (taxe de déblocage comprise) ?',
          answer: grand,
          hint: 'Additionnez les USDT reçus par le collecteur depuis les adresses de dépôt AuroraTrade (pas les TRX).',
          explanation: `${amt(grand, 'USDT')} au total, dont ${amt(unlockFee, 'USDT')} de « taxe de déblocage » versée par la plaignante. Les faux retraits (payés depuis le collecteur) ne se déduisent pas de ce montant : ils sont une dépense du réseau.`,
        },
        {
          id: 'o7', type: 'address', points: 8,
          prompt: 'Quelle adresse fournit les TRX (gas) des adresses de dépôt, du collecteur et du portefeuille des retraits ?',
          answer: [gasWallet],
          hint: 'Une adresse de dépôt AuroraTrade ne peut pas transférer d\'USDT sans TRX : regardez ses tout premiers flux entrants, colonne Actif = TRX.',
          explanation: `${A(w, gasWallet)} envoie 60 TRX à chaque adresse de dépôt AuroraTrade avant le premier versement de la victime, 600 TRX au collecteur et 300 TRX au portefeuille des retraits. Ce « financeur de gas » relie toutes les adresses du réseau, même celles qui n'échangent jamais d'USDT entre elles : c'est la preuve on-chain d'une infrastructure commune.`,
        },
        {
          id: 'o8', type: 'entity', points: 8,
          prompt: 'Quelle plateforme a approvisionné en TRX le portefeuille de gas du réseau ?',
          answer: [gasSrcKey],
          hint: 'Remontez le plus ancien flux entrant du financeur de gas : il provient d\'un hot wallet étiqueté.',
          explanation: `Le ${fmtDate(gasFundTx.time, false)}, ${gasSrcName} verse 25 000 TRX au financeur de gas depuis son hot wallet. Ce retrait est rattaché à un compte client : une réquisition sur ce hash (${gasFundTx.hash.slice(0, 16)}…) peut désigner un opérateur du réseau, indépendamment des fonds des victimes. ${procedureFor(gasSrc.entity)}`,
        },
        {
          id: 'o15', type: 'entity', points: 9,
          prompt: 'Le collecteur paie un service à intervalles réguliers. Lequel peut aider à identifier le compte utilisé pour approcher les victimes ?',
          answer: [datingE.id],
          hint: `Parmi les petites sorties du collecteur, cherchez des montants identiques espacés d\'environ une semaine, vers une adresse étiquetée. Rapprochez-les du profil de « ${alias} ».`,
          explanation: `Le collecteur verse ${nSubs} fois ${amt(subPrice, 'USDT')} (${amt(subTotal, 'USDT')}), à une semaine d'intervalle, à HeartLink, l'application de rencontre où la plaignante a connu « ${alias} », dont le profil affichait le badge « Premium ». Cet abonnement hebdomadaire est rattaché à un ou plusieurs comptes : la réquisition (hash des paiements, dates) peut livrer profils, adresses électroniques, numéros et journaux de connexion. C'est une erreur de sécurité opérationnelle typique : payer ses outils avec le portefeuille du produit de l'escroquerie. ${procedureFor(datingE)}`,
        },
        {
          id: 'o4', type: 'entity', points: 8,
          prompt: 'Quelle plateforme a reçu la plus grosse part des fonds ?',
          answer: [kzKey],
          hint: 'Dépliez les sorties d\'USDT du collecteur et comparez les montants par destinataire. Les petites branches vers des adresses sans étiquette ne sont pas des plateformes.',
          explanation: `${kzName} reçoit ${amt(kzShare, 'USDT')}, Huobex ${amt(hxShare, 'USDT')} et SatsDesk OTC ${amt(otcShare, 'USDT')}. Les ${branches.length} branches vers des adresses sans étiquette (${amt(branchTotal, 'USDT')} au total) sont de petits montants qui ne mènent à aucune plateforme. ${procedureFor(kz.entity)}`,
        },
        {
          id: 'o9', type: 'address', points: 8,
          prompt: 'Quelle adresse de dépôt faut-il citer dans la réquisition adressée à cette plateforme principale de sortie ?',
          answer: [kzRes.deposit],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse qui reçoit les USDT du collecteur avant d\'être balayée.',
          explanation: `Le ${fmtDate(kzRes.tx.time)}, le collecteur envoie ${amt(kzShare, 'USDT')} sur ${A(w, kzRes.deposit)}, adresse de dépôt propre à un client de ${kzName}, balayée ensuite vers le hot wallet. C'est elle qui désigne le titulaire du compte ; le hot wallet mélange tous les clients et ne désigne personne.`,
        },
        {
          id: 'o10', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT restent sur le collecteur ?',
          answer: remaining,
          hint: 'Faites la différence entre les USDT reçus et envoyés par le collecteur (son solde actuel).',
          explanation:
            `Il reste ${amt(remaining, 'USDT')} sur ${A(w, collector)} : ${amt(grand, 'USDT')} reçus des adresses de dépôt, moins ${amt(kzShare, 'USDT')} (${kzName}), ${amt(hxShare, 'USDT')} (Huobex), ${amt(otcShare, 'USDT')} (SatsDesk OTC), ${amt(refillTotal, 'USDT')} (alimentation des faux retraits), ${amt(branchTotal, 'USDT')} (branches : ${branches.map((b) => `${trunc(A(w, b.address))} ${FATE[b.fate]}`).join(' ; ')}) et ${amt(subTotal, 'USDT')} (abonnements HeartLink). ` +
            `Ces fonds sont sur une adresse auto-hébergée, mais en USDT : ils peuvent être bloqués par l'émetteur.`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Le collecteur détient encore des USDT. Quelle action prioritaire ?',
          hint: 'Qui, dans l\'écosystème de l\'USDT, a techniquement la main sur une adresse auto-hébergée ?',
          ...choice(r,
            'Demander en urgence le gel de l\'adresse à l\'émetteur de l\'USDT, puis requérir les plateformes de sortie',
            [
              'Demander à Coinhouse la clé privée du collecteur pour saisir immédiatement les USDT',
              'Attendre la fin des investigations pour ne pas alerter le réseau avant les interpellations',
              'Requérir SatsDesk OTC pour qu\'il bloque le collecteur, puisqu\'il en a reçu des fonds',
            ]),
          explanation: 'L\'USDT est un jeton centralisé : son émetteur peut bloquer (blacklister) une adresse, souvent en quelques heures sur demande motivée des autorités. C\'est fréquemment la seule manière de préserver des fonds avant leur dispersion ; la saisie pénale proprement dite suit, selon le cadre procédural applicable. On requiert ensuite les plateformes de sortie. Coinhouse n\'a aucune prise sur une adresse auto-hébergée, et un courtier OTC n\'a la main que sur les fonds qu\'il a reçus (et relève ici d\'une entraide internationale aux délais longs).',
        },
      ],
      truth: {
        path: [...victims.flatMap((v) => v.txs), kzRes.tx.id, ...(kzRes.sweep ? [kzRes.sweep.id] : []), hxRes.tx.id, ...(hxRes.sweep ? [hxRes.sweep.id] : []), otcTx.id, gasFundTx.id],
        addresses: [collector, payout, gasWallet, ...victims.map((v) => v.deposit), kzRes.deposit, hxRes.deposit],
        debrief:
          `Le réseau a ouvert une adresse de dépôt par victime (${nVictims} victimes), toutes vidées vers le collecteur ${A(w, collector)}. La plaignante a versé ${amt(plaignante.total, 'USDT')} en ${plaignante.nPay} fois, en montants croissants, puis ${amt(unlockFee, 'USDT')} de « taxe de déblocage » le ${fmtDate(feeT, false)}.\n\n` +
          `Faux retraits : le collecteur alimente ${A(w, payout)}, qui verse de petites sommes à ${nRetraitVictims > 1 ? `${nRetraitVictims} victimes` : 'la seule plaignante'} ${Math.min(...allDelays)} à ${Math.max(...allDelays)} heures après l'un de leurs versements (${amt(retraitP, 'USDT')} pour la plaignante, renvoyés par elle sur Coinhouse). Ces « gains » payés avec l'argent des victimes installent la confiance et démontrent l'absence de toute activité de trading. Préjudice net de la plaignante : ${amt(netLoss, 'USDT')}.\n\n` +
          `Total collecté : ${amt(grand, 'USDT')}. Décaissements : ${amt(kzShare, 'USDT')} vers ${kzName} (adresse de dépôt ${A(w, kzRes.deposit)}), ${amt(hxShare, 'USDT')} vers Huobex, puis, en dernier, ${amt(otcShare, 'USDT')} vers le courtier SatsDesk OTC (Hong Kong), sortie probable en espèces. ${branches.length} petites branches (${amt(branchTotal, 'USDT')}) ne mènent nulle part. Il reste ${amt(remaining, 'USDT')} sur le collecteur, gelables par l'émetteur de l'USDT.\n\n` +
          `Infrastructure : les adresses du réseau reçoivent leurs TRX d'un même portefeuille ${A(w, gasWallet)}, approvisionné par un retrait ${gasSrcName}. Le collecteur paie aussi l'abonnement hebdomadaire « Premium » de HeartLink (${nSubs} × ${amt(subPrice, 'USDT')}) : la piste la plus directe vers le compte de « ${alias} ».\n\n` +
          `Réquisitions : ${kzName} et Huobex (titulaires des dépôts), ${gasSrcName} (titulaire du compte qui a financé le gas), HeartLink (comptes Premium payés depuis le collecteur), Coinhouse (identification des autres victimes, dont les retraits alimentent les adresses sources) ; entraide vers Hong Kong pour SatsDesk OTC.`,
      },
      hints: [
        'Sur Tron, les transferts d\'USDT (TRC-20) et de TRX apparaissent séparément : regardez la colonne Actif.',
        'Les entrées d\'USDT de la plaignante ont deux origines : ses achats sur Coinhouse et une adresse sans étiquette. Qui alimente cette dernière ?',
        'Le collecteur reçoit de plusieurs adresses de dépôt, chacune alimentée par une seule victime.',
        'Sur les sorties du collecteur, distinguez les grosses sommes vers des plateformes, les petites branches sans étiquette et les paiements réguliers vers un service connu.',
      ],
    }
  },
}
