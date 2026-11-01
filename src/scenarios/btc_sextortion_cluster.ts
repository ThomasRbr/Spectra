import { World, type Tx } from '../engine/world'
import { exchange, person, swapper, HOUR, DAY } from '../engine/patterns'
import { fromUsd, roundAsset, usd } from '../engine/chains'
import type { AddrKind } from '../engine/addressgen'
import { decoyBranches, dusting } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeName, fmtDate, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
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

export const btcSextortionCluster: ScenarioTemplate = {
  id: 'sextortion-cluster',
  title: 'Campagne de sextorsion',
  tagline: 'Des centaines de mails, quelques adresses, un seul portefeuille : le clustering à l\'œuvre.',
  description:
    'Une vague de courriels de « sextorsion » exige des paiements en bitcoins. Chaque mail contient une adresse différente, et chaque adresse reçoit les paiements de dizaines de victimes, étalés sur des semaines. Utilisez l\'heuristique des entrées communes (CIOH) pour reconstituer le portefeuille de la campagne, écartez la campagne concurrente qui copie le même modèle, comptez les victimes en triant poussière et paiements tardifs, identifiez le loueur de l\'infrastructure d\'envoi, la plateforme de sortie et le second point de sortie du reliquat.',
  difficulty: 2,
  chains: ['btc'],
  skills: ['cioh', 'utxo', 'typologies', 'exchange_id'],
  estMinutes: 55,
  lessons: ['utxo', 'clustering', 'typologies', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimName = fakeName(r)
    const city = fakeCity(r)

    const cv = exchange(w, 'coinhouse', 'btc')
    const bitstamp = exchange(w, 'bitstamp', 'btc')
    const outKey = r.pick(['huobex', 'okx', 'binance'] as const)
    const out = exchange(w, outKey, 'btc')

    const scammer = w.customEntity({ name: 'Campagne de sextorsion « Webcam »', category: 'scam' })
    const otherScam = w.customEntity({ name: 'Autre campagne (copie du modèle)', category: 'scam' })
    const spamName = r.pick(['MailStorm', 'InboxRain', 'BulkPhantom', 'SendHydra'])
    const spamE = w.customEntity({ name: `Loueur d'infrastructure d'envoi « ${spamName} » (inconnu)`, category: 'individual' })
    const kind: AddrKind = r.pick(['p2pkh', 'p2wpkh'] as const)
    const n = r.int(4, 6)
    const camp = w.addrs('btc', n, { entity: scammer, kind })
    // Campagne concurrente : même modèle de mail, même type d'adresse, autre portefeuille
    const decoys = w.addrs('btc', 3, { entity: otherScam, kind })
    const [decoy, decoy2] = decoys

    // ── Paiements des victimes ───────────────────────────────────────────────
    // Montants typiques : l'équivalent de 800 à 2 000 $ au cours du jour, réglés depuis un exchange ou un portefeuille personnel.
    const demand = () => roundAsset('BTC', fromUsd('BTC', r.pick([800, 950, 1000, 1200, 1250, 1500, 1800, 2000]) * r.float(0.985, 1.015)))
    const pay = (target: string, t: number, via: string): Tx => {
      const v = demand()
      if (via === 'cv') return cv.withdraw(target, v, t)
      if (via === 'bitstamp') return bitstamp.withdraw(target, v, t)
      return w.utxoTx({ time: t, from: [via], to: [{ address: target, value: v }] })
    }
    const viaRoll = (): 'cv' | 'bitstamp' | 'person' => {
      const roll = r.next()
      return roll < 0.45 ? 'cv' : roll < 0.65 ? 'bitstamp' : 'person'
    }
    const k = r.int(0, n - 1) // adresse reçue par la victime
    // Plan des paiements, exécuté ensuite dans l'ordre chronologique
    type Plan = { t: number; target: string; via: 'cv' | 'bitstamp' | 'person' | 'shared'; plaint?: boolean }
    const plan: Plan[] = []
    for (let i = 0; i < n; i++) {
      const np = i === k ? r.int(8, 11) : r.int(6, 10)
      for (let p = 0; p < np; p++) {
        if (i === k && p === 0) {
          plan.push({ t: w.at(-r.float(1, 2) * 24), target: camp[i], via: 'cv', plaint: true })
          continue
        }
        plan.push({ t: w.at(-r.float(2, 21) * 24), target: camp[i], via: viaRoll() })
      }
    }
    // Une même victime paie la campagne et la campagne concurrente
    plan.push({ t: w.at(-r.float(3, 15) * 24), target: camp[(k + 1) % n], via: 'shared' })
    plan.push({ t: w.at(-r.float(1, 12) * 24), target: decoy, via: 'shared' })
    for (const d of decoys) for (let p = 0; p < r.int(3, 5); p++) plan.push({ t: w.at(-r.float(2, 18) * 24), target: d, via: r.chance(0.5) ? 'cv' : 'person' })
    plan.sort((a, b) => a.t - b.t)
    const sharedVictim = person(w, 'btc', { history: 2, time: plan[0].t })
    let plaintTx: Tx | undefined
    const payments: Tx[] = []
    for (const pl of plan) {
      const via = pl.via === 'person' ? person(w, 'btc', { history: r.int(1, 3), time: pl.t }) : pl.via === 'shared' ? sharedVictim : pl.via
      const tx = pay(pl.target, pl.t, via)
      if (pl.plaint) plaintTx = tx
      if (!decoys.includes(pl.target)) payments.push(tx)
    }

    // ── Campagne concurrente : ses trois adresses sont regroupées entre elles, jamais avec la nôtre ──
    const decoyOut = w.addr('btc', { entity: otherScam })
    const dT = w.at(r.float(30, 70))
    const decoyTotal = decoys.reduce((s, d) => s + w.unspentValue(d, dT), 0)
    const decoyFee = w.estimateFee('btc', decoys.reduce((s, d) => s + w.utxosOf(d, dT).length, 0), 1)
    const decoyCons = w.utxoTx({ time: dT, from: decoys, to: [{ address: decoyOut, value: r8(decoyTotal - decoyFee) }], fee: decoyFee, change: null, spendAll: true, method: 'consolidation' })

    // ── Regroupements (entrées communes) ─────────────────────────────────────
    const consol = w.addr('btc', { entity: scammer, kind: 'p2wpkh' })
    const bridgeIdx = r.int(1, n - 2)
    const g1 = camp.slice(0, bridgeIdx)
    const g2 = camp.slice(bridgeIdx + 1)
    const bridgeAddr = camp[bridgeIdx]
    const largest = Math.max(...w.utxosOf(bridgeAddr).map((u) => u.value))
    const in1 = g1.reduce((s, a) => s + w.unspentValue(a), 0) + largest
    const nIn1 = g1.reduce((s, a) => s + w.utxosOf(a).length, 0) + 1
    const fee1 = w.estimateFee('btc', nIn1, 1)
    const c1 = w.rawUtxoTx({
      time: w.at(r.float(20, 40)),
      spend: [...r.shuffle([...g1.map((a) => ({ address: a })), { address: bridgeAddr, value: largest }])],
      outputs: [{ address: consol, value: r8(in1 - fee1) }],
      method: 'consolidation',
    })
    const in2 = g2.reduce((s, a) => s + w.unspentValue(a), 0) + w.unspentValue(bridgeAddr)
    const nIn2 = g2.reduce((s, a) => s + w.utxosOf(a).length, 0) + w.utxosOf(bridgeAddr).length
    const fee2 = w.estimateFee('btc', nIn2, 1)
    const c2 = w.rawUtxoTx({
      time: c1.time + r.float(30, 90) * HOUR,
      spend: r.shuffle([...g2.map((a) => ({ address: a })), { address: bridgeAddr }]),
      outputs: [{ address: consol, value: r8(in2 - fee2) }],
      method: 'consolidation',
    })

    // ── Paiement de l'infrastructure d'envoi (avant l'encaissement) ─────────
    const spamAddr = w.addr('btc', { entity: spamE, kind: 'p2wpkh' })
    const spamUsd = r.int(4, 9) * 100
    const spamV = roundAsset('BTC', fromUsd('BTC', spamUsd * r.float(0.99, 1.01)))
    const spamTx = w.utxoTx({ time: c2.time + Math.round(r.float(2, 6) * HOUR), from: [consol], to: [{ address: spamAddr, value: spamV }], change: consol })

    // ── Sortie vers l'exchange ───────────────────────────────────────────────
    const deposit = out.newDeposit()
    const kBal = w.unspentValue(consol)
    const depValue = r8(Math.floor(kBal * r.float(0.82, 0.93) * 1000) / 1000)
    const rest = w.addr('btc', { entity: scammer, kind: 'p2wpkh' })
    const cashTx = w.utxoTx({ time: spamTx.time + Math.round(r.float(4, 36) * HOUR), from: [consol], to: [{ address: deposit, value: depValue }], change: rest, spendAll: true })
    const sweep = out.sweep([deposit], cashTx.time + r.float(1, 8) * HOUR)[0]
    const restIn = cashTx.outputs.find((o) => o.address === rest)!.value

    // ── Le reliquat : deux petites branches sans issue, puis un échangeur instantané ──
    const brT = cashTx.time + Math.round(r.float(0.6, 1.5) * DAY)
    const branches = decoyBranches(w, rest, { time: brT, share: r.float(0.18, 0.3), branches: 2 })
    const sw = swapper(w, 'changenow')
    const restBal = w.unspentValue(rest)
    const restOrder = sw.order({
      from: rest, value: r8(Math.floor(restBal * r.float(0.9, 0.96) * 1e5) / 1e5), time: brT + Math.round(r.float(1, 3) * DAY),
      toChain: 'eth', recipient: w.addr('eth'),
    })
    const orderValue = restOrder.depositTx.outputs.find((o) => o.address === restOrder.deposit)!.value

    // ── Habillage (après coup : les regroupements ne sont pas modifiés) ─────
    // Des victimes continuent de payer après les regroupements : ces fonds restent sur les adresses
    const late: Tx[] = []
    for (let i = 0; i < r.int(2, 4); i++) {
      const t = c2.time + Math.round(r.float(0.5, 6) * DAY)
      const v = viaRoll()
      late.push(pay(r.pick(camp), t, v === 'person' ? person(w, 'btc', { history: r.int(1, 2), time: t }) : v))
    }
    // Poussière : des tiers envoient 546 sats à quelques adresses publiées dans les mails
    let dustN = 0
    for (const a of r.pickN(camp, r.int(2, 3))) dustN += dusting(w, a, { time: w.at(-r.float(2, 12) * 24), n: 1, spreadH: 48 }).txs.length
    // Le loueur d'infrastructure reçoit les paiements de nombreux autres clients, puis les regroupe
    for (let i = 0; i < r.int(6, 9); i++) {
      const t = spamTx.time + Math.round(r.float(-30, 15) * DAY)
      const c = w.addr('btc')
      const v = roundAsset('BTC', fromUsd('BTC', r.int(3, 9) * 100 * r.float(0.99, 1.01)))
      w.fund(c, v * r.float(1.1, 2), t - Math.round(r.float(1, 10) * DAY))
      w.utxoTx({ time: t, from: [c], to: [{ address: spamAddr, value: v }] })
    }
    const spamSweepT = spamTx.time + Math.round(r.float(16, 22) * DAY)
    w.utxoTx({ time: spamSweepT, from: [spamAddr], to: [{ address: w.addr('btc', { entity: spamE }), value: r8(w.unspentValue(spamAddr, spamSweepT) * 0.995) }], change: null, spendAll: true })
    const spamClients = w.txsOf(spamAddr).filter((t) => t.outputs.some((o) => o.address === spamAddr)).length

    // ── Bruit ────────────────────────────────────────────────────────────────
    cv.noise(14, w.at(-22 * 24), w.at(6 * 24))
    bitstamp.noise(8, w.at(-22 * 24), w.at(6 * 24))
    out.noise(12, w.at(-3 * 24), w.at(10 * 24))

    // ── Réponses, calculées sur le monde final ───────────────────────────────
    const campSet = new Set(camp)
    const victimPays = camp.flatMap((a) => w.txsOf(a).filter((t) => !t.tags.includes('dust') && t.outputs.some((o) => o.address === a) && !t.inputs.some((i) => campSet.has(i.address))).map((t) => ({ t, a })))
    const nPay = victimPays.length
    const total = r8(victimPays.reduce((s, p) => s + p.t.outputs.filter((o) => o.address === p.a).reduce((x, o) => x + o.value, 0), 0))
    const nFromCv = victimPays.filter((p) => p.t.inputs.some((i) => i.address === cv.hot)).length
    const nFromBs = victimPays.filter((p) => p.t.inputs.some((i) => i.address === bitstamp.hot)).length
    const nLate = late.length
    const lateTotal = r8(late.reduce((s, t) => s + t.outputs.filter((o) => campSet.has(o.address)).reduce((x, o) => x + o.value, 0), 0))
    const plaint = plaintTx!
    const plaintValue = receivedFrom(plaint, camp[k])
    const other = camp[(k + 1 + r.int(0, n - 2)) % n]
    const exName = out.entity.name
    const demandUsd = Math.round(usd('BTC', plaintValue) / 50) * 50
    const pharos = r.shuffle([camp[k], other, decoy, decoy2])
    // Sort de chaque branche, lu dans le monde (les commerçants payés sont tirés au hasard)
    const spentTo = (b: (typeof branches)[number]) => {
      const shops = new Set<string>()
      let people = 0
      for (const tx of b.follow) for (const o of tx.outputs) {
        if (o.address === b.address) continue
        const e = w.get(o.address).entityId
        if (e) shops.add(w.entities.get(e)!.name)
        else people++
      }
      const parts = [...(shops.size ? [[...shops].join(', ')] : []), ...(people ? [people > 1 ? `${people} particuliers` : 'un particulier'] : [])]
      return parts.join(' et ')
    }
    const fateTxt = (b: (typeof branches)[number]) => (b.fate === 'dort' ? 'n\'a plus bougé' : b.fate === 'dépensée' ? `a ensuite payé ${spentTo(b)}` : b.fate === 'éclatée' ? `est ré-éclatée en ${b.follow.length} petites sommes vers des adresses inconnues` : 'repart vers une autre adresse')
    const branchTxt = branches.map((b) => `${amt(b.value, 'BTC')} vers ${A(w, b.address).slice(0, 14)}… (qui ${fateTxt(b)})`).join(' et ')
    const firstPayT = Math.min(...victimPays.map((p) => p.t.time))
    const lastBeforeT = Math.max(...payments.map((p) => p.time))
    const spreadWeeks = Math.round((lastBeforeT - firstPayT) / (7 * DAY))
    const pharosT = w.at(3 * 24)
    const pharosWeeks = Math.round((pharosT - firstPayT) / (7 * DAY))

    return {
      world: w,
      title: `Sextorsion de masse — ${city}`,
      briefing:
        `${victimName} (${city}) a reçu un courriel affirmant que sa webcam avait été piratée et menaçant de diffuser une vidéo intime à ses contacts. Sous le coup de la panique, la victime a payé la somme exigée en bitcoins depuis son compte Coinhouse.\n\n` +
        `PHAROS signale une campagne massive : des milliers de destinataires, le même texte, mais des adresses Bitcoin qui varient d'un envoi à l'autre. Chacune reçoit les paiements de nombreuses victimes, étalés sur des semaines. Ces adresses semblent n'avoir aucun lien entre elles… jusqu'à ce que l'escroc les dépense. Attention : le modèle de courriel circule et d'autres groupes l'utilisent.\n\n` +
        `Objectifs : reconstituer l'ensemble des adresses de la campagne par clustering, écarter celles d'une campagne concurrente, chiffrer le nombre de paiements et le montant total versé par les victimes, préparer l'identification des autres victimes, identifier le loueur de l'infrastructure d'envoi et la plateforme de sortie, puis suivre le reliquat jusqu'à son second point de sortie.`,
      evidence: [
        {
          id: 'email', type: 'email', title: 'Courriel reçu par la victime', date: plaint.time - r.int(6, 30) * HOUR, author: 'expéditeur usurpé (son propre nom de compte)',
          body:
            `Objet : Votre compte a été compromis\n\n` +
            `Bonjour,\nJe vous écris depuis votre propre adresse : j'ai accès à votre appareil depuis plusieurs mois. J'ai enregistré une vidéo de vous via votre webcam pendant que vous consultiez certains sites.\n\n` +
            `Si vous voulez que cette vidéo ne soit pas envoyée à tous vos contacts, envoyez l'équivalent de ${demandUsd.toLocaleString('fr-FR')} $ en Bitcoin à l'adresse suivante :\n\n${A(w, camp[k])}\n\n` +
            `Vous avez 48 heures. Je saurai quand vous aurez ouvert ce message. Ne répondez pas, ne contactez pas la police.`,
        },
        {
          id: 'plainte', type: 'plainte', title: 'Déclaration de la victime', date: daytime(plaint.time + 2 * DAY), author: victimName,
          body:
            `« J'ai acheté des bitcoins sur Coinhouse et je les ai envoyés directement à l'adresse du mail, le ${fmtDate(plaint.time)}.\n` +
            `Montant indiqué par Coinhouse : ${amt(plaintValue, 'BTC')}.\n` +
            `Référence de transaction : ${plaint.hash} »`,
        },
        {
          id: 'pharos', type: 'note', title: 'Signalements PHAROS (extrait)', date: pharosT, author: 'Plateforme PHAROS',
          body:
            `Modèle de courriel identique signalé à de nombreuses reprises ces ${pharosWeeks} dernières semaines. Adresses BTC relevées dans les signalements :\n` +
            pharos.map((a) => `• ${A(w, a)}`).join('\n') + '\n\n' +
            `Attention : ce modèle circule sur des forums et est réutilisé par plusieurs groupes. Rattachement à un même auteur non établi.`,
        },
        {
          id: 'forum', type: 'forum', title: `Veille cyber : offre « ${spamName} » sur un forum spécialisé`, date: w.at(-25 * 24), author: 'Cellule de veille (capture traduite)',
          body:
            `« ${spamName} — envoi de masse, 1 million de boîtes par campagne, contournement des filtres antispam, textes « webcam » fournis.\n` +
            `Tarif : ${spamUsd} $ la campagne, payable en BTC uniquement, au cours du jour. Adresse de paiement communiquée en message privé.\n` +
            `Des dizaines de clients satisfaits. »\n\n` +
            `Note de veille : ce type de service est loué à de nombreux escrocs ; son adresse de paiement reçoit des sommes de même ordre de la part de clients différents.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : regroupements, rendu et tri', date: w.at(4 * 24), author: 'Cellule d\'appui',
          body:
            `• Entrées communes (CIOH) : toutes les entrées d'une transaction sont réputées signées par le même portefeuille. Une adresse présente dans deux regroupements relie les deux groupes.\n` +
            `• Toutes les entrées d'une adresse ne sont pas des victimes : les micro-montants de 546 sats sont de la poussière envoyée par des tiers, que le portefeuille de l'escroc laisse de côté.\n` +
            `• Les adresses d'une campagne continuent souvent de recevoir des paiements après avoir été vidées : ce sont aussi des victimes.\n` +
            `• Rendu : quand une transaction paie un tiers, la sortie restante revient en général au payeur. Le rendu n'est pas un point d'arrêt : il faut le suivre, il mène souvent à un second point de sortie, parfois après quelques petites sorties sans issue.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'addresses', points: 10,
          prompt: 'Sélectionnez toutes les adresses de réception de la campagne (adresses ayant reçu des paiements de victimes et appartenant au même portefeuille).',
          answer: [...camp],
          hint: 'Suivez la dépense de l\'adresse du mail : la transaction de regroupement a de nombreuses entrées. Ouvrez ensuite le panneau cluster.',
          explanation: `${n} adresses de réception sont reliées par deux transactions de regroupement. L'adresse ${A(w, bridgeAddr).slice(0, 14)}… figure dans les deux : c'est elle qui « soude » le cluster. Par l'heuristique des entrées communes, toutes ces adresses sont contrôlées par la même personne. Les adresses de la campagne concurrente, de même type et payées pour le même texte, ne sont jamais dépensées avec elles.`,
        },
        {
          id: 'o6', type: 'address', points: 8,
          prompt: 'Quelle adresse de la campagne figure en entrée des deux transactions de regroupement et « soude » ainsi le cluster ?',
          answer: [bridgeAddr],
          hint: 'Ouvrez les deux transactions qui alimentent l\'adresse de regroupement et comparez leurs listes d\'entrées : une seule adresse est commune.',
          explanation: `${A(w, bridgeAddr)} dépense une seule UTXO dans le regroupement n° 1 (${fmtDate(c1.time, false)}) et ses autres paiements de victimes dans le regroupement n° 2 (${fmtDate(c2.time, false)}). Sans elle, on aurait deux groupes distincts de ${g1.length + 1} et ${g2.length + 1} adresses ; grâce à elle, la CIOH fusionne les ${n} adresses en un seul portefeuille. C'est l'adresse à citer en premier pour justifier le rattachement.`,
        },
        {
          id: 'o5', type: 'addresses', points: 9,
          prompt: 'Parmi les adresses relevées par PHAROS, sélectionnez celles qui n\'appartiennent PAS au portefeuille de la campagne.',
          answer: [decoy, decoy2],
          hint: 'Pour chaque adresse signalée, regardez avec qui elle est dépensée. Une victime commune, un texte identique ou un même type d\'adresse ne suffisent pas.',
          explanation: `${A(w, decoy).slice(0, 14)}… et ${A(w, decoy2).slice(0, 14)}… sont regroupées ensemble (avec une troisième adresse) le ${fmtDate(decoyCons.time, false)} vers ${A(w, decoyOut).slice(0, 14)}…, mais jamais avec les adresses du cluster : c'est un autre portefeuille, celui d'une campagne qui copie le modèle. Pièges écartés : le texte est public et réutilisé ; une même victime a payé les deux campagnes, ce qui ne prouve rien sur leur lien ; le type d'adresse identique est un indice trop faible. Les deux autres adresses signalées sont bien dans le cluster.`,
        },
        {
          id: 'o4', type: 'address', points: 8,
          prompt: 'Quelle est l\'adresse de regroupement de la campagne ?',
          hint: 'C\'est l\'unique sortie des transactions de regroupement à plusieurs entrées.',
          answer: [consol],
          explanation: `${A(w, consol)} reçoit les deux transactions de regroupement, règle une dépense, puis alimente le dépôt chez ${exName}.`,
        },
        {
          id: 'o7', type: 'number', points: 9, unit: 'paiements', tolerance: 1,
          prompt: 'Combien de paiements de victimes les adresses de la campagne ont-elles reçus au total, y compris après les regroupements ?',
          answer: nPay,
          hint: 'Pour chaque adresse du cluster, comptez les transactions entrantes. Écartez les micro-montants de 546 sats ; n\'oubliez pas les paiements arrivés après les regroupements.',
          explanation: `${nPay} paiements, répartis sur ${n} adresses, dont ${nLate} arrivés après les regroupements (encore non dépensés). Les ${dustN} entrées de 546 sats sont de la poussière envoyée par des tiers, pas des victimes : le portefeuille de l'escroc ne les a d'ailleurs jamais dépensées. Chaque paiement est une victime potentielle : une même personne peut payer deux fois, mais l'ordre de grandeur du nombre de plaignants à rechercher est donné par ce comptage.`,
        },
        {
          id: 'o2', type: 'amount', points: 9, unit: 'BTC', tolerance: 0.02,
          prompt: 'Quel montant total (en BTC) les victimes ont-elles versé sur ces adresses ?',
          answer: total,
          hint: 'Additionnez les paiements de victimes reçus par chaque adresse du cluster, y compris ceux arrivés après les regroupements.',
          explanation: `${nPay} paiements pour un total de ${amt(total, 'BTC')}, dont ${amt(lateTotal, 'BTC')} arrivés après les regroupements et toujours sur les adresses de la campagne. Chaque paiement correspond potentiellement à une victime à identifier, notamment par réquisition aux plateformes d'où proviennent les fonds (Coinhouse, Bitstamp…).`,
        },
        {
          id: 'o8', type: 'number', points: 8, unit: 'paiements',
          prompt: 'Combien de ces paiements proviennent directement du hot wallet de Coinhouse ?',
          answer: nFromCv,
          hint: 'Pour chaque paiement reçu par le cluster, regardez l\'adresse en entrée : est-elle étiquetée « Coinhouse — Hot Wallet » ?',
          explanation: `${nFromCv} paiements sont des retraits Coinhouse envoyés directement aux adresses de la campagne (${nFromBs} autres viennent de Bitstamp). Chacun correspond à un client identifié par la plateforme : la réquisition à Coinhouse (établi en France) donne autant de victimes à contacter, avec leur identité et les montants. Les paiements venus de portefeuilles personnels exigeront d'autres pistes.`,
        },
        {
          id: 'o13', type: 'address', points: 9,
          prompt: 'Avant l\'encaissement, l\'adresse de regroupement règle une dépense à un prestataire de la campagne. Sur quelle adresse ce paiement aboutit-il ?',
          answer: [spamAddr],
          hint: 'Ouvrez les sorties de l\'adresse de regroupement : une transaction paie un tiers et renvoie le reste sur l\'adresse elle-même. Comparez le montant au tarif de la veille cyber.',
          explanation: `Le ${fmtDate(spamTx.time)}, ${A(w, consol).slice(0, 14)}… envoie ${amt(spamV, 'BTC')} (environ ${spamUsd} $, le tarif annoncé par « ${spamName} ») à ${A(w, spamAddr)} et se renvoie le reste. Outre ce paiement, cette adresse en reçoit ${spamClients - 1} autres, d'ordre comparable et venant d'expéditeurs différents, avant d'être vidée d'un bloc : c'est un prestataire, pas un portefeuille de l'escroc. C'est une piste à part entière (complicité, autres campagnes clientes), mais elle n'est pas la sortie des fonds des victimes.`,
        },
        {
          id: 'o3', type: 'entity', points: 9,
          prompt: 'Sur quelle plateforme l\'escroc a-t-il encaissé les fonds ?',
          hint: 'Suivez la dépense principale de l\'adresse de regroupement : la sortie au montant rond aboutit à une adresse de dépôt, ensuite balayée.',
          answer: [outKey],
          explanation: `Depuis l'adresse de regroupement, ${amt(depValue, 'BTC')} partent vers une adresse de dépôt ${exName}, ensuite balayée vers son hot wallet. ${procedureFor(out.entity)}`,
        },
        {
          id: 'o9', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant (en BTC) l\'escroc a-t-il déposé sur sa plateforme d\'encaissement ?',
          answer: depValue,
          hint: 'Dans la transaction qui vide l\'adresse de regroupement, prenez la sortie vers l\'adresse de dépôt (pas le balayage vers le hot wallet).',
          explanation: `${amt(depValue, 'BTC')} sont versés sur l'adresse de dépôt ${exName} le ${fmtDate(cashTx.time)} : montant rond, signe d'un paiement choisi. C'est le montant à mentionner dans la réquisition, avec le hash ${cashTx.hash.slice(0, 16)}… et l'adresse de dépôt.`,
        },
        {
          id: 'o10', type: 'address', points: 8,
          prompt: 'Sur quelle adresse le rendu de la transaction d\'encaissement est-il revenu à l\'escroc ?',
          answer: [rest],
          hint: 'La transaction d\'encaissement a deux sorties : le dépôt sur la plateforme (montant rond) et le rendu, sur une adresse neuve.',
          explanation: `${A(w, rest)} reçoit ${amt(r8(restIn), 'BTC')}, la différence entre le solde regroupé et le dépôt (frais déduits). Montant non rond, adresse neuve contrôlée par le même portefeuille : c'est le rendu. Il reste à l'escroc et doit être suivi.`,
        },
        {
          id: 'o11', type: 'entity', points: 9,
          prompt: 'Ce rendu repart ensuite en plusieurs transactions. Vers quel service la plus grosse part est-elle envoyée ?',
          answer: ['changenow'],
          hint: 'Dépliez toutes les sorties de l\'adresse de rendu : les petites sorties vers des adresses neuves ne mènent nulle part ; une sortie aboutit à une adresse étiquetée, aussitôt balayée vers un hot wallet.',
          explanation: `L'adresse de rendu envoie d'abord ${branchTxt} : petites branches vers des adresses neuves, sans service au bout, à documenter sans s'y attarder. Le ${fmtDate(restOrder.depositTx.time)}, elle envoie ${amt(orderValue, 'BTC')} vers une adresse de dépôt ChangeNOW (le solde revient sur un nouveau rendu) : échangeur instantané sans compte, qui convertit les BTC vers une autre chaîne. C'est le second point de sortie ; ChangeNOW peut, sur réquisition et à partir du hash de dépôt, indiquer l'adresse de paiement de la commande. ${procedureFor(sw.entity)}`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Que demander en priorité à Coinhouse et à Bitstamp ?',
          hint: 'Ces plateformes ne détiennent pas les fonds de l\'escroc : quelle donnée détiennent-elles sur les paiements reçus par le cluster ?',
          ...choice(r,
            'L\'identité des clients dont les retraits ont alimenté les adresses de la campagne, pour les entendre comme victimes',
            [
              'Le gel des bitcoins du cluster, puisque la plupart des paiements proviennent de leurs plateformes',
              'L\'identité de l\'escroc, qu\'elles connaissent puisque leurs clients lui ont envoyé des fonds',
              'L\'annulation des retraits des victimes, au titre de leur obligation de vigilance',
            ]),
          explanation: `Coinhouse et Bitstamp sont les rampes d'achat des victimes : leurs retraits vers le cluster sont rattachés à des comptes identifiés. Les réquisitions permettent de retrouver, entendre et faire déposer plainte les autres victimes, y compris celles qui ont payé après les regroupements, et de consolider le préjudice. Elles n'ont aucune prise sur les adresses de l'escroc (ni gel, ni identité) et une transaction Bitcoin confirmée ne s'annule pas. ${procedureFor(cv.entity)}`,
        },
      ],
      truth: {
        path: [...payments.map((p) => p.id), c1.id, c2.id, cashTx.id, sweep.id, restOrder.depositTx.id, restOrder.payoutTx.id],
        addresses: [...camp, consol, deposit, rest, restOrder.deposit],
        debrief:
          `1. La campagne utilise ${n} adresses de réception (${kind === 'p2pkh' ? 'Legacy' : 'SegWit'}), réparties entre les envois. Les victimes y versent ${nPay} paiements (${amt(total, 'BTC')}), souvent directement depuis Coinhouse (${nFromCv}) ou Bitstamp (${nFromBs}), étalés sur environ ${spreadWeeks} semaines avant les regroupements.\n` +
          `2. Regroupement n° 1 (${fmtDate(c1.time, false)}) : ${g1.length + 1} adresses en entrée, dont une seule UTXO de ${A(w, bridgeAddr).slice(0, 14)}….\n` +
          `3. Regroupement n° 2 : le reste de cette même adresse avec ${g2.length} autres. Elle relie les deux groupes : le cluster contient les ${n} adresses.\n` +
          `4. ${A(w, consol)} paie d'abord ${amt(spamV, 'BTC')} au loueur d'infrastructure « ${spamName} » (${A(w, spamAddr)}), puis envoie ${amt(depValue, 'BTC')} vers ${exName} et garde le reste en rendu sur ${A(w, rest)}.\n` +
          `5. Ce rendu lâche deux petites branches sans issue, puis le ${fmtDate(restOrder.depositTx.time, false)} ${amt(orderValue, 'BTC')} partent chez ChangeNOW, convertis et versés en ETH sur ${A(w, restOrder.payoutTx.transfers[0].to)} : second point de sortie.\n\n` +
          `Fausses pistes : la campagne concurrente (${A(w, decoy).slice(0, 12)}…, ${A(w, decoy2).slice(0, 12)}…), qui copie le texte et a même une victime en commun, mais forme son propre cluster ; les ${dustN} poussières de 546 sats ; l'adresse du loueur d'infrastructure, qui reçoit aussi les paiements de ${spamClients - 1} autres clients ; les branches du rendu. Et à ne pas oublier : ${nLate} victimes ont payé après les regroupements (${amt(lateTotal, 'BTC')} encore sur les adresses).\n\n` +
          `Leçon : l'heuristique des entrées communes (CIOH) part du principe que toutes les entrées d'une transaction sont signées par le même portefeuille. C'est l'outil de base pour passer d'une adresse à un portefeuille entier, et donc d'une victime à toutes les victimes. Ses limites : CoinJoin et paiements collaboratifs (exclus ici). Réquisitions : ${exName} (titulaire du dépôt), ChangeNOW (commande liée au dépôt du rendu) et Coinhouse/Bitstamp (identification des autres victimes).`,
      },
      hints: [
        'Ajoutez l\'adresse du courriel au graphe, puis dépliez ses entrées et ses sorties.',
        'Une transaction avec de nombreuses entrées provenant d\'adresses différentes signale un même propriétaire.',
        'Le panneau cluster de l\'adresse liste tous les membres reliés par entrées communes. Faites de même pour les adresses PHAROS.',
        'Pour le comptage, ne retenez que les paiements de victimes : ni la poussière, ni les regroupements, mais bien les paiements tardifs.',
        'L\'adresse de regroupement et le rendu ont chacun plusieurs sorties : une seule mène à un point de sortie.',
      ],
    }
  },
}

function receivedFrom(tx: Tx, addr: string): number {
  return tx.outputs.filter((o) => o.address === addr).reduce((s, o) => s + o.value, 0)
}
