import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Fausse plateforme de rendement (YieldNova, fictive) sur Tron : les
// investisseurs déposent des USDT sur une adresse unique ; un portefeuille de
// paiement verse des « rendements » aux plus anciens avec l'argent des
// nouveaux, les parrains touchent des commissions, les organisateurs
// prélèvent régulièrement puis vident tout à la fermeture.

const usdt = (v: number) => roundAsset('USDT', v)
const usd0 = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} USDT`
const pct = (v: number) => `${v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`

interface Inv {
  addr: string
  deposits: { t: number; v: number; tx?: Tx }[]
  leader: number
  principal: number
  first: number
  lastPaid: number
  paid: number
}

type Ev = { t: number; kind: 'dep'; inv: Inv; i: number } | { t: number; kind: 'pay' | 'com' | 'skim' }

export const ponziMlm: ScenarioTemplate = {
  id: 'ponzi-mlm',
  title: 'YieldNova : anatomie d\'un Ponzi en USDT',
  tagline: 'Des « rendements » payés par les nouveaux entrants, des parrains commissionnés, puis la fermeture.',
  description:
    'Une plateforme promet 1 à 2 % de rendement par jour sur des dépôts en USDT, avec des commissions de parrainage. Les retraits fonctionnent… jusqu\'au jour où le site ferme. Identifiez l\'adresse de collecte et le portefeuille de paiement, comptez les investisseurs, mesurez la part des dépôts reversée en faux rendements et localisez la sortie des organisateurs.',
  difficulty: 3,
  chains: ['tron'],
  skills: ['tron', 'tokens', 'typologies', 'exchange_id', 'requisition', 'osint'],
  estMinutes: 35,
  lessons: ['ponzi-mlm', 'tron-usdt', 'typologies', 'exposition-risque', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const victimP = fakePerson(r)
    const g = victimP.g
    const dailyPct = r.pick([1.2, 1.5, 1.8, 2])
    const refPct = r.pick([7, 8, 10])
    const D = r.int(36, 48)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const nova = w.entity('yieldnova')
    const destKey = r.pick(['okx', 'binance', 'huobex'] as const)
    const otc = exchange(w, 'satsdesk', 'tron')
    const kits = new Map<string, ExchangeKit>()
    const ex = (k: string) => {
      let x = kits.get(k)
      if (!x) kits.set(k, (x = exchange(w, k, 'tron')))
      return x
    }
    const dest = ex(destKey)
    const ramps = ['binance', 'okx'].map(ex)

    const collector = w.addr('tron', { entity: nova })
    const payer = w.addr('tron', { entity: nova })
    const orgE = w.customEntity({ name: 'Organisateurs YieldNova (inconnus)', category: 'suspect' })
    const org = w.addr('tron', { entity: orgE })

    const t0 = w.at(0)
    const tHalt = t0 + D * DAY + Math.round(r.float(8, 20) * HOUR)

    // ── Investisseurs ────────────────────────────────────────────────────────
    const nLeaders = r.int(2, 3)
    const N = r.int(22, 30)
    const invs: Inv[] = []
    for (let i = 0; i < N; i++) {
      const isLeader = i < nLeaders
      const day = isLeader ? r.float(0, 3) : D * Math.pow(r.float(0.04, 0.97), 0.7)
      const first = t0 + Math.round(day * DAY + r.float(8, 22) * HOUR - 8 * HOUR)
      const v1 = usdt(r.int(isLeader ? 12 : 4, isLeader ? 35 : 120) * 100)
      const deposits = [{ t: first, v: v1 }]
      if (r.chance(isLeader ? 0.9 : 0.35)) {
        const t2 = first + Math.round(r.float(3, 12) * DAY)
        if (t2 < tHalt - 6 * HOUR) deposits.push({ t: t2, v: usdt(r.int(3, isLeader ? 25 : 80) * 100) })
      }
      invs.push({ addr: w.addr('tron'), deposits, leader: isLeader ? i : r.int(0, nLeaders - 1), principal: 0, first, lastPaid: first, paid: 0 })
    }
    // Le plaignant : entré tard, deux dépôts dont un juste avant la fermeture
    const victim = invs[nLeaders]
    victim.first = tHalt - Math.round(r.float(11, 15) * DAY)
    victim.lastPaid = victim.first
    victim.deposits = [{ t: victim.first, v: usdt(r.int(15, 50) * 100) }, { t: tHalt - Math.round(r.float(1.2, 2.8) * DAY), v: usdt(r.int(20, 90) * 100) }]
    w.setEntity(victim.addr, w.customEntity({ name: victimP.name, category: 'victim' }))
    const leaderNames = Array.from({ length: nLeaders }, () => fakeHandle(r))

    // Achat des USDT par les investisseurs (exchanges ou adresses tierces)
    for (const inv of invs) {
      const need = inv.deposits.reduce((s, d) => s + d.v, 0)
      const tf = inv.first - Math.round(r.float(2, 72) * HOUR)
      if (r.chance(0.7) || inv === victim) r.pick(ramps).withdraw(inv.addr, usdt(need + r.int(0, 20) * 5), tf, 'USDT')
      else w.fundAccount(inv.addr, usdt(need + r.int(1, 20) * 5), 'USDT', tf)
    }

    // ── Calendrier des événements ──────────────────────────────────────────
    const evs: Ev[] = []
    invs.forEach((inv) => inv.deposits.forEach((d, i) => evs.push({ t: d.t, kind: 'dep', inv, i })))
    const lastPayDay = D - r.int(4, 6)
    for (let d = 5; d <= lastPayDay; d += r.int(2, 3)) evs.push({ t: t0 + d * DAY + Math.round(r.float(10, 20) * HOUR), kind: 'pay' })
    for (let d = 3; d <= D - 2; d += r.int(3, 4)) evs.push({ t: t0 + d * DAY + Math.round(r.float(6, 23) * HOUR), kind: 'com' })
    for (let d = r.int(6, 9); d <= D - 3; d += r.int(6, 9)) evs.push({ t: t0 + d * DAY + Math.round(r.float(1, 6) * HOUR), kind: 'skim' })
    evs.sort((a, b) => a.t - b.t)

    const depTxs: Tx[] = []
    const topups: Tx[] = []
    const payouts: Tx[] = []
    const comTxs: Tx[] = []
    const skimTxs: Tx[] = []
    const pendingCom = new Array(nLeaders).fill(0)
    let totalDeposited = 0
    let returnsPaid = 0
    let commissions = 0
    for (const ev of evs) {
      if (ev.kind === 'dep') {
        const d = ev.inv.deposits[ev.i]
        d.tx = w.transfer({ time: ev.t, from: ev.inv.addr, to: collector, value: d.v, asset: 'USDT' })
        depTxs.push(d.tx)
        ev.inv.principal += d.v
        totalDeposited += d.v
        if (!invs.slice(0, nLeaders).includes(ev.inv)) pendingCom[ev.inv.leader] += (d.v * refPct) / 100
        continue
      }
      const bal = w.balanceOf(collector, 'USDT')
      if (ev.kind === 'pay') {
        const due: { inv: Inv; v: number }[] = []
        for (const inv of invs) {
          if (inv.principal <= 0 || ev.t - inv.first < 3 * DAY || !r.chance(0.72)) continue
          const accrued = (inv.principal * dailyPct) / 100 * ((ev.t - inv.lastPaid) / DAY) * r.float(0.75, 1)
          const v = Math.round(accrued / 10) * 10
          if (v >= 50) due.push({ inv, v })
        }
        let sum = due.reduce((s, x) => s + x.v, 0)
        if (!sum) continue
        const scale = Math.min(1, (bal * 0.6) / sum)
        if (scale < 1) {
          for (const x of due) x.v = Math.max(50, Math.floor((x.v * scale) / 10) * 10)
          sum = due.reduce((s, x) => s + x.v, 0)
          if (sum > bal * 0.8) continue
        }
        topups.push(w.transfer({ time: ev.t, from: collector, to: payer, value: usdt(sum), asset: 'USDT' }))
        for (const x of due) {
          payouts.push(w.transfer({ time: ev.t + r.int(5, 240) * 60, from: payer, to: x.inv.addr, value: usdt(x.v), asset: 'USDT' }))
          x.inv.lastPaid = ev.t
          x.inv.paid += x.v
          returnsPaid += x.v
        }
      } else if (ev.kind === 'com') {
        for (let k = 0; k < nLeaders; k++) {
          const v = usdt(Math.floor(pendingCom[k]))
          if (v < 20 || v > w.balanceOf(collector, 'USDT') * 0.5) continue
          comTxs.push(w.transfer({ time: ev.t + k * r.int(60, 900), from: collector, to: invs[k].addr, value: v, asset: 'USDT' }))
          commissions += v
          pendingCom[k] = 0
        }
      } else {
        const v = usdt(Math.floor(bal * r.float(0.08, 0.14)))
        if (v >= 100) skimTxs.push(w.transfer({ time: ev.t, from: collector, to: org, value: v, asset: 'USDT' }))
      }
    }

    // ── Fermeture : le collecteur est vidé vers les organisateurs ───────────
    const rest = usdt(w.balanceOf(collector, 'USDT'))
    const exit1v = usdt(Math.floor(rest * r.float(0.5, 0.62)))
    const exit1 = w.transfer({ time: tHalt, from: collector, to: org, value: exit1v, asset: 'USDT' })
    const exit2 = w.transfer({ time: tHalt + r.int(20, 90) * 60, from: collector, to: org, value: usdt(rest - exit1v), asset: 'USDT' })
    const orgTotal = usdt(w.balanceOf(org, 'USDT'))

    // ── Sortie : OTC (majoritaire) et exchange ──────────────────────────────
    const otcShare = r.float(0.6, 0.74)
    const otcV = usdt(Math.floor(orgTotal * otcShare))
    const otcA = usdt(Math.floor(otcV * r.float(0.45, 0.6)))
    const otcDep = otc.newDeposit()
    const tOut = tHalt + Math.round(r.float(4, 14) * HOUR)
    const o1 = otc.receive(org, otcA, tOut, { asset: 'USDT', depositAddr: otcDep, sweepDelayH: r.float(0.5, 3) })
    const o2 = otc.receive(org, usdt(otcV - otcA), tOut + Math.round(r.float(6, 20) * HOUR), { asset: 'USDT', depositAddr: otcDep, sweepDelayH: r.float(0.5, 3) })
    const exV = usdt(Math.floor(orgTotal - otcV - r.float(20, 200)))
    const e1 = dest.receive(org, exV, tOut + Math.round(r.float(2, 9) * HOUR), { asset: 'USDT' })

    // ── Bruit ────────────────────────────────────────────────────────────────
    otc.noise(10, t0, tHalt + 4 * DAY, 'USDT')
    dest.noise(14, t0, tHalt + 4 * DAY, 'USDT')
    for (const k of ramps) k.noise(8, t0 - 5 * DAY, tHalt, 'USDT')

    // ── Synthèse ─────────────────────────────────────────────────────────────
    const share = Math.round((returnsPaid / totalDeposited) * 1000) / 10
    const comShare = Math.round((commissions / totalDeposited) * 1000) / 10
    const orgShare = Math.round((orgTotal / totalDeposited) * 1000) / 10
    const winners = invs.filter((i) => i.paid > i.deposits.reduce((s, d) => s + d.v, 0)).length
    const leaderGain = invs.slice(0, nLeaders).map((l) => {
      const c = comTxs.filter((t) => t.transfers[0].to === l.addr).reduce((s, t) => s + t.transfers[0].value, 0)
      return l.paid + c - l.deposits.reduce((s, d) => s + d.v, 0)
    })
    const victimLoss = victim.deposits.reduce((s, d) => s + d.v, 0) - victim.paid
    const leaderAddrs = invs.slice(0, nLeaders).map((l) => l.addr)
    const proof = [...payouts].filter((p) => leaderAddrs.includes(p.transfers[0].to)).sort((a, b) => b.transfers[0].value - a.transfers[0].value)[0] ?? payouts[0]
    const proofHandle = leaderNames[Math.max(0, leaderAddrs.indexOf(proof.transfers[0].to))]
    const nPayCycles = topups.length

    return {
      world: w,
      title: `YieldNova — ${city}`,
      briefing:
        `${victimP.name}, demeurant à ${city}, dépose plainte contre la plateforme « YieldNova », qui promettait ${pct(dailyPct)} de rendement par jour sur des dépôts en USDT (réseau Tron) et ${refPct} % de commission sur les dépôts des filleuls. ${g('Il', 'Elle')} y a été ${g('introduit', 'introduite')} par un « leader » actif sur Telegram. Après quelques semaines, les retraits ont été suspendus « pour maintenance », puis le site a fermé.\n\n` +
        `Plusieurs autres plaintes sont attendues. Le parquet souhaite une première analyse des flux : qui collectait, combien d'investisseurs, combien a été déposé, quelle part a réellement été reversée, et où sont partis les fonds.\n\n` +
        `Rappel : un rendement promis ne peut être payé que par une activité réelle. Si les « intérêts » ne proviennent que des dépôts des nouveaux entrants, la plateforme est structurellement condamnée à s'effondrer.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: tHalt + 3 * DAY, author: victimP.name,
          body:
            `« J'ai découvert YieldNova par le groupe Telegram de @${leaderNames[victim.leader]}, qui montrait ses retraits chaque semaine. J'ai acheté des USDT sur un exchange et je les ai envoyés à l'adresse de la plateforme indiquée sur mon tableau de bord.\n\n` +
            `Mon adresse Tron : ${A(w, victim.addr)}\n` +
            `Premier dépôt (${amt(victim.deposits[0].v, 'USDT')}) le ${fmtDate(victim.deposits[0].t, false)} : ${victim.deposits[0].tx!.hash}\n` +
            `Second dépôt (${amt(victim.deposits[1].v, 'USDT')}) le ${fmtDate(victim.deposits[1].t, false)}.\n\n` +
            `${victim.paid > 0 ? `J'ai reçu ${amt(victim.paid, 'USDT')} de « rendements » au début, ce qui m'a mis en confiance.` : 'Je n\'ai jamais rien pu retirer : à chaque demande, le site affichait « retrait en cours de traitement ».'} Le ${fmtDate(tHalt, false)}, le site a disparu. »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture du tableau de bord YieldNova (fournie par la victime)', date: victim.deposits[1].t - DAY,
          body:
            `YIELDNOVA — Smart Yield Protocol\n` +
            `Plan « Nova » : ${pct(dailyPct)} / jour · capital restitué à 60 jours\n` +
            `Parrainage : ${refPct} % sur chaque dépôt de vos filleuls\n\n` +
            `Dépôt : envoyez vos USDT (TRC-20) à l'adresse de la plateforme\n${A(w, collector)}\n\n` +
            `Votre solde : ${amt(usdt(victim.deposits[0].v * (1 + (dailyPct / 100) * 9)), 'USDT')} · Retrait minimum : 50 USDT`,
        },
        {
          id: 'telegram', type: 'telegram', title: `Groupe Telegram « Nova Family » (message de @${proofHandle})`, author: `@${proofHandle}`, date: proof.time + 3 * HOUR,
          body:
            `💰 Encore un retrait reçu aujourd'hui, ${amt(proof.transfers[0].value, 'USDT')} direct sur mon wallet ! 💰\n` +
            `Preuve on-chain pour les sceptiques 👉 ${proof.hash}\n` +
            `YieldNova paie TOUJOURS. Ceux qui hésitent regardent les autres s'enrichir 🚀\n` +
            `Mon lien de parrainage en message privé, bonus ${refPct} % pour moi, accompagnement offert pour vous 🤝`,
        },
        {
          id: 'osint', type: 'osint', title: 'Note OSINT sur la plateforme', date: tHalt + 4 * DAY, author: 'Cellule cyber',
          body:
            `Le nom de domaine a été enregistré ${r.int(3, 6)} semaines avant les premiers dépôts, derrière un service d'anonymisation. Le « livre blanc » est copié d'un projet DeFi existant ; l'équipe affichée utilise des photos de banques d'images.\n` +
            `La plateforme ne dispose d'aucun enregistrement ni agrément de PSAN/CASP en France ; un site au nom proche figure sur une liste noire de l'AMF.\n` +
            `Les « leaders » @${leaderNames.join(', @')} animaient des groupes Telegram de plusieurs centaines de membres et des sessions vidéo de « formation ».`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : signature d\'un Ponzi', date: tHalt + 4 * DAY, author: 'Cellule d\'appui',
          body:
            `• Une plateforme de rendement réelle place les fonds (prêt, staking, liquidité) : on voit des flux vers des protocoles et des revenus qui en reviennent. Un Ponzi n'a aucune source extérieure : tout ce qui sort provient des dépôts.\n` +
            `• Le portefeuille qui paie les « rendements » est souvent distinct de l'adresse de dépôt et réalimenté juste avant chaque vague de paiements.\n` +
            `• Pour qualifier le schéma, mesurez : le nombre de déposants, le total déposé, la part reversée en rendements, la part en commissions de parrainage et la part captée par les organisateurs.\n` +
            `• Les premiers entrants et les parrains peuvent ressortir gagnants : ils ont été payés avec l'argent des suivants. Cela n'en fait pas des complices, mais leurs gains pourront être discutés.`,
        },
      ],
      seeds: [victim.addr],
      objectives: [
        {
          id: 'o1', type: 'address', points: 15,
          prompt: 'Quelle est l\'adresse de collecte de la plateforme, qui reçoit les dépôts des investisseurs ?',
          answer: [collector],
          hint: 'Le dépôt cité dans la plainte et la capture du tableau de bord désignent la même adresse.',
          explanation: `${A(w, collector)} reçoit ${depTxs.length} dépôts en USDT. Elle n'est attribuée à aucun service connu : la plateforme n'existe dans aucune base d'attribution, ce qui est courant pour une escroquerie récente.`,
        },
        {
          id: 'o2', type: 'number', points: 10, unit: 'investisseurs', tolerance: 2,
          prompt: 'Combien d\'investisseurs distincts (adresses déposantes) ont alimenté la plateforme ?',
          answer: N,
          hint: 'Dépliez les entrées de l\'adresse de collecte : certaines adresses ont déposé deux fois, ne les comptez qu\'une fois.',
          explanation: `${N} adresses distinctes ont déposé (${depTxs.length} dépôts au total), parmi lesquelles ${nLeaders} « leaders », entrés dès les premiers jours, qui touchent aussi les commissions de parrainage.`,
        },
        {
          id: 'o3', type: 'amount', points: 15, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDT a été déposé sur la plateforme ?',
          answer: usdt(totalDeposited),
          hint: 'L\'adresse de collecte ne reçoit que des dépôts d\'investisseurs : son total reçu répond à la question.',
          explanation: `${usd0(totalDeposited)} déposés entre le ${fmtDate(depTxs[0].time, false)} et le ${fmtDate(depTxs[depTxs.length - 1].time, false)}, avec une accélération sur les dernières semaines, typique d'un recrutement par parrainage.`,
        },
        {
          id: 'o4', type: 'address', points: 10,
          prompt: 'Quelle adresse verse les « rendements » aux investisseurs ?',
          answer: [payer],
          hint: 'La « preuve de retrait » publiée sur Telegram est une transaction : son émetteur est le portefeuille de paiement.',
          explanation: `${A(w, payer)} est réalimentée ${nPayCycles} fois par l'adresse de collecte, à chaque fois juste avant une vague de paiements, pour exactement le montant versé dans la foulée. Elle n'a aucune autre source de revenus.`,
        },
        {
          id: 'o5', type: 'number', points: 20, unit: '%', tolerance: 1.5,
          prompt: 'Quelle part des dépôts (en %) a été reversée aux investisseurs sous forme de « rendements » ?',
          answer: share,
          hint: 'Comparez le total envoyé par le portefeuille de paiement au total reçu par l\'adresse de collecte.',
          explanation: `Le portefeuille de paiement a versé ${usd0(returnsPaid)} de « rendements », soit ${pct(share)} des ${usd0(totalDeposited)} déposés. S'y ajoutent ${usd0(commissions)} de commissions de parrainage payées directement par l'adresse de collecte aux leaders (${pct(comShare)}). Les organisateurs captent le reste : ${usd0(orgTotal)} (${pct(orgShare)}), par prélèvements réguliers puis en vidant l'adresse à la fermeture.`,
        },
        {
          id: 'o6', type: 'entity', points: 15,
          prompt: 'Vers quel prestataire part la plus grande partie des fonds extraits par les organisateurs ?',
          answer: ['satsdesk'],
          hint: 'Suivez les prélèvements et la vidange finale de l\'adresse de collecte jusqu\'au portefeuille des organisateurs, puis ses sorties.',
          explanation: `Le portefeuille des organisateurs ${A(w, org)} envoie ${usd0(otcV)} (${Math.round(otcShare * 100)} %) sur une adresse de dépôt de SatsDesk OTC, courtier de gré à gré, et ${usd0(exV)} sur ${dest.entity.name}. ${procedureFor(otc.entity)} ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o7', type: 'choice', points: 15,
          prompt: 'Comment qualifier le fonctionnement de YieldNova au vu des flux ?',
          ...choice(r,
            'Un schéma de Ponzi : les rendements ne sont financés que par les dépôts de nouveaux investisseurs, sans source extérieure',
            [
              'Une plateforme de rendement réelle mais mal gérée : ses placements DeFi ont perdu de la valeur et ont provoqué sa faillite',
              'Un simple réseau de vente multiniveau légal : les commissions de parrainage suffisent à expliquer tous les flux sortants',
              'Une escroquerie au faux support technique : les victimes ont transféré leurs fonds en croyant sécuriser leur compte',
            ]),
          explanation: `Aucun flux ne part vers un protocole de placement et aucun revenu n'en revient : chaque paiement est précédé d'un réapprovisionnement depuis l'adresse de collecte, alimentée uniquement par les dépôts. ${winners ? `${winners} investisseur${winners > 1 ? 's ressortent gagnants' : ' ressort gagnant'}, payé${winners > 1 ? 's' : ''} avec l'argent des suivants` : 'Aucun investisseur ordinaire ne récupère sa mise'} ; les leaders cumulent rendements et commissions (solde net de chacun : ${leaderGain.map((v) => `${v >= 0 ? '+' : ''}${usd0(v)}`).join(', ')}). Pénalement, de tels faits peuvent notamment relever de l'escroquerie en bande organisée, des pratiques commerciales trompeuses ou de la vente « à la boule de neige » prohibée par le Code de la consommation, et du blanchiment pour la sortie des fonds ; la qualification revient au parquet.`,
        },
      ],
      truth: {
        path: [victim.deposits[0].tx!.id, victim.deposits[1].tx!.id, ...depTxs.filter((t) => t.transfers[0].from !== victim.addr).map((t) => t.id), ...topups.map((t) => t.id), ...payouts.map((t) => t.id), ...comTxs.map((t) => t.id), ...skimTxs.map((t) => t.id), exit1.id, exit2.id, o1.tx.id, o2.tx.id, e1.tx.id],
        addresses: [collector, payer, org, otcDep, e1.deposit],
        debrief:
          `1. Du ${fmtDate(depTxs[0].time, false)} au ${fmtDate(depTxs[depTxs.length - 1].time, false)}, ${N} investisseurs déposent ${usd0(totalDeposited)} sur ${A(w, collector)}.\n` +
          `2. À ${nPayCycles} reprises, l'adresse de collecte réalimente le portefeuille de paiement ${A(w, payer)}, qui verse aussitôt des « rendements » : ${usd0(returnsPaid)} au total (${pct(share)} des dépôts). Les paiements cessent ${D - lastPayDay} jours avant la fermeture (« maintenance »).\n` +
          `3. Les ${nLeaders} leaders reçoivent ${usd0(commissions)} de commissions de parrainage (${pct(comShare)}).\n` +
          `4. Les organisateurs prélèvent régulièrement, puis vident l'adresse de collecte le ${fmtDate(tHalt, false)} : ${usd0(orgTotal)} (${pct(orgShare)}) sur ${A(w, org)}, dont ${usd0(otcV)} vers SatsDesk OTC et ${usd0(exV)} vers ${dest.entity.name}.\n` +
          `5. ${victimP.name} perd ${usd0(victimLoss)}${victim.paid > 0 ? `, déduction faite de ${usd0(victim.paid)} de rendements reçus` : ''}.\n\n` +
          `À retenir : la signature d'un Ponzi se lit dans les flux. Une adresse de collecte sans autre source que les dépôts, un portefeuille de paiement réalimenté juste avant chaque vague de retraits, des commissions de parrainage, puis une vidange finale. Mesurer la part reversée, la part en commissions et la part captée objective le préjudice global et oriente les saisies. Les gagnants (premiers entrants, leaders) sont à identifier : ils peuvent être témoins, complices ou simplement bénéficiaires.`,
      },
      hints: [
        'Le dépôt cité dans la plainte mène à l\'adresse de collecte ; son historique est celui de toute la plateforme.',
        'La transaction publiée comme « preuve » sur Telegram révèle le portefeuille qui paie les rendements.',
        'Comparez les totaux reçus et envoyés des deux adresses de la plateforme : la part reversée se calcule directement.',
        'Les autres sorties de l\'adresse de collecte vont soit aux leaders (commissions), soit à un portefeuille unique qui finit vidé vers deux prestataires.',
      ],
    }
  },
}
