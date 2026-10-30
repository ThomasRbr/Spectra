// Exercices complémentaires : commentaire de dépôt TON, flux d'un schéma de
// Ponzi, retraits par bridge canonique de L2 et wash trading de NFT.
// Chaque réponse est calculée par le générateur à partir des lignes affichées.
import { genAddress, shortAddr } from '../../engine/addressgen'
import type { ChainId } from '../../engine/chains'
import type { DrillDef, DrillVisual } from '../model'
import { LETTERS, dayTime, de, fr, frList, frMax, mkChoice, rngFor } from './util'

type Row = Extract<DrillVisual, { type: 'transfers' }>['rows'][number]

const DAY = 86400
const H = 3600

let parisFmt: Intl.DateTimeFormat | undefined
let parisDayFmt: Intl.DateTimeFormat | undefined
/** Date et heure de Paris, au même format que la colonne « Date » des tableaux. */
export function parisTime(t: number): string {
  parisFmt ??= new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  return parisFmt.format(new Date(t * 1000))
}
/** Jour (heure de Paris), ex. « 14/03/2025 ». */
function parisDay(t: number): string {
  parisDayFmt ??= new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' })
  return parisDayFmt.format(new Date(t * 1000))
}

// ── TON : commentaire de dépôt ───────────────────────────────────────────────

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const b64 = (rng: ReturnType<typeof rngFor>, n: number) => Array.from({ length: n }, () => B64URL[rng.int(0, 63)]).join('')

/** Lignes correspondant à un indice « montant + date/heure » (pour les vérifications automatiques). */
export function tonClueMatches(rows: Row[], value: number, time: string): number {
  return rows.filter((r) => r.value === value && r.time !== undefined && parisTime(r.time) === time).length
}

export const tonComment: DrillDef = {
  id: 'ton-comment',
  title: 'Commentaire de dépôt TON',
  description: 'Sur TON, un exchange reçoit souvent tous ses clients sur une adresse partagée : seul le commentaire de la transaction désigne le compte. Le retrouver, et lire les formats d\'adresse EQ / UQ.',
  level: 2,
  track: 'comptes',
  icon: 'MessageSquareText',
  generate(seed) {
    const rng = rngFor(seed, 'ton-comment')
    const variant = rng.weighted([['sender', 3], ['amount', 3], ['twin', 2], ['bounce', 1.5]] as const)
    const svc = rng.pick(['TonPocket', 'OKX', 'Bybit', 'Bitget', 'TonPocket'])
    const shared = genAddress(rng, 'ton', 'contract')
    const sharedLabel = `${svc} — adresse de dépôt partagée`

    if (variant === 'twin') {
      const uq = genAddress(rng, 'ton', 'ton_wallet')
      let chk = b64(rng, 3)
      while (chk === uq.slice(-3)) chk = b64(rng, 3)
      const twin = 'EQ' + uq.slice(2, 45) + chk
      const poison = 'EQ' + uq.slice(2, 6) + b64(rng, 35) + uq.slice(41)
      const randEq = genAddress(rng, 'ton', 'contract')
      const randUq = genAddress(rng, 'ton', 'ton_wallet')
      const { options, answer } = mkChoice(rng, twin, rng.shuffle([poison, randEq, randUq]), 4)
      return {
        prompt: 'Le suspect a communiqué l\'adresse TON ci-dessus (forme « UQ »). Dans les relevés d\'un exchange, ses retraits apparaissent vers une adresse de forme « EQ ». Laquelle de ces adresses désigne le même compte ?',
        context: 'Une adresse TON « user-friendly » compte 48 caractères base64url : drapeaux (bounceable ou non), workchain, identifiant du compte sur 32 octets, puis une somme de contrôle de 2 octets.',
        visual: { type: 'address', value: uq },
        kind: 'choice',
        options,
        answer,
        explain: `Le même compte TON peut s'écrire sous deux formes qui ne diffèrent que par le drapeau « bounceable » : EQ… (bounceable) et UQ… (non-bounceable). Changer ce drapeau modifie les deux premiers caractères et, par ricochet, la somme de contrôle (les trois derniers) ; tout le milieu — l'identifiant du compte — reste identique. ${twin} reprend exactement les caractères 3 à 45 de ${uq} : c'est le même compte.\n\nLe piège : ${shortAddr(poison, 8)} reprend le début et la fin de l'adresse du suspect, mais son milieu est différent. C'est une autre adresse, construite comme pour de l'address poisoning. Les deux autres n'ont rien en commun avec elle.\n\nBon réflexe : convertir les adresses dans leur forme brute (0:… suivi de 64 caractères hexadécimaux, affichée par les explorateurs comme Tonviewer) avant de comparer ou de regrouper, au lieu de se fier au début et à la fin.`,
      }
    }

    if (variant === 'bounce') {
      const uq = genAddress(rng, 'ton', 'ton_wallet')
      const memo = String(rng.int(100000, 99999999))
      const asset = rng.chance(0.6) ? 'USDT' : 'TON'
      const value = asset === 'USDT' ? Math.round(rng.float(100, 9000)) : Math.round(rng.float(20, 1500) * 10) / 10
      const correct = 'Ce n\'est qu\'un drapeau d\'encodage : EQ = « bounceable » (les fonds sont renvoyés si le destinataire échoue, usage des contrats et services), UQ = « non-bounceable » (forme recommandée pour les portefeuilles)'
      const d = [
        'EQ signale un compte d\'exchange vérifié (KYC), UQ un portefeuille anonyme',
        'UQ désigne une adresse du réseau de test (testnet), sans valeur réelle',
        'EQ et UQ correspondent à deux blockchains différentes : il faut un bridge pour passer de l\'une à l\'autre',
      ]
      const { options, answer } = mkChoice(rng, correct, rng.shuffle(d), 4)
      return {
        prompt: `Pourquoi l'adresse de dépôt ${de(svc)} commence-t-elle par « EQ » et celle du suspect par « UQ » ?`,
        visual: { type: 'transfers', chain: 'ton', rows: [{ from: uq, to: shared, value, asset, memo, method: asset === 'TON' ? 'transfer' : 'jetton transfer', time: dayTime(rng), fromLabel: 'Suspect', toLabel: sharedLabel }] },
        kind: 'choice',
        options,
        answer,
        explain: `Une adresse TON lisible encode, dans son premier octet, des drapeaux : 0x11 donne « EQ… » (bounceable), 0x51 donne « UQ… » (non-bounceable). Si un message bounceable échoue — destinataire inexistant ou contrat qui rejette l'opération — les fonds reviennent à l'expéditeur. Les services et contrats affichent donc des adresses EQ ; les portefeuilles, souvent pas encore déployés lors du premier dépôt, utilisent UQ pour que les fonds ne soient pas renvoyés.\n\nCe drapeau ne dit rien du titulaire : pas de notion de KYC, et c'est le même réseau (pas de bridge). Le réseau de test utilise un autre drapeau (formes « kQ » / « 0Q »).\n\nConséquence d'enquête : un même compte peut apparaître sous ses deux formes selon l'outil. Normalisez les adresses (forme brute 0:…) avant de comparer, et n'oubliez pas qu'ici le compte client chez ${svc} est désigné par le commentaire ${memo}, pas par l'adresse.`,
      }
    }

    // Plusieurs dépôts vers l'adresse partagée : retrouver le commentaire du suspect.
    const n = rng.int(5, 7)
    const asset = rng.chance(0.6) ? 'USDT' : 'TON'
    const method = asset === 'TON' ? 'transfer' : 'jetton transfer'
    const amount = () => (asset === 'USDT' ? (rng.chance(0.5) ? Math.round(rng.float(80, 12000) / 10) * 10 : Math.round(rng.float(80, 12000))) : Math.round(rng.float(15, 2500) * 10) / 10)
    const usedMemo = new Set<string>()
    const usedVal = new Set<number>()
    const rows: Row[] = []
    let t = dayTime(rng)
    for (let i = 0; i < n; i++) {
      let memo = String(rng.int(100000, 999999999))
      while (usedMemo.has(memo)) memo = String(rng.int(100000, 999999999))
      usedMemo.add(memo)
      let v = amount()
      while (usedVal.has(v)) v = amount()
      usedVal.add(v)
      t += rng.int(12, 200) * 60
      rows.push({ from: genAddress(rng, 'ton', 'ton_wallet'), to: shared, value: v, asset, memo, method, time: t, toLabel: sharedLabel })
    }
    const k = rng.int(1, n - 2)
    const target = rows[k]

    if (variant === 'amount') {
      // Leurres : même montant à une autre heure, et une opération quelques minutes plus tard d'un autre montant.
      const sameAmount = rng.pick(rows.filter((_, i) => Math.abs(i - k) > 1))
      sameAmount.value = target.value
      const near = rows[k + 1]
      near.time = target.time! + rng.int(2, 9) * 60
      for (let i = k + 2; i < n; i++) if (rows[i].time! <= rows[i - 1].time!) rows[i].time = rows[i - 1].time! + rng.int(12, 60) * 60
      const when = parisTime(target.time!)
      return {
        prompt: `Une capture d'écran trouvée dans le téléphone du suspect montre un envoi de ${frMax(target.value, 2)} ${asset} vers ${svc}, le ${when} (heure de Paris). L'adresse d'envoi y est illisible. Quel commentaire faut-il indiquer à ${svc} pour identifier le compte destinataire ?`,
        context: `Transactions entrantes sur l'adresse partagée ${de(svc)} (TON). La colonne « Tag / méthode » affiche le commentaire de chaque transaction.`,
        visual: { type: 'transfers', chain: 'ton', rows },
        kind: 'text',
        answer: target.memo!,
        explain: `Deux critères à croiser : le montant ET l'heure. Le montant de ${frMax(target.value, 2)} ${asset} apparaît deux fois (${parisTime(sameAmount.time!)} et ${when}) ; à ${parisTime(near.time!)}, quelques minutes plus tard, c'est un autre montant. Seule la transaction de ${when} remplit les deux conditions : son commentaire est ${target.memo}.\n\nSur l'adresse partagée, tous les clients de ${svc} déposent au même endroit : l'adresse seule ne désigne personne. C'est le commentaire (memo), saisi par le client à la demande du service, qui permet d'attribuer le dépôt à un compte — comme le destination tag sur XRP. La réquisition doit donc mentionner l'adresse partagée, le commentaire ${target.memo}, le hash de la transaction, la date et le montant.`,
      }
    }

    // sender
    const others = rows.filter((r) => r !== target)
    return {
      prompt: `Le portefeuille TON du suspect, extrait de son téléphone, a pour adresse :\n${target.from}\nQuel commentaire identifie son compte chez ${svc} ?`,
      context: `Transactions entrantes sur l'adresse partagée ${de(svc)}. La colonne « Tag / méthode » affiche le commentaire de chaque transaction.`,
      visual: { type: 'transfers', chain: 'ton', rows },
      kind: 'text',
      answer: target.memo!,
      explain: `La transaction envoyée depuis ${shortAddr(target.from, 8)} (${frMax(target.value, 2)} ${asset}, le ${parisTime(target.time!)}) porte le commentaire ${target.memo} : c'est l'identifiant du compte client à communiquer à ${svc}.\n\nLes ${others.length} autres commentaires (${frList(others.map((r) => r.memo!))}) désignent d'autres clients du service, qui déposent tous sur la même adresse partagée : ne jamais demander « le titulaire de l'adresse » à ${svc}, la réponse serait « nous-mêmes ». Un dépôt arrivé sans commentaire reste non attribué jusqu'à une réclamation du client — ce qui laisse aussi une trace exploitable.`,
    }
  },
}

// ── Ponzi ────────────────────────────────────────────────────────────────────

const PONZI_NAMES = ['YieldNova', 'RentaChain', 'StakeAura', 'NovaRente']

export interface PonziTruth {
  payouts: number
  revenue: number
  share: number
  organizer: string
}

function buildPonzi(rng: ReturnType<typeof rngFor>, withRevenue: boolean, labelled: boolean) {
  const name = rng.pick(PONZI_NAMES)
  const n = rng.int(4, 6)
  const inv = Array.from({ length: n }, () => genAddress(rng, 'tron', 'eoa'))
  const collector = genAddress(rng, 'tron', 'eoa')
  const organizer = genAddress(rng, 'tron', 'eoa')
  const exchangeHot = genAddress(rng, 'tron', 'eoa')
  const collLabel = `${name} — adresse de collecte`
  const invLabel = (i: number) => (labelled ? `Investisseur ${i + 1}` : undefined)
  const rows: Row[] = []
  const dep: number[] = []
  const paidTo = new Map<number, number>()
  let balance = 0
  let payouts = 0
  let t = dayTime(rng)
  for (let i = 0; i < n; i++) {
    t += rng.int(1, 3) * DAY + rng.int(0, 8 * H)
    const d = Math.round(rng.float(500, 6000) / 50) * 50
    dep.push(d)
    balance += d
    rows.push({ from: inv[i], to: collector, value: d, asset: 'USDT', time: t, fromLabel: invLabel(i), toLabel: collLabel })
    if (i === 0) continue
    // Après chaque nouveau dépôt, des « rendements » sont versés à des investisseurs antérieurs.
    const nPay = rng.chance(0.3) && i >= 2 ? 2 : 1
    const who = rng.shuffle(Array.from({ length: i }, (_, j) => j)).slice(0, nPay)
    let tp = t
    for (const j of who) {
      const amt = Math.round((dep[j] * rng.float(0.12, 0.3)) / 10) * 10
      if (amt > balance - 10) continue
      tp += rng.int(1, 10) * H
      balance -= amt
      payouts += amt
      paidTo.set(j, (paidTo.get(j) ?? 0) + amt)
      rows.push({ from: collector, to: inv[j], value: amt, asset: 'USDT', time: tp, method: 'rendement', fromLabel: collLabel, toLabel: invLabel(j) })
    }
    t = tp
  }
  let revenue = 0
  if (withRevenue) {
    revenue = Math.max(10, Math.round((payouts * rng.float(0.05, 0.4)) / 10) * 10)
    const firstPay = rows.find((r) => r.from === collector)!
    const tr = rows[0].time! + Math.round((firstPay.time! - rows[0].time!) * rng.float(0.2, 0.8))
    rows.push({ from: exchangeHot, to: collector, value: revenue, asset: 'USDT', time: tr, fromLabel: 'Exchange — hot wallet (« revenus de trading » selon la plateforme)', toLabel: collLabel })
    balance += revenue
  }
  // Extraction finale par l'organisateur, en une ou deux fois.
  const nExt = rng.chance(0.4) ? 2 : 1
  let extracted = 0
  for (let e = 0; e < nExt; e++) {
    t += rng.int(6, 48) * H
    const amt = Math.round((balance * (e === nExt - 1 ? rng.float(0.75, 0.95) : rng.float(0.35, 0.6))) / 10) * 10
    balance -= amt
    extracted += amt
    rows.push({ from: collector, to: organizer, value: amt, asset: 'USDT', time: t, fromLabel: collLabel, toLabel: labelled ? 'Portefeuille non identifié' : undefined })
  }
  rows.sort((a, b) => a.time! - b.time!)
  if (!labelled) for (const r of rows) if (r.method === 'rendement') delete r.method
  const deposits = dep.reduce((s, x) => s + x, 0)
  return { name, n, inv, collector, organizer, rows, dep, paidTo, payouts, revenue, deposits, extracted }
}

export const ponziFlow: DrillDef = {
  id: 'ponzi-flow',
  title: 'Flux d\'un Ponzi',
  description: 'Reconnaître dans les flux d\'une adresse de collecte la signature d\'un schéma de Ponzi : rendements payés avec les dépôts des suivants, puis extraction par l\'organisateur.',
  level: 2,
  track: 'typologies',
  icon: 'Pyramid',
  generate(seed) {
    const rng = rngFor(seed, 'ponzi-flow')
    const variant = rng.weighted([['signature', 2], ['share', 3], ['organizer', 3]] as const)
    const p = buildPonzi(rng, variant === 'share', variant !== 'organizer')
    const visual: DrillVisual = { type: 'transfers', chain: 'tron', rows: p.rows }
    const S = (a: string) => shortAddr(a, 8)

    if (variant === 'share') {
      const share = Math.round(((p.payouts - p.revenue) / p.payouts) * 1000) / 10
      const payRows = p.rows.filter((r) => r.from === p.collector && r.to !== p.organizer)
      return {
        prompt: `En retenant l'hypothèse la plus favorable à ${p.name} — ses « revenus de trading » ont servi en priorité à payer les investisseurs — quelle part des « rendements » versés a nécessairement été financée par les dépôts des investisseurs ?`,
        context: 'Toutes les opérations de l\'adresse de collecte (USDT sur Tron, solde initial nul) figurent ci-dessous. Arrondissez à 0,1 %.',
        visual,
        kind: 'number',
        answer: share,
        tolerance: 0.01,
        unit: '%',
        explain: `Sommes versées aux investisseurs (« rendements ») : ${payRows.map((r) => fr(r.value)).join(' + ')} = ${fr(p.payouts)} USDT. Seule source extérieure : ${fr(p.revenue)} USDT venus d'un exchange. Même en supposant que tout ce revenu a servi aux versements, il reste ${fr(p.payouts)} − ${fr(p.revenue)} = ${fr(p.payouts - p.revenue)} USDT qui n'ont pu être payés qu'avec l'argent déposé par les investisseurs, soit ${fr(p.payouts - p.revenue)} / ${fr(p.payouts)} = ${frMax(share, 1)} %. Un « rendement » payé avec les dépôts n'est pas un rendement : c'est la signature d'un Ponzi.\n\nLes versements à l'organisateur (${fr(p.extracted)} USDT) ne sont pas des rendements : ils sont exclus du calcul. Pour aller plus loin, réquisitionnez l'exchange pour vérifier l'origine des prétendus « revenus de trading » : bien souvent, ce sont des fonds de l'organisateur réinjectés pour entretenir l'illusion.`,
      }
    }

    if (variant === 'organizer') {
      const paid = [...p.paidTo.keys()]
      const early = paid.sort((a, b) => (p.paidTo.get(b) ?? 0) - (p.paidTo.get(a) ?? 0))[0]
      const last = p.n - 1
      const others = p.inv.map((_, i) => i).filter((i) => i !== early && i !== last)
      const d = [S(p.inv[early]), S(p.inv[last]), S(p.inv[rng.pick(others)]), S(p.collector)]
      const { options, answer } = mkChoice(rng, S(p.organizer), d.slice(0, 2).concat(rng.shuffle(d.slice(2))), 4)
      return {
        prompt: `Quelle adresse correspond vraisemblablement à l'organisateur qui encaisse les fonds de ${p.name} ?`,
        context: `Opérations de l'adresse de collecte de la plateforme (USDT sur Tron). Les autres adresses ne sont pas encore identifiées.`,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `${S(p.organizer)} reçoit ${fr(p.extracted)} USDT de l'adresse de collecte ${p.rows.filter((r) => r.to === p.organizer).length > 1 ? 'en deux fois ' : ''}après l'arrêt des dépôts, sans y avoir jamais rien déposé : ce n'est pas un investisseur qui touche des rendements, c'est l'extraction du solde. Elle représente ${frMax((p.extracted / p.deposits) * 100, 1)} % des ${fr(p.deposits)} USDT déposés.\n\nToutes les autres adresses (hors adresse de collecte) ont d'abord déposé : ce sont des investisseurs. ${S(p.inv[early])} est celle qui a le plus reçu, mais seulement de petits versements après son dépôt : un investisseur « payé » avec l'argent des suivants, souvent le meilleur ambassadeur de l'arnaque et une victime à entendre. ${S(p.inv[last])}, dernier entrant, n'a rien reçu. ${S(p.collector)} est l'adresse de collecte elle-même.\n\nSuite logique : suivre ${S(p.organizer)} vers son point de sortie (exchange, OTC) pour une réquisition et un gel.`,
      }
    }

    // signature
    const correct = 'Les « rendements » versés aux premiers investisseurs proviennent des dépôts des investisseurs suivants, sans aucune source de revenus extérieure'
    const d = [
      'Les dépôts sont en USDT sur Tron, réseau prisé des escrocs',
      'Les rendements sont proportionnels aux dépôts, preuve d\'une activité d\'investissement réelle',
      'Les premiers investisseurs ont reçu de l\'argent : la plateforme est donc rentable',
      'Les montants déposés sont ronds, signe de victimes manipulées',
    ]
    const { options, answer } = mkChoice(rng, correct, rng.shuffle(d), 4)
    const firstPay = p.rows.find((r) => r.method === 'rendement')!
    return {
      prompt: `Quel constat, tiré de ces flux, caractérise un schéma de Ponzi chez ${p.name} ?`,
      context: 'Toutes les opérations de l\'adresse de collecte (USDT sur Tron, solde initial nul).',
      visual,
      kind: 'choice',
      options,
      answer,
      explain: `L'adresse de collecte ne reçoit que des dépôts d'investisseurs : aucune entrée ne provient d'une activité (trading, prêt, staking). Chaque « rendement » — le premier, ${fr(firstPay.value)} USDT, part le ${parisTime(firstPay.time!)} — suit l'arrivée d'un nouveau dépôt et ne peut être payé qu'avec lui. Au total, ${fr(p.payouts)} USDT de rendements sur ${fr(p.deposits)} USDT déposés, puis ${fr(p.extracted)} USDT partent vers un portefeuille qui n'a jamais investi : l'organisateur.\n\nLes autres constats ne prouvent rien : l'USDT sur Tron sert aussi à des usages légitimes ; des versements proportionnels aux dépôts, c'est justement ce que promet un Ponzi ; le fait que les premiers soient payés est le moteur du schéma, pas une preuve de rentabilité ; des montants ronds sont banals.`,
    }
  },
}

// ── L2 : bridge canonique ────────────────────────────────────────────────────

export const l2Withdrawal: DrillDef = {
  id: 'l2-withdrawal',
  title: 'Retrait d\'un L2',
  description: 'Bridges canoniques d\'Arbitrum et de Base : dépôt crédité en minutes, retrait bloqué environ 7 jours (période de contestation), transaction de finalisation et fenêtre d\'action pour l\'enquêteur.',
  level: 3,
  track: 'comptes',
  icon: 'Layers',
  generate(seed) {
    const rng = rngFor(seed, 'l2-withdrawal')
    const variant = rng.weighted([['claim', 3], ['finalize', 3], ['freeze', 2.5], ['deposit', 2]] as const)
    const l2: ChainId = rng.chance(0.5) ? 'arb' : 'base'
    const isArb = l2 === 'arb'
    const L2 = isArb ? 'Arbitrum One' : 'Base'
    const bridge = isArb ? 'Arbitrum Bridge' : 'Base Bridge'
    const user = genAddress(rng, 'eth', 'eoa')
    const l1Gw = genAddress(rng, 'eth', 'contract')
    const l2Gw = genAddress(rng, l2, 'contract')
    const l1GwLabel = isArb ? 'Arbitrum Bridge — contrat L1 (Ethereum)' : 'Base — OptimismPortal (Ethereum)'
    const l2GwLabel = isArb ? 'Arbitrum Bridge — passerelle L2 (Arbitrum)' : 'Base — L2StandardBridge (Base)'
    const v = Math.round(rng.float(0.5, 40) * 100) / 100
    const tInit = dayTime(rng)
    const tProve = tInit + rng.int(1, 4) * H + rng.int(0, 59) * 60
    const claimable = (isArb ? tInit : tProve) + 7 * DAY
    const tFinal = claimable + rng.int(1, 30) * H + rng.int(0, 59) * 60
    const initRow: Row = { from: user, to: l2Gw, value: v, asset: 'ETH', method: isArb ? 'withdrawEth' : 'withdraw', time: tInit, fromLabel: `Suspect — ${L2}`, toLabel: l2GwLabel }
    const proveRow: Row = { from: user, to: l1Gw, value: 0, asset: 'ETH', method: 'proveWithdrawalTransaction', time: tProve, fromLabel: 'Suspect — Ethereum', toLabel: l1GwLabel }
    const finalRow: Row = { from: l1Gw, to: user, value: v, asset: 'ETH', method: isArb ? 'executeTransaction' : 'finalizeWithdrawalTransaction', time: tFinal, fromLabel: l1GwLabel, toLabel: 'Suspect — Ethereum' }
    const steps = isArb
      ? `Sur Arbitrum, un retrait se fait en deux temps : initiation sur le L2 (withdrawEth), puis, une fois la période de contestation écoulée (environ 7 jours, le temps que l'état publié sur Ethereum devienne définitif), exécution sur Ethereum (executeTransaction sur le contrat Outbox).`
      : `Sur Base (OP Stack), un retrait se fait en trois temps : initiation sur le L2 (withdraw), preuve sur Ethereum (proveWithdrawalTransaction) dès que l'état du L2 y a été publié, puis finalisation (finalizeWithdrawalTransaction) une fois écoulée la période de contestation d'environ 7 jours comptée à partir de la preuve.`
    const whyDelay = 'Ce délai vient du modèle « optimiste » : Ethereum accepte l\'état publié par le rollup sans le vérifier, mais laisse environ une semaine à quiconque pour prouver qu\'il est frauduleux. Il protège l\'intégrité du rollup ; il ne permet à personne de bloquer un retrait légitime au regard du protocole. À l\'inverse, un dépôt Ethereum → L2 est crédité en quelques minutes : le L2 se contente de lire Ethereum.'

    if (variant === 'claim') {
      const correct = `À partir du ${parisDay(claimable)} environ : à la fin de la période de contestation d'environ 7 jours${isArb ? '' : ' comptée depuis la preuve'}`
      const d = rng.shuffle([
        `Dès le ${parisDay(tInit)}, une dizaine de minutes après l'initiation, comme pour un dépôt`,
        `À partir du ${parisDay(tInit + DAY)} : il faut attendre 144 blocs de confirmation`,
        `À partir du ${parisDay(tInit + 30 * DAY)} : les bridges canoniques bloquent les retraits un mois`,
        `Jamais sans la validation manuelle de l'opérateur de ${bridge}, qui examine chaque retrait`,
      ])
      const { options, answer } = mkChoice(rng, correct, d, 4)
      return {
        prompt: `Le suspect a initié ce retrait de ${frMax(v, 2)} ETH depuis ${L2} vers Ethereum. À partir de quand, au plus tôt, pourra-t-il disposer des ETH sur Ethereum ?`,
        context: isArb ? 'Opérations relevées sur Arbiscan.' : 'Opérations relevées sur Basescan et Etherscan.',
        visual: { type: 'transfers', chain: l2, rows: isArb ? [initRow] : [initRow, proveRow] },
        kind: 'choice',
        options,
        answer,
        explain: `${steps} Initié le ${parisTime(tInit)}${isArb ? '' : `, prouvé le ${parisTime(tProve)}`}, le retrait ne pourra être finalisé qu'à partir du ${parisTime(claimable)} environ.\n\n${whyDelay} Aucun opérateur ne valide les retraits un par un, et il n'existe ni délai de 144 blocs ni blocage d'un mois.`,
      }
    }

    if (variant === 'finalize') {
      const tDep = tInit - rng.int(5, 40) * DAY
      const depRow: Row = { from: user, to: l1Gw, value: Math.round(v * rng.float(1.05, 1.6) * 100) / 100, asset: 'ETH', method: isArb ? 'depositEth' : 'depositTransaction', time: tDep, fromLabel: 'Suspect — Ethereum', toLabel: l1GwLabel }
      const rows = isArb ? [depRow, initRow, finalRow] : [depRow, initRow, proveRow, finalRow]
      const desc = (r: Row) => `${r.method} du ${parisTime(r.time!)}`
      const correct = desc(finalRow)
      const d = [desc(initRow), ...(isArb ? [] : [desc(proveRow)]), desc(depRow), `Aucune : les fonds restent sur ${L2} tant que l'opérateur du bridge ne les a pas libérés`]
      const { options, answer } = mkChoice(rng, correct, d, isArb ? 4 : 5)
      return {
        prompt: 'Quelle opération remet effectivement les ETH à la disposition du suspect sur Ethereum ?',
        context: `Historique de l'adresse ${shortAddr(user, 8)}, identique sur Ethereum et sur ${L2} (même compte 0x).`,
        visual: { type: 'transfers', chain: l2, rows },
        kind: 'choice',
        options,
        answer,
        explain: `${steps}\n\nC'est donc ${finalRow.method} (${parisTime(tFinal)}) qui fait sortir ${frMax(v, 2)} ETH du contrat du bridge vers l'adresse du suspect sur Ethereum : c'est à partir de cette transaction que le traçage reprend sur la L1. ${initRow.method} ne fait que brûler les ETH sur le L2 et créer le message de retrait${isArb ? '' : ' ; proveWithdrawalTransaction ne transfère rien (valeur 0) : il prouve l\'existence du retrait et lance le compte à rebours'}. ${depRow.method} est le dépôt initial, en sens inverse (Ethereum → ${L2}). Aucun opérateur ne « libère » les fonds : n'importe qui peut finaliser une fois le délai écoulé, en pratique l'utilisateur lui-même — et l'adresse qui paie le gas de la finalisation est elle aussi une trace.`,
      }
    }

    if (variant === 'freeze') {
      const elapsed = rng.int(1, 5)
      const now = tInit + elapsed * DAY + rng.int(1, 6) * H
      const remaining = Math.max(1, Math.round((claimable - now) / DAY))
      const correct = `Profiter des quelque ${remaining} jour${remaining > 1 ? 's' : ''} restants : surveiller l'adresse de destination sur Ethereum et préparer gel ou réquisition auprès du service où les fonds iront ensuite`
      const d = rng.shuffle([
        `Réquisitionner ${bridge} pour faire annuler le retrait : l'opérateur peut le bloquer sur simple demande`,
        'Contester le retrait pendant la période de contestation en signalant l\'origine frauduleuse des fonds',
        'Rien à faire : les fonds sont déjà disponibles sur Ethereum depuis l\'initiation',
      ])
      const { options, answer } = mkChoice(rng, correct, d, 4)
      return {
        prompt: `Nous sommes le ${parisTime(now)}. Ce retrait de ${frMax(v, 2)} ETH, issu d'une escroquerie, vient d'être repéré. Quelle est la meilleure exploitation de la situation ?`,
        context: `Destinataire du retrait : la même adresse ${shortAddr(user, 8)} sur Ethereum (choix par défaut).`,
        visual: { type: 'transfers', chain: l2, rows: isArb ? [initRow] : [initRow, proveRow] },
        kind: 'choice',
        options,
        answer,
        explain: `${steps} Les fonds ne seront pas disponibles sur Ethereum avant le ${parisTime(claimable)} environ, soit dans environ ${remaining} jour${remaining > 1 ? 's' : ''}. C'est une fenêtre rare : on connaît à l'avance l'adresse d'arrivée (ici la même adresse 0x) et le montant. Mettre l'adresse sous surveillance, préparer les réquisitions et prévenir les exchanges susceptibles de recevoir les fonds permet d'agir dès la finalisation.\n\nLe bridge canonique est un ensemble de smart contracts, pas un service qui gèle sur réquisition. La « contestation » ne vise que les états frauduleux du rollup (preuve de fraude technique), pas l'origine criminelle des fonds. Et tant que la finalisation n'a pas eu lieu, rien n'est disponible sur Ethereum. Un suspect pressé évite d'ailleurs ce délai en passant par un bridge tiers « rapide » : l'usage du bridge canonique est une chance pour l'enquête.`,
      }
    }

    // deposit
    const depRow: Row = { from: user, to: l1Gw, value: v, asset: 'ETH', method: isArb ? 'depositEth' : 'depositTransaction', time: tInit, fromLabel: 'Suspect — Ethereum', toLabel: l1GwLabel }
    const correct = `Sur ${L2}, ${isArb ? 'une dizaine de minutes' : 'quelques minutes'} plus tard, par défaut à la même adresse 0x (destinataire à vérifier dans les paramètres du dépôt)`
    const d = rng.shuffle([
      'Nulle part pendant 7 jours : un dépôt reste bloqué pendant la période de contestation',
      `Chez ${bridge}, service custodial qui détient désormais les fonds : il faut le réquisitionner`,
      'Sur Ethereum uniquement : le contrat du bridge est une adresse de dépôt d\'exchange',
    ])
    const { options, answer } = mkChoice(rng, correct, d, 4)
    return {
      prompt: `Le suspect a envoyé ces ${frMax(v, 2)} ETH au bridge canonique ${de(L2)}. Où et quand poursuivre le traçage ?`,
      context: 'Transaction relevée sur Etherscan.',
      visual: { type: 'transfers', chain: 'eth', rows: [depRow] },
      kind: 'choice',
      options,
      answer,
      explain: `Un dépôt Ethereum → ${L2} par le bridge canonique est crédité sur le L2 en ${isArb ? 'une dizaine de minutes' : 'quelques minutes'} : le L2 lit les messages déposés sur Ethereum et crédite le destinataire (${isArb ? 'finalizeInboundTransfer / crédit direct' : 'finalizeDeposit'}). Sauf choix contraire de l'utilisateur, c'est la même adresse 0x : même clé privée, même compte sur les deux chaînes. On poursuit donc sur ${isArb ? 'Arbiscan' : 'Basescan'}, à partir de ${shortAddr(user, 8)}.\n\nLe délai de 7 jours ne concerne que le sens inverse (retrait ${L2} → Ethereum). Le bridge canonique n'est pas un service custodial : les ETH sont verrouillés dans un smart contract qui n'obéit qu'à son code. Et ce n'est évidemment pas une adresse d'exchange.`,
    }
  },
}

// ── Wash trading de NFT ──────────────────────────────────────────────────────

const COLLECTIONS = ['PIXL', 'MOSA', 'ORBS', 'KOIA', 'GLYF']

export const washTrade: DrillDef = {
  id: 'wash-trade',
  title: 'Wash trading de NFT',
  description: 'Repérer dans des ventes de NFT les échanges fictifs entre portefeuilles d\'une même personne : financement commun, jeton qui tourne en boucle, prix gonflé.',
  level: 3,
  track: 'typologies',
  icon: 'Repeat2',
  generate(seed) {
    const rng = rngFor(seed, 'wash-trade')
    const variant = rng.weighted([['wallets', 3], ['token', 2.5], ['indicator', 2], ['volume', 2]] as const)
    const chain: ChainId = rng.chance(0.7) ? 'eth' : 'base'
    const market = genAddress(rng, chain, 'contract')
    const marketLabel = 'Mosaïque Market — contrat'
    const coll = rng.pick(COLLECTIONS)
    const L = rng.shuffle(LETTERS.slice(0, 12))
    const k = rng.pick([2, 3, 3])
    const ring = L.slice(0, k)
    const F = L[k]
    const [D, E, G, Hh, J] = L.slice(k + 1, k + 6)
    const addr = new Map<string, string>(L.map((l) => [l, genAddress(rng, chain, 'eoa')]))
    const lab = (l: string) => `Portefeuille ${l}`
    const ids = new Set<number>()
    const newId = () => {
      let x = rng.int(100, 9999)
      while (ids.has(x)) x = rng.int(100, 9999)
      ids.add(x)
      return x
    }
    const W = newId()
    const T1 = newId()
    const T2 = newId()
    const p2 = (x: number) => Math.round(x * 100) / 100

    // Ventes fictives : le jeton tourne dans l'anneau et revient au départ, à prix croissant.
    const washSeq: [string, string][] = k === 3 ? [[ring[0], ring[1]], [ring[1], ring[2]], [ring[2], ring[0]]] : [[ring[0], ring[1]], [ring[1], ring[0]], [ring[0], ring[1]]]
    let price = p2(rng.float(0.2, 1.2))
    const wash = washSeq.map(([s, b]) => {
      const sale = { seller: s, buyer: b, token: W, price }
      price = p2(price * rng.float(1.3, 1.9))
      return sale
    })
    const legit = [
      [{ seller: D, buyer: E, token: T1, price: p2(rng.float(0.2, 1.5)) }, { seller: E, buyer: G, token: T1, price: p2(rng.float(0.2, 1.8)) }],
      [{ seller: Hh, buyer: J, token: T2, price: p2(rng.float(0.2, 1.5)) }],
    ]
    // Fusion aléatoire des trois séquences en conservant l'ordre interne de chacune.
    const queues = [wash, ...legit].map((q) => [...q])
    const order: typeof wash = []
    while (queues.some((q) => q.length)) {
      const q = rng.pick(queues.filter((x) => x.length))
      order.push(q.shift()!)
    }
    const rows: Row[] = []
    let t = dayTime(rng)
    // Financement de l'anneau par F.
    const need = new Map<string, number>()
    for (const s of wash) need.set(s.buyer, (need.get(s.buyer) ?? 0) + s.price)
    for (const r of ring) {
      t += rng.int(10, 180) * 60
      rows.push({ from: addr.get(F)!, to: addr.get(r)!, value: p2((need.get(r) ?? 0.1) + rng.float(0.02, 0.15)), asset: 'ETH', method: 'transfer', time: t, fromLabel: lab(F), toLabel: lab(r) })
    }
    const legitFunding = rng.chance(0.5)
    if (legitFunding) {
      t += rng.int(10, 180) * 60
      rows.push({ from: genAddress(rng, chain, 'eoa'), to: addr.get(E)!, value: p2(legit[0][0].price + rng.float(0.05, 0.3)), asset: 'ETH', method: 'transfer', time: t, fromLabel: 'Coinbase — hot wallet', toLabel: lab(E) })
    }
    for (const s of order) {
      t += rng.int(3, 30) * H
      rows.push({ from: addr.get(s.buyer)!, to: market, value: s.price, asset: 'ETH', method: 'matchOrders', time: t, fromLabel: lab(s.buyer), toLabel: marketLabel })
      rows.push({ from: addr.get(s.seller)!, to: addr.get(s.buyer)!, value: 1, asset: coll, method: `transferFrom (tokenId ${s.token})`, time: t, fromLabel: lab(s.seller), toLabel: lab(s.buyer) })
    }
    const giveBack = rng.chance(0.6)
    if (giveBack) {
      const last = wash[wash.length - 1].seller
      t += rng.int(2, 20) * H
      rows.push({ from: addr.get(last)!, to: addr.get(F)!, value: p2(wash[wash.length - 1].price * rng.float(0.8, 0.95)), asset: 'ETH', method: 'transfer', time: t, fromLabel: lab(last), toLabel: lab(F) })
    }
    const visual: DrillVisual = { type: 'transfers', chain, rows }
    const ringSorted = [...ring].sort()
    const volume = p2(wash.reduce((s, x) => s + x.price, 0))
    const context = `Ventes de la collection ${coll} sur Mosaïque Market (${chain === 'eth' ? 'Ethereum' : 'Base'}). Chaque vente = deux lignes à la même heure : le paiement de l'acheteur au contrat (matchOrders) et le transfert du NFT du vendeur à l'acheteur.`
    const loop = `${wash.map((s) => s.seller).join(' → ')} → ${wash[wash.length - 1].buyer}`
    const core = `Le tokenId ${W} passe de ${loop} : il revient à son point de départ, et son prix grimpe de ${frMax(wash[0].price, 2)} à ${frMax(wash[wash.length - 1].price, 2)} ETH. Or ${frList(ringSorted)} ont ${k === 2 ? 'tous deux' : 'tous'} été financés juste avant par le même portefeuille ${F}${giveBack ? `, vers lequel le produit de la dernière vente repart` : ''}. Acheteurs et vendeurs sont donc vraisemblablement une seule et même personne : les ventes sont fictives (wash trading).`
    const legitTxt = `À l'inverse, le tokenId ${T1} est revendu (${D} → ${E} → ${G}) entre portefeuilles sans financement commun ni retour au point de départ, et le tokenId ${T2} n'est vendu qu'une fois (${Hh} → ${J})${legitFunding ? ` ; ${E} est alimenté par un hot wallet d'exchange, qui finance des milliers de clients sans lien entre eux` : ''}.`
    const purpose = 'Buts habituels : gonfler le prix plancher et le volume pour attirer de vrais acheteurs, capter des récompenses de la place de marché, ou fabriquer une origine apparente (« j\'ai vendu un NFT ») à des fonds illicites.'

    if (variant === 'wallets') {
      const d = rng.shuffle([
        frList([...ring, F].sort()),
        frList([D, E, G].sort()),
        frList([...ring, rng.pick([E, J])].sort()),
        ...(k === 3 ? [frList(ringSorted.slice(0, 2))] : [frList([...ring, D].sort())]),
      ])
      const { options, answer } = mkChoice(rng, frList(ringSorted), d, 4)
      return {
        prompt: 'Quels portefeuilles se revendent entre eux le même NFT (ventes fictives) ?',
        context,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `${core}\n\n${F} finance l'opération mais n'achète ni ne vend aucun NFT : il fait partie du montage, pas des ventes. ${legitTxt}\n\n${purpose}`,
      }
    }

    if (variant === 'token') {
      const NONE = 'Aucun : toutes les ventes passent par le contrat de la place de marché, elles sont donc réelles'
      const { options, answer } = mkChoice(rng, `tokenId ${W}`, rng.shuffle([`tokenId ${T1}`, `tokenId ${T2}`]).concat(NONE), 4)
      return {
        prompt: 'Quel NFT fait l\'objet de ventes fictives (wash trading) ?',
        context,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `${core}\n\n${legitTxt} Passer par le contrat de la place de marché ne prouve rien : c'est le chemin normal de toute vente, fictive ou non.\n\n${purpose}`,
      }
    }

    if (variant === 'indicator') {
      const correct = `Les acheteurs et vendeurs successifs du tokenId ${W} ont été financés par le même portefeuille et le jeton revient à son point de départ`
      const d = rng.shuffle([
        `Le prix du tokenId ${W} augmente à chaque vente`,
        'Les ventes passent par la fonction matchOrders du contrat de la place de marché',
        `Le tokenId ${W} a été vendu plusieurs fois en quelques jours`,
        'Les paiements sont faits en ETH plutôt qu\'en stablecoin',
      ])
      const { options, answer } = mkChoice(rng, correct, d, 4)
      return {
        prompt: `Le tokenId ${W} est soupçonné de wash trading. Quel indicateur est décisif ?`,
        context,
        visual,
        kind: 'choice',
        options,
        answer,
        explain: `${core}\n\nLes autres indices sont insuffisants seuls : un prix qui monte peut refléter un vrai engouement ; matchOrders est la fonction de toute vente sur la place de marché ; plusieurs reventes rapides existent aussi entre vrais collectionneurs (voir le tokenId ${T1}) ; le paiement en ETH est la norme. Ce qui est décisif, c'est le lien entre les contreparties (financement commun, retour des fonds) et la boucle fermée du jeton.`,
      }
    }

    // volume
    return {
      prompt: 'Quel volume d\'échanges (en ETH) les ventes fictives ont-elles ajouté artificiellement à la collection ?',
      context,
      visual,
      kind: 'number',
      answer: volume,
      tolerance: 0.001,
      unit: 'ETH',
      explain: `${core}\n\nVolume fictif = somme des prix payés lors de ces ventes : ${wash.map((s) => frMax(s.price, 2)).join(' + ')} = ${frMax(volume, 2)} ETH. Les ventes du tokenId ${T1} et du tokenId ${T2} sont de vraies ventes et ne comptent pas. Économiquement, la personne derrière l'anneau n'a déboursé que les commissions et le gas : l'argent tourne en rond.\n\n${purpose}`,
    }
  },
}
