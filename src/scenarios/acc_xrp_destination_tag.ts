import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import { dusting, priorHistory } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

/** Heure (0-23) à Paris d'un horodatage. */
function parisHour(ts: number): number {
  const p = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Paris' }).formatToParts(new Date(ts * 1000))
  return Number(p.find((x) => x.type === 'hour')!.value)
}
/** Repousse un horodatage nocturne à la première heure de journée (8 h - 21 h, heure de Paris). */
function daytime(ts: number): number {
  let t = ts
  while (parisHour(t) < 8 || parisHour(t) >= 21) t += 3600
  return t
}
/** Délai lisible : « 7 heures », « 2 jours ». */
function delayTxt(sec: number): string {
  const h = Math.max(1, Math.round(sec / 3600))
  if (h < 36) return `${h} heure${h > 1 ? 's' : ''}`
  return `${Math.round(h / 24)} jours`
}

export const accXrpDestinationTag: ScenarioTemplate = {
  id: 'xrp-destination-tag',
  title: 'Le destination tag XRP',
  tagline: 'Une adresse partagée par des milliers de clients : seul le tag désigne le titulaire.',
  description:
    'Une victime a placé ses XRP dans un faux programme de « staking garanti ». Le « pool » collecte les versements de nombreux membres, puis les fonds finissent sur les adresses de deux exchanges… partagées par tous leurs clients. Isolez la seconde victime parmi les membres, remontez l\'activation du compte de transit, retrouvez les destination tags des comptes crédités au milieu des dépôts d\'autres clients, chiffrez ce qu\'a reçu le faux pool et préparez des réquisitions exploitables.',
  difficulty: 1,
  chains: ['xrp'],
  skills: ['lecture_tx', 'memo', 'exchange_id', 'requisition'],
  estMinutes: 40,
  lessons: ['comptes-evm', 'xrp-memos', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)

    const cv = exchange(w, 'coinhouse', 'xrp')
    const destKey = r.pick(['binance', 'okx', 'bitstamp'] as const)
    const dest = exchange(w, destKey, 'xrp')
    // Seconde plateforme, où l'escroc encaisse une plus petite part sous un autre tag
    const ex2Key = r.pick((['kraken', 'bitstamp', 'binance', 'okx'] as const).filter((k) => k !== destKey))
    const ex2 = exchange(w, ex2Key, 'xrp')
    // Troisième plateforme : celle qui a activé (premier paiement) le compte de transit
    const actKey = r.pick((['kraken', 'bitstamp', 'binance', 'okx', 'coinbase'] as const).filter((k) => k !== destKey && k !== ex2Key))
    const act = exchange(w, actKey, 'xrp')

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('xrp', { entity: victimE })
    const suspect = w.customEntity({ name: '« XRP Yield Club » (inconnu)', category: 'suspect' })

    // La victime a un historique ordinaire : achats Coinhouse et quelques envois, des mois avant les faits
    priorHistory(w, victim, { start: w.at(-220 * 24), end: w.at(-35 * 24), nIn: r.int(2, 4), nOut: r.int(1, 2), maxUsd: 700, sources: [cv.hot] })
    // Puis elle achète les XRP destinés au « pool » sur Coinhouse
    const pay1 = Math.round(r.float(6000, 20000) / 100) * 100
    const pay2 = Math.round(r.float(4000, 15000) / 100) * 100
    cv.withdraw(victim, pay1 + r.int(30, 200), w.at(-r.float(20, 40)), 'XRP')
    cv.withdraw(victim, pay2 + r.int(10, 80), w.at(r.float(30, 44)), 'XRP')

    // ── Compte de transit : activé des semaines plus tôt par un retrait d'exchange ──
    const s1 = w.addr('xrp', { entity: suspect })
    const s2 = w.addr('xrp', { entity: suspect })
    const actV = r.int(25, 60)
    const actTx = act.withdraw(s2, actV, w.at(-r.float(25, 60) * 24), 'XRP')
    // Petite vie du compte avant les faits : quelques rentrées et sorties modestes
    for (let i = 0; i < r.int(2, 3); i++) w.fundAccount(s2, r.int(40, 300), 'XRP', actTx.time + Math.round(r.float(1, 18) * DAY))
    for (let i = 0; i < r.int(1, 2); i++) {
      const t = actTx.time + Math.round(r.float(19, 22) * DAY) + i * Math.round(r.float(2, 30) * HOUR)
      w.transfer({ time: t, from: s2, to: w.addr('xrp'), value: roundAsset('XRP', w.balanceOf(s2, 'XRP') * r.float(0.15, 0.3)), asset: 'XRP', autoFund: false })
    }

    // ── Versements au « pool » : la victime, une seconde victime identifiable, d'autres membres ──
    const t1 = w.transfer({ time: w.at(0), from: victim, to: s1, value: pay1, asset: 'XRP' })
    const t2 = w.transfer({ time: w.at(r.float(48, 60)), from: victim, to: s1, value: pay2, asset: 'XRP' })
    const other = w.addr('xrp', { entity: w.customEntity({ name: 'Victime non identifiée', category: 'victim' }) })
    let payO = Math.round(r.float(3000, 12000) / 100) * 100
    while ([pay1, pay2].some((p) => Math.abs(p - payO) / p < 0.03)) payO += 300
    // La seconde victime achète ses XRP sur Coinhouse : le retrait qui alimente son compte l'identifiera
    const otherFund = cv.withdraw(other, payO + r.int(20, 150), w.at(r.float(-30, 8)), 'XRP')
    const tOther = w.transfer({ time: w.at(r.float(12, 40)), from: other, to: s1, value: payO, asset: 'XRP' })
    // Autres membres du canal : montants « ronds » en XRP, étalés depuis l'ouverture du pool
    const used = [pay1, pay2, payO]
    const memberAmt = () => {
      let v = Math.round(r.float(900, 9000) / 50) * 50
      while (used.some((u) => Math.abs(u - v) / u < 0.02)) v += 150
      used.push(v)
      return v
    }
    const member = (t: number): Tx => {
      const a = w.addr('xrp')
      const v = memberAmt()
      // Environ la moitié des membres achètent leurs XRP sur Coinhouse, les autres viennent de comptes non attribués
      const ft = t - Math.round(r.float(2, 96) * HOUR)
      if (r.chance(0.5)) cv.withdraw(a, v + r.int(15, 120), ft, 'XRP')
      else w.fundAccount(a, v + r.int(15, 120), 'XRP', ft)
      return w.transfer({ time: t, from: a, to: s1, value: v, asset: 'XRP' })
    }
    const members: Tx[] = []
    for (let i = 0; i < r.int(5, 8); i++) members.push(member(w.at(r.float(-70, 60))))

    // Transit par la seconde adresse (en laissant la réserve du compte)
    const reserve1 = r.int(2, 12)
    const t3 = w.transfer({ time: w.at(r.float(62, 70)), from: s1, to: s2, value: roundAsset('XRP', w.balanceOf(s1, 'XRP') - reserve1), asset: 'XRP' })
    // Des membres continuent de payer après le vidage : ces XRP restent sur le pool
    const late: Tx[] = []
    for (let i = 0; i < r.int(1, 2); i++) late.push(member(t3.time + Math.round(r.float(3, 40) * HOUR)))

    // Première sortie, plus petite, vers la seconde plateforme (adresse partagée + son propre tag)
    const tag = r.int(10000000, 499999999)
    let tag2 = r.int(1000000, 499999999)
    if (tag2 === tag) tag2 += 11
    const side = roundAsset('XRP', Math.round((w.balanceOf(s2, 'XRP') * r.float(0.18, 0.28)) / 10) * 10)
    const sideT = w.at(r.float(71, 75))
    const dSide = w.transfer({ time: sideT, from: s2, to: ex2.hot, value: side, asset: 'XRP', memo: String(tag2) })

    // Dépôt principal : un petit dépôt « test », puis deux versements, tous sous le même tag
    const reserve2 = r.int(2, 12)
    const depT = w.at(r.float(77, 88))
    const testV = r.int(2, 5) * 10
    const dTest = dest.receive(s2, testV, depT - Math.round(r.float(40, 110) * 60), { asset: 'XRP', memo: String(tag) })
    const rest = roundAsset('XRP', w.balanceOf(s2, 'XRP') - reserve2)
    const part1 = roundAsset('XRP', Math.round((rest * r.float(0.55, 0.7)) / 100) * 100)
    const part2 = roundAsset('XRP', rest - part1)
    const d1 = dest.receive(s2, part1, depT, { asset: 'XRP', memo: String(tag) })
    const d2 = dest.receive(s2, part2, depT + r.int(20, 90) * 60, { asset: 'XRP', memo: String(tag) })
    const depTotal = roundAsset('XRP', testV + part1 + part2)

    // ── Leurres sur les adresses partagées : d'autres clients déposent au même moment ──
    const tags = new Set([tag, tag2])
    const freshTag = () => {
      let t = r.int(1000000, 499999999)
      while (tags.has(t)) t += 7
      tags.add(t)
      return t
    }
    const clientDeposit = (hot: string, v: number, t: number, memo: number) => {
      const a = w.addr('xrp')
      w.fundAccount(a, roundAsset('XRP', v + r.int(15, 100)), 'XRP', t - r.int(2, 72) * HOUR)
      return w.transfer({ time: t, from: a, to: hot, value: roundAsset('XRP', v), asset: 'XRP', memo: String(memo) })
    }
    for (let i = 0; i < r.int(5, 7); i++) clientDeposit(dest.hot, part1 * r.float(0.5, 1.5), depT + r.int(-6 * 3600, 6 * 3600), freshTag())
    for (let i = 0; i < r.int(3, 5); i++) clientDeposit(ex2.hot, side * r.float(0.5, 1.5), sideT + r.int(-6 * 3600, 6 * 3600), freshTag())
    // Un client dépose presque le même montant que l'escroc, à quelques minutes d'intervalle
    const twinDep = clientDeposit(dest.hot, part1 * r.float(0.996, 1.004), depT + r.int(-20 * 60, 20 * 60), freshTag())
    // Un autre utilise un tag qui ne diffère de celui de l'escroc que par le dernier chiffre
    let nearTag = tag - (tag % 10) + ((tag % 10) + r.int(1, 9)) % 10
    if (tags.has(nearTag)) nearTag = tag - (tag % 10) + ((tag % 10) + 5) % 10
    tags.add(nearTag)
    const nearDep = clientDeposit(dest.hot, part2 * r.float(0.7, 1.3), depT + r.int(-3 * 3600, 3 * 3600), nearTag)
    // Poussière : des comptes sosies (mêmes premiers et derniers caractères) écrivent au compte de transit
    const dust = dusting(w, s2, { time: depT + 6 * HOUR, n: r.int(2, 3), spreadH: 30, token: 'XRP' })

    // Bruit de fond
    dest.noise(22, w.at(-3 * 24), w.at(6 * 24), 'XRP')
    ex2.noise(14, w.at(-3 * 24), w.at(6 * 24), 'XRP')
    act.noise(10, actTx.time - 3 * DAY, actTx.time + 4 * DAY, 'XRP')
    cv.noise(10, w.at(-3 * 24), w.at(5 * 24), 'XRP')

    // ── Réponses, calculées sur le monde final ───────────────────────────────
    const poolIn = w.txsOf(s1).filter((tx) => tx.transfers.some((x) => x.to === s1))
    const poolTotal = roundAsset('XRP', w.summary(s1).received.XRP ?? 0)
    const senders = new Set(poolIn.flatMap((tx) => tx.transfers.filter((x) => x.to === s1).map((x) => x.from)))
    const nSenders = senders.size
    const lateTotal = roundAsset('XRP', late.reduce((s, tx) => s + tx.transfers[0].value, 0))
    const poolLeft = roundAsset('XRP', w.balanceOf(s1, 'XRP'))
    const handle = fakeHandle(r)
    const memberHandle = fakeHandle(r)
    const destName = dest.entity.name
    const ex2Name = ex2.entity.name
    const actName = act.entity.name
    const dayO = fmtDate(tOther.time, false)
    const deVictim = de(victimName)
    // Membres (hors votre victime) dont le compte a été alimenté par un retrait Coinhouse
    const nCv = [...senders].filter((a) => a !== victim && w.txsOf(a).some((tx) => tx.transfers.some((x) => x.to === a && x.from === cv.hot))).length
    const nOthers = nSenders - 1
    const cvTxt = nCv === 0
      ? `Aucun n'a été alimenté depuis une plateforme identifiée : leurs comptes sont à remonter un par un.`
      : `${nCv === nOthers ? (nOthers > 1 ? `Tous les ${nOthers} ont` : 'Il a') : nCv > 1 ? `${nCv} d'entre eux ont` : 'L\'un d\'eux a'} été ${nCv > 1 ? 'alimentés' : 'alimenté'} par un retrait Coinhouse avant de payer : une réquisition à Coinhouse, citant les hash de ces retraits, ${nCv > 1 ? 'les identifiera' : 'l\'identifiera'}.${nCv < nOthers ? ` ${nOthers - nCv > 1 ? 'Les autres viennent' : 'Le dernier vient'} de comptes non attribués, à remonter un par un.` : ''}`
    const otherDelay = delayTxt(tOther.time - otherFund.time)

    return {
      world: w,
      title: `XRP Yield Club — ${city}`,
      briefing:
        `${victimName} (${city}) a rejoint sur Telegram le « XRP Yield Club », qui promettait 4 % de rendement hebdomadaire sur des XRP « stakés ». ${g('Il', 'Elle')} a envoyé deux virements en XRP depuis son portefeuille personnel, alimenté par Coinhouse.\n\n` +
        `Le groupe a disparu. D'autres membres se plaignent sur le canal : le « pool » a collecté bien plus que les fonds de votre victime. Sur le XRP Ledger, les exchanges utilisent souvent une seule adresse pour tous leurs clients : le compte crédité est désigné par un numéro joint au paiement, le destination tag.\n\n` +
        `Votre mission : mesurer ce qu'a collecté le « pool » et isoler la seconde victime qui s'est manifestée, suivre les XRP jusqu'aux exchanges, retrouver parmi les dépôts d'autres clients ceux de l'escroc et leurs destination tags, remonter l'activation du compte de transit, puis préparer des réquisitions exploitables.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: daytime(w.at(7 * 24)), author: victimName,
          body:
            `« J'ai fait deux envois : ${amt(pay1, 'XRP')} le ${fmtDate(t1.time)} et ${amt(pay2, 'XRP')} le ${fmtDate(t2.time)}.\n\n` +
            `Mon adresse XRP : ${A(w, victim)}\n` +
            `Référence du premier envoi : ${t1.hash} »`,
        },
        {
          id: 'telegram', type: 'telegram', title: 'Canal Telegram « XRP Yield Club »', author: `@${handle}`, date: w.at(-3 * 24),
          body:
            `📢 Nouveau pool de staking ouvert ! 4 %/semaine garantis 🔒\n` +
            `Adresse officielle du pool : ${A(w, s1)}\n` +
            `⚠️ Pas besoin de destination tag pour notre pool, envoyez directement.`,
        },
        {
          id: 'telegram2', type: 'telegram', title: 'Canal Telegram « XRP Yield Club » — derniers messages', author: `@${memberHandle}`, date: w.at(6 * 24),
          body:
            `@${memberHandle} : J'ai envoyé ${amt(payO, 'XRP')} au pool le ${dayO}, toujours aucun rendement crédité 😡\n` +
            `@${memberHandle} : Les admins ne répondent plus, quelqu'un a des nouvelles ?\n` +
            `@${fakeHandle(r)} : pareil, j'ai encore versé cette semaine… on s'est fait avoir ?\n` +
            `[Le canal a été supprimé par son administrateur]`,
        },
        {
          id: 'note', type: 'note', title: 'Note de la cellule d\'appui : particularités du XRP Ledger', date: daytime(w.at(7 * 24) + 3 * HOUR), author: 'Cellule d\'appui',
          body:
            `• Un compte XRP n'existe qu'après avoir reçu un premier paiement couvrant la réserve de base : c'est l'« activation ». Le compte qui l'a financé apparaît en tête de l'historique : c'est souvent un exchange (retrait d'un client) ou le propriétaire lui-même. Pensez à remonter cette première transaction.\n` +
            `• Sur une adresse d'exchange partagée, des milliers de clients déposent chaque jour : seul le destination tag, rapproché de l'expéditeur, du montant et de l'heure, désigne un compte. Un tag voisin (un chiffre de différence) est celui d'un autre client.\n` +
            `• Des comptes « sosies » (mêmes premiers et derniers caractères) envoient parfois quelques centièmes d'XRP pour s'insérer dans l'historique d'un compte : ils ne disent rien de son propriétaire.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o13', type: 'number', points: 8, tolerance: 0, unit: 'adresses',
          prompt: 'Combien d\'adresses distinctes ont envoyé des XRP au « pool » (votre victime comprise) ?',
          answer: nSenders,
          hint: 'Dépliez les flux entrants de l\'adresse du pool et comptez les expéditeurs différents (la victime a payé deux fois : elle ne compte qu\'une fois).',
          explanation: `${nSenders} expéditeurs distincts : ${victimName} (deux versements) et ${nSenders - 1} autres comptes, dont ${late.length > 1 ? `${late.length} qui ont payé` : 'un qui a payé'} après le vidage du pool. Chacun est un membre floué potentiel, à identifier et à entendre. ${cvTxt} Seul le message de @${memberHandle} permet, à ce stade, de relier l'un d'eux à un pseudonyme.`,
        },
        {
          id: 'o5', type: 'address', points: 8,
          prompt: `Le membre @${memberHandle} se plaint sur le canal. Quelle est l'adresse depuis laquelle il a payé le « pool » ?`,
          answer: [other],
          hint: 'Son message donne un montant et une date : cherchez, parmi les versements reçus par le pool, celui qui correspond exactement aux deux.',
          explanation: `Le ${dayO}, ${A(w, other)} envoie exactement ${amt(payO, 'XRP')} au pool, comme l'écrit @${memberHandle}. Les autres versements reçus ce jour-là, ou d'un montant voisin, ne correspondent pas aux deux critères à la fois. C'est une seconde victime, à identifier : son compte a été alimenté ${otherDelay} avant ce paiement par un retrait Coinhouse (${otherFund.hash.slice(0, 12)}…, ${amt(otherFund.transfers[0].value, 'XRP')}). Coinhouse rattachera ce retrait à son client : ${procedureFor(cv.entity)}`,
        },
        {
          id: 'o6', type: 'amount', points: 8, unit: 'XRP', tolerance: 0.005,
          prompt: 'Combien d\'XRP l\'adresse du « pool » a-t-elle reçus au total ?',
          answer: poolTotal,
          hint: 'Sélectionnez l\'adresse du pool et lisez son « Total reçu ».',
          explanation: `${amt(poolTotal, 'XRP')} au total, dont ${amt(pay1 + pay2, 'XRP')} ${deVictim} et ${amt(payO, 'XRP')} de @${memberHandle}. C'est le préjudice minimal visible on-chain, toutes victimes confondues. ${amt(lateTotal, 'XRP')} sont arrivés après le vidage du pool et y dorment encore (${amt(poolLeft, 'XRP')} avec la réserve) : des membres ont continué à payer sans savoir que le pool était vidé.`,
        },
        {
          id: 'o4', type: 'address', points: 8,
          prompt: 'Vers quelle adresse de transit l\'escroc vide-t-il l\'adresse du pool ?',
          answer: [s2],
          hint: 'Dépliez les flux sortants de l\'adresse du pool : un seul transfert, presque tout le solde.',
          explanation: `${A(w, s2)} reçoit le ${fmtDate(t3.time)} tout le solde du pool à cette date, à l'exception de ${amt(reserve1, 'XRP')} : sur le XRP Ledger, un compte doit conserver une réserve minimale qu'il ne peut pas envoyer. Cette adresse, non attribuée, n'a rien d'un compte jetable : elle existait depuis des semaines. C'est le relais de l'escroc d'où partent les dépôts vers les plateformes.`,
        },
        {
          id: 'o1', type: 'entity', points: 10,
          prompt: 'Sur quel exchange la majeure partie des XRP a-t-elle été déposée ?',
          answer: [destKey],
          hint: 'Suivez les XRP de l\'adresse de transit : ils arrivent sur des adresses étiquetées. Comparez les montants.',
          explanation: `Depuis ${A(w, s2)}, ${amt(depTotal, 'XRP')} sont envoyés en trois fois sur le hot wallet ${de(destName)}, une plus petite part (${amt(side, 'XRP')}) partant vers ${ex2Name}.`,
        },
        {
          id: 'o2', type: 'number', points: 12, tolerance: 0, unit: 'tag',
          prompt: 'Quel destination tag accompagne les dépôts de l\'escroc sur cet exchange ?',
          answer: tag,
          hint: 'Ouvrez le détail des transferts de l\'adresse de transit vers le hot wallet : le champ memo / destination tag y figure. Attention aux dépôts d\'autres clients du même jour, et aux tags qui se ressemblent.',
          explanation: `Les dépôts envoyés par ${A(w, s2).slice(0, 10)}… portent tous le tag ${tag}. À ${Math.max(1, Math.round(Math.abs(twinDep.time - d1.tx.time) / 60))} minute${Math.round(Math.abs(twinDep.time - d1.tx.time) / 60) > 1 ? 's' : ''} du premier gros dépôt, ${A(w, twinDep.transfers[0].from).slice(0, 10)}… dépose ${amt(twinDep.transfers[0].value, 'XRP')} (montant presque identique, tag ${twinDep.memo}) ; dans les mêmes heures, ${A(w, nearDep.transfers[0].from).slice(0, 10)}… utilise le tag ${nearTag}, qui ne diffère que par le dernier chiffre : ce sont d'autres clients. Seul l'expéditeur fait foi, le montant et le tag « à peu près » ne suffisent pas.`,
        },
        {
          id: 'o7', type: 'tx', points: 8,
          prompt: 'Citez une transaction de dépôt portant ce tag (à mentionner dans la réquisition).',
          answer: [dTest.tx.id, d1.tx.id, d2.tx.id],
          hint: 'Ce sont les transferts de l\'adresse de transit vers le hot wallet de la plateforme principale ; vérifiez le tag dans leur détail.',
          explanation: `Trois transactions conviennent : le dépôt « test » ${dTest.tx.hash.slice(0, 12)}… (${amt(testV, 'XRP')}, ${fmtDate(dTest.tx.time)}), puis ${d1.tx.hash.slice(0, 12)}… (${amt(part1, 'XRP')}) et ${d2.tx.hash.slice(0, 12)}… (${amt(part2, 'XRP')}). La réquisition cite les trois, avec le tag ${tag} : hash, date et montant permettent à ${destName} de retrouver chaque crédit sans ambiguïté, même si un client a mal saisi son tag.`,
        },
        {
          id: 'o8', type: 'amount', points: 8, unit: 'XRP', tolerance: 0.005,
          prompt: 'Quel montant total d\'XRP a été crédité sous ce tag ?',
          answer: depTotal,
          hint: 'Additionnez tous les dépôts de l\'adresse de transit qui portent ce tag, petit dépôt de test compris.',
          explanation: `${amt(testV, 'XRP')} + ${amt(part1, 'XRP')} + ${amt(part2, 'XRP')} = ${amt(depTotal, 'XRP')}. Le petit dépôt initial est un test classique : l'escroc vérifie que le tag crédite bien son compte avant d'envoyer le gros des fonds. C'est le montant à rechercher sur le compte client ${de(destName)}, et à bloquer s'il n'a pas déjà été retiré.`,
        },
        {
          id: 'o9', type: 'entity', points: 8,
          prompt: 'Vers quelle autre plateforme une plus petite part des XRP a-t-elle été envoyée ?',
          answer: [ex2Key],
          hint: 'L\'adresse de transit a envoyé des XRP vers deux hot wallets étiquetés (sans compter celui qui l\'avait activée).',
          explanation: `Le ${fmtDate(dSide.time)}, avant le dépôt principal, l'adresse de transit envoie ${amt(side, 'XRP')} sur l'adresse partagée ${de(ex2Name)}. L'escroc dispose donc d'un second compte, sur une autre plateforme : ${procedureFor(ex2.entity)}`,
        },
        {
          id: 'o10', type: 'number', points: 10, tolerance: 0, unit: 'tag',
          prompt: 'Quel destination tag accompagne ce dépôt sur la seconde plateforme ?',
          answer: tag2,
          hint: 'Ouvrez le transfert de l\'adresse de transit vers le hot wallet de la seconde plateforme et lisez le champ « Destination tag ».',
          explanation: `Le dépôt de ${amt(side, 'XRP')} vers ${ex2Name} porte le tag ${tag2}, différent de celui utilisé chez ${destName} : chaque plateforme attribue ses propres numéros, un tag n'a de sens qu'avec l'adresse à laquelle il est associé. Les autres dépôts reçus par ${ex2Name} dans les mêmes heures viennent d'autres expéditeurs. La réquisition à ${ex2Name} cite ce tag, le hash ${dSide.hash.slice(0, 12)}…, la date et le montant.`,
        },
        {
          id: 'o12', type: 'entity', points: 10,
          prompt: 'Quel service a activé le compte de transit (premier paiement reçu par ce compte) ?',
          answer: [actKey],
          hint: 'Ouvrez l\'historique du compte de transit et remontez à sa toute première transaction entrante.',
          explanation: `Le ${fmtDate(actTx.time)}, ${A(w, s2)} reçoit ${amt(actV, 'XRP')} depuis le hot wallet ${de(actName)} : c'est un retrait, demandé par un client de la plateforme, qui a créé le compte. Un retrait ne porte pas de tag utile (le tag sert à désigner le destinataire d'un dépôt) : c'est le hash de cette transaction qui permet à ${actName} de retrouver le client donneur d'ordre, très probablement l'escroc lui-même. Les petits mouvements qui suivent (quelques rentrées et sorties modestes) sont la vie ordinaire du compte. ${procedureFor(act.entity)}`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Que révèle l\'annonce du canal « pas besoin de destination tag pour notre pool » ?',
          ...choice(r,
            'Que l\'adresse du pool est un compte personnel contrôlé par l\'escroc, et non l\'adresse partagée d\'une plateforme',
            [
              'Que le pool utilise un mécanisme de staking qui identifie automatiquement chaque déposant',
              'Que les fonds partent directement sur un smart contract de staking du XRP Ledger',
              'Que l\'adresse appartient à un exchange qui a désactivé les tags pour ce client',
            ]),
          hint: 'Dans quel cas un destinataire XRP a-t-il besoin d\'un tag ?',
          explanation: `Un tag n'est nécessaire que si l'adresse de destination est partagée entre plusieurs clients (exchange, service de paiement). Une adresse qui n'en demande pas appartient à une seule personne : ici, l'escroc. Il n'existe pas de « staking » natif rémunéré sur le XRP Ledger : la promesse elle-même signait l'escroquerie. Les fonds n'ont d'ailleurs fait que transiter par ${A(w, s2).slice(0, 10)}… avant d'être déposés sur des exchanges.`,
        },
        {
          id: 'o3', type: 'choice', points: 12,
          prompt: 'Pourquoi une réquisition mentionnant seulement l\'adresse de l\'exchange serait-elle inexploitable ?',
          ...choice(r,
            'L\'adresse est commune à tous les clients : seul le tag (avec hash et date) désigne le compte',
            [
              'Les adresses XRP changent à chaque transaction, l\'adresse citée n\'existe déjà plus',
              'L\'exchange ne conserve pas l\'historique des dépôts reçus sur ses propres adresses',
              'Le destination tag est un mot de passe : sans lui, l\'exchange ne peut rien consulter',
            ]),
          hint: 'Combien de clients déposent sur cette adresse, et comment l\'exchange les distingue-t-il ?',
          explanation: `L'adresse ${A(w, dest.hot)} reçoit les dépôts de milliers de clients : rien que dans les heures du dépôt, plusieurs autres comptes y versent des montants comparables. La réquisition doit viser le tag ${tag} et citer les hash des dépôts, leurs dates et montants. Sans tag, l'exchange ne peut pas savoir quel compte a été crédité. ${procedureFor(dest.entity)}`,
        },
      ],
      truth: {
        path: [t1.id, tOther.id, t2.id, t3.id, dSide.id, dTest.tx.id, d1.tx.id, d2.tx.id],
        addresses: [s1, s2, dest.hot, ex2.hot, other],
        debrief:
          `1. La victime envoie ${amt(pay1, 'XRP')} puis ${amt(pay2, 'XRP')} à l'adresse du « pool » ${A(w, s1)}. ${nSenders - 1} autres comptes y versent aussi des XRP, dont @${memberHandle} (${A(w, other)}, ${amt(payO, 'XRP')} le ${dayO}) : ${amt(poolTotal, 'XRP')} au total.\n` +
          `2. L'escroc transfère le solde vers ${A(w, s2)} en laissant ${amt(reserve1, 'XRP')} : sur le XRP Ledger, un compte doit conserver une petite réserve minimale qu'il ne peut pas envoyer. ${late.length > 1 ? `${late.length} membres paient` : 'Un membre paie'} encore après ce vidage (${amt(lateTotal, 'XRP')}, restés sur le pool).\n` +
          `3. Le compte de transit n'est pas jetable : il a été activé le ${fmtDate(actTx.time, false)} par un retrait ${actName} de ${amt(actV, 'XRP')}, piste d'identification directe.\n` +
          `4. Il envoie d'abord ${amt(side, 'XRP')} sur l'adresse partagée ${de(ex2Name)}, avec le destination tag ${tag2}.\n` +
          `5. Il dépose ensuite un test de ${amt(testV, 'XRP')}, puis ${amt(part1, 'XRP')} et ${amt(part2, 'XRP')} (${amt(depTotal, 'XRP')} au total) sur l'adresse partagée ${de(destName)}, avec le destination tag ${tag}.\n\n` +
          `Fausses pistes : les dépôts d'autres clients sur les mêmes adresses partagées, dont un montant quasi identique à quelques minutes près et un tag voisin (${nearTag}) ; les ${dust.txs.length} micro-envois de comptes sosies vers le compte de transit ; les autres membres du pool, victimes et non complices.\n\n` +
          `À retenir : sur XRP (comme pour les memos Stellar, EOS, Cosmos ou certains dépôts BNB), l'adresse d'un exchange est souvent commune à tous ses clients. Le couple adresse + destination tag, appuyé du hash de transaction, est indispensable à la réquisition ; un tag n'a de sens que pour la plateforme qui l'a attribué. À l'inverse, l'annonce « pas besoin de tag » du faux pool trahit une adresse personnelle, contrôlée par l'escroc. Trois réquisitions sont à prévoir (${destName} et ${ex2Name} pour les comptes crédités, ${actName} pour le client qui a activé le compte de transit), et les autres membres du pool sont à identifier.`,
      },
      hints: [
        'Dépliez les flux sortants de la victime puis les flux entrants et sortants de l\'adresse du « pool ».',
        'L\'adresse finale est étiquetée « Hot Wallet » : elle reçoit énormément de dépôts de tiers. Ne retenez que ceux qui viennent de l\'adresse de transit.',
        'Dans le détail d\'une transaction XRP, le destination tag apparaît dans le champ memo.',
        'L\'adresse de transit n\'a pas tout envoyé au même endroit : vérifiez chacun de ses transferts sortants.',
        'La première transaction d\'un compte XRP est son activation : qui l\'a payée ?',
      ],
    }
  },
}
