import { World, type Tx } from '../engine/world'
import { coinjoin, exchange, HOUR, DAY } from '../engine/patterns'
import { detectCoinjoin } from '../engine/analysis'
import { fromUsd, roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fmtDate, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const btc = (v: number) => amt(r8(v), 'BTC')
const PREMIX_EXTRA = 0.0002
const COMPANIES = ['une mutuelle régionale', 'un réseau d\'agences immobilières', 'une plateforme de location de vacances', 'un club de sport en ligne', 'une enseigne de prêt-à-porter']

export const btcCoinjoinRemix: ScenarioTemplate = {
  id: 'coinjoin-remix',
  title: 'Remix et regroupements',
  tagline: 'Plusieurs tours de CoinJoin, des remix… et un regroupement post-mix qui défait tout le travail.',
  description:
    'Le vendeur d\'une base de données volée fait passer ses gains dans plusieurs tours successifs de CoinJoin (style WabiSabi), en remixant une partie de ses pièces. Il commet ensuite l\'erreur classique : regrouper des sorties de tours différents avec un reliquat non mixé. Identifiez les CoinJoin, la dépense post-mix fautive, les sorties rattachées et leur destination, sans tomber dans le piège d\'un regroupement étranger à l\'affaire… ni surestimer la valeur d\'une empreinte de portefeuille.',
  difficulty: 4,
  chains: ['btc'],
  skills: ['coinjoin', 'cioh', 'change', 'exchange_id', 'requisition'],
  estMinutes: 80,
  lessons: ['coinjoin', 'demixage-avance', 'analyse-comportementale', 'clustering', 'change-heuristics'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const handle = fakeHandle(r)
    const company = r.pick(COMPANIES)

    // Coordinateur fictif (le catalogue décrit zkSNACKs, arrêté en juin 2024)
    w.entity('wasabi', {
      name: 'Coordinateur Aube (WabiSabi)',
      description: 'Coordinateur CoinJoin (fictif) utilisant le protocole WabiSabi, comme ceux qui ont pris le relais de zkSNACKs après juin 2024 : transactions collaboratives à nombreux participants et sorties de montants standardisés, frais de coordination prélevés dans la transaction. Le coordinateur ne détient pas les fonds.',
    })
    const exKey = r.pick(['kraken', 'bitstamp', 'binance', 'okx', 'coinbase'] as const)
    const ex = exchange(w, exKey, 'btc')
    // Plateforme régulée d'où un acheteur paie directement (piste « recel »)
    const buyerKey = r.pick((['coinhouse', 'swissborg', 'bitstamp'] as const).filter((x) => x !== exKey))
    const buyerEx = exchange(w, buyerKey, 'btc')
    const forumName = r.pick(['BreachZone', 'LeakMarket', 'DataBazar', 'NullDump'])
    const forumE = w.customEntity({ name: `Forum « ${forumName} »`, category: 'darknet', known: true, description: 'Forum cybercriminel (fictif) de revente de bases de données ; facture la mise en avant des annonces en bitcoins.', country: 'Inconnu' })
    const forumFeeAddr = w.addr('btc', { entity: forumE, label: `${forumE.name} — Paiement des options d'annonce`, kind: 'p2wpkh', tags: ['liquid'] })
    const suspect = w.customEntity({ name: `@${handle} (vendeur, non identifié)`, category: 'suspect' })
    const fpKey = (id: string) => {
      const p = w.walletProfile(id)
      return `${p.version}|${p.locktime}|${p.rbf}`
    }

    // ── Ventes de la base de données : paiements des acheteurs ───────────────
    const denom = r.pick([0.01, 0.02, 0.05] as const)
    const m = r.int(4, 5)
    const R = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const suspectKey = fpKey(R)
    const nB = r.int(5, 8)
    const target = m * (denom + PREMIX_EXTRA) * r.float(1.25, 1.6)
    const parts = r.split(target, nB, 0.5)
    const sales: Tx[] = []
    let t = w.at(0)
    const kycIdx = r.int(0, nB - 1)
    for (const [i, v] of parts.entries()) {
      const value = roundAsset('BTC', Math.max(0.0015, v))
      // L'un des acheteurs paie par un retrait direct depuis son compte sur une plateforme régulée
      sales.push(i === kycIdx ? buyerEx.withdraw(R, value, t) : w.fund(R, value, t))
      t += Math.round(r.float(6, 40) * HOUR)
    }
    const totalSales = r8(sales.reduce((s, x) => s + x.outputs.find((o) => o.address === R)!.value, 0))

    // ── Préparation : découpage en pièces de la dénomination + reliquat ──────
    // Frais de mise en avant de l'annonce, payés au forum depuis l'adresse de paiement (rendu sur la même adresse)
    const forumFee = roundAsset('BTC', fromUsd('BTC', r.pick([49, 79, 99, 149])))
    const feeTx = w.utxoTx({ time: t + Math.round(r.float(0.5, 3) * HOUR), from: [R], to: [{ address: forumFeeAddr, value: forumFee }], change: R })
    const tPre = feeTx.time + Math.round(r.float(4, 30) * HOUR)
    const premix = Array.from({ length: m }, () => w.addr('btc', { entity: suspect, kind: 'p2wpkh' }))
    const L = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })
    const preTx = w.utxoTx({ time: tPre, from: [R], to: premix.map((a) => ({ address: a, value: r8(denom + PREMIX_EXTRA) })), change: L, spendAll: true })
    const leftoverValue = preTx.outputs.find((o) => o.address === L)!.value

    // ── Tours de CoinJoin, avec remix partiel ────────────────────────────────
    const nRounds = r.pick([2, 3, 3] as const)
    const cjs: Tx[] = []
    const behind: string[] = [] // sorties mixées non remixées
    let coins = premix
    let finals: string[] = []
    let tc = tPre + Math.round(r.float(1, 6) * HOUR)
    for (let k = 0; k < nRounds; k++) {
      const extra = r.int(9, 14)
      const res = coinjoin(w, { chain: 'btc', time: tc, denom, participants: coins.map((c) => ({ from: c, changeTo: null })), extra, coordinatorFee: r8(0.00001 * extra) })
      cjs.push(res.tx)
      const mixed = r.shuffle([...res.mixed])
      if (k === nRounds - 1) finals = mixed
      else {
        const keep = Math.max(2, mixed.length - r.int(1, 2))
        coins = mixed.slice(0, keep)
        behind.push(...mixed.slice(keep))
      }
      tc = res.tx.time + Math.round(r.float(3, 30) * HOUR)
    }
    const lastCj = cjs[cjs.length - 1]
    const unspentFinal = finals.length >= 3 ? finals[0] : undefined
    const finalsUsed = unspentFinal ? finals.slice(1) : finals
    const merged = [...behind, ...finalsUsed]
    const suspectMixed = new Set(cjs.flatMap((cj) => cj.outputs.map((o) => o.address)).filter((a) => w.get(a).entityId === suspect.id))

    // ── Bruit post-mix des autres participants ───────────────────────────────
    const isDenom = (v: number) => Math.abs(v - denom) < 1e-9
    const strangersOf = (cj: Tx) => cj.outputs.filter((o) => isDenom(o.value) && !suspectMixed.has(o.address) && !w.spender(cj.id, o.n)).map((o) => o.address)
    const lastStrangers = r.shuffle(strangersOf(lastCj))
    // Faux positif : deux sorties de participants différents regroupées, logiciel de même empreinte que le suspect
    const fpPair = lastStrangers.splice(0, 2)
    let k = 0
    while (fpKey(fpPair[0]) !== suspectKey) w.get(fpPair[0]).wallet = `fp-${fpPair[0]}-${++k}`
    const fpFee = w.estimateFee('btc', 2, 1)
    const fpTx = w.utxoTx({ time: lastCj.time + Math.round(r.float(3, 40) * HOUR), from: fpPair, to: [{ address: w.addr('btc'), value: r8(denom * 2 - fpFee) }], fee: fpFee, change: null, spendAll: true })
    for (const cj of cjs) {
      const pool = cj === lastCj ? lastStrangers : strangersOf(cj)
      for (const a of pool) {
        if (!r.chance(0.55)) continue
        w.utxoTx({ time: cj.time + Math.round(r.float(2, 90) * HOUR), from: [a], to: [{ address: w.addr('btc'), value: r8(denom * r.float(0.3, 0.8)) }] })
      }
    }

    // ── L'erreur : regroupement de sorties de tours différents + reliquat ────
    const inputs = r.shuffle([...merged, L])
    const deposit = ex.newDeposit()
    const consIn = merged.length * denom + leftoverValue
    const consFee = w.estimateFee('btc', inputs.length, 1)
    const tCons = lastCj.time + Math.round(r.float(10, 60) * HOUR)
    const consTx = w.utxoTx({ time: tCons, from: inputs, to: [{ address: deposit, value: r8(consIn - consFee) }], fee: consFee, change: null, spendAll: true })
    const sweep = ex.sweep([deposit], tCons + Math.round(r.float(1, 6) * HOUR))[0]
    const deposited = consTx.outputs[0].value

    ex.noise(14, w.at(-3 * 24), tCons + 4 * DAY)

    const fromRound = (a: string) => cjs.findIndex((cj) => cj.outputs.some((o) => o.address === a)) + 1
    const roundsInCons = [...new Set(merged.map(fromRound))].sort()
    const eq = detectCoinjoin(cjs[0]).equalCount ?? 0
    const tPost = Math.round(r.float(w.at(-20 * 24), w.at(-3 * 24)))

    return {
      world: w,
      title: `Base de données volée et CoinJoin — ${city}`,
      briefing:
        `Les données personnelles de plusieurs centaines de milliers de clients d'${company} (${city}) sont mises en vente sur un forum cybercriminel par @${handle}. Les acheteurs paient en bitcoins sur une adresse indiquée dans l'annonce ; ${nB} paiements ont été identifiés.\n\n` +
        `Le vendeur a ensuite fait passer ses gains par un coordinateur CoinJoin de type WabiSabi, en plusieurs tours, et en remixant une partie des pièces obtenues. À première vue, la piste s'arrête là.\n\n` +
        `Retrouvez les CoinJoin traversés, la dépense post-mix qui trahit le vendeur, les sorties mixées qu'elle lui rattache et la plateforme de destination. Un regroupement étranger à l'affaire se trouve dans les mêmes transactions : ne l'imputez pas au suspect. Utilisez l'analyse post-mix de l'inspecteur et l'empreinte des transactions, en mesurant ce que chacune prouve.`,
      evidence: [
        {
          id: 'forum', type: 'forum', title: 'Annonce sur le forum (capture)', date: w.at(-r.float(3, 10) * 24), author: `@${handle}`,
          body:
            `[VENTE] Base clients ${company.replace(/^une? /, '')} — FR — ${r.int(180, 650)} k lignes (nom, adresse, téléphone, IBAN partiel)\n` +
            `Échantillon de 1 000 lignes en lien. Prix : ${btc(r8(totalSales / nB))} environ par acheteur, réduction pour revendeurs.\n` +
            `Paiement BTC uniquement : ${A(w, R)}\n` +
            `Livraison du fichier après une confirmation.\n` +
            `[Annonce mise en avant — option payante du forum ${forumName}]`,
        },
        {
          id: 'pv', type: 'pv', title: 'Procès-verbal de constatations (extrait)', date: tPost, author: 'Section de recherches — groupe cyber',
          body:
            `Constatons que l'adresse de paiement de l'annonce a reçu ${nB} paiements entre le ${fmtDate(sales[0].time, false)} et le ${fmtDate(sales[sales.length - 1].time, false)}, pour ${btc(totalSales)}.\n` +
            `Constatons que l'essentiel de ces fonds a été dépensé le ${fmtDate(preTx.time)} par la transaction ${preTx.hash}, qui crée plusieurs sorties de montant identique.`,
        },
        {
          id: 'note', type: 'note', title: 'Note technique — CoinJoin WabiSabi et analyse post-mix', date: tPost - 40 * DAY, author: 'Groupe d\'appui crypto-actifs',
          body:
            `- Un tour de CoinJoin réunit de nombreux participants ; les sorties de montant standard sont indiscernables. L'heuristique des entrées communes ne s'applique pas à la transaction de CoinJoin elle-même.\n` +
            `- Une pièce peut être « remixée » : réinscrite dans un tour suivant. Chaque tour ajoute de l'incertitude.\n` +
            `- Après le mix, dépenser ensemble plusieurs sorties mixées, ou une sortie mixée avec des fonds non mixés, recrée un lien de propriété.\n` +
            `- L'inspecteur d'une transaction CoinJoin propose une analyse post-mix ; l'empreinte d'une transaction (version, nLockTime, RBF) renseigne sur la famille de logiciel utilisée.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o8', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Avant de préparer ses pièces, le vendeur a payé une option au forum depuis l\'adresse de l\'annonce. Quel montant (en BTC) ?',
          answer: forumFee,
          hint: 'L\'adresse de l\'annonce est dépensée deux fois : la première dépense, antérieure à celle citée au procès-verbal, a une sortie attribuée et un rendu qui revient sur l\'adresse elle-même.',
          explanation: `${feeTx.hash.slice(0, 16)}… verse ${btc(forumFee)} (≈ ${Math.round(usd('BTC', forumFee))} $, prix d'une mise en avant) à l'adresse de paiement des options du ${forumE.name}, le ${fmtDate(feeTx.time)} ; le rendu revient sur l'adresse de l'annonce, réutilisée. Ce paiement relie on-chain l'adresse de l'annonce au compte vendeur du forum : un élément à verser au dossier si le forum est un jour saisi (ses bases associent paiements et comptes).`,
        },
        {
          id: 'o1', type: 'tx', points: 8,
          prompt: 'Identifiez une transaction CoinJoin dans laquelle des fonds du vendeur ont été mélangés.',
          answer: cjs.map((x) => x.id),
          hint: 'Suivez les sorties de montant identique créées par la transaction mentionnée au procès-verbal de constatations.',
          explanation: `Le premier tour compte ${cjs[0].inputs.length} entrées et ${eq} sorties de ${btc(denom)} : les pièces du vendeur y deviennent indiscernables de celles des autres participants. ${nRounds > 1 ? `Toute transaction parmi les ${nRounds} tours est acceptée.` : ''}`,
        },
        {
          id: 'o2', type: 'number', points: 8, tolerance: 0, unit: 'tours',
          prompt: 'Combien de tours de CoinJoin distincts ont mélangé des fonds du vendeur ?',
          answer: nRounds,
          hint: 'Dans l\'analyse post-mix d\'un CoinJoin, les sorties « remixées » mènent au tour suivant. Suivez-les jusqu\'au dernier.',
          explanation: `${nRounds} tours : ${cjs.map((cj, i) => `n° ${i + 1} le ${fmtDate(cj.time)}`).join(', ')}. À chaque tour, une partie des pièces est remixée, le reste attend : c'est ce qui rend la dépense finale si révélatrice, puisqu'elle réunit des pièces de tours différents.`,
        },
        {
          id: 'o9', type: 'address', points: 10,
          prompt: 'Quelle adresse reçoit le reliquat de la transaction de préparation, qui n\'entre dans aucun CoinJoin ?',
          answer: [L],
          hint: 'Dans la transaction citée au procès-verbal, toutes les sorties ont le même montant sauf une.',
          explanation: `${A(w, L)} reçoit ${btc(leftoverValue)}, la différence entre les paiements des acheteurs et les ${m} pièces de ${btc(r8(denom + PREMIX_EXTRA))}. Ce reliquat ne participe à aucun tour : il reste directement relié à l'adresse de l'annonce, donc au vendeur. C'est le fil à surveiller : s'il est un jour dépensé avec des sorties mixées, il les « signe ».`,
        },
        {
          id: 'o3', type: 'tx', points: 14,
          prompt: 'Quelle dépense post-mix permet de rattacher des sorties mixées au vendeur ?',
          answer: [consTx.id],
          hint: 'Le découpage initial a laissé un reliquat qui n\'est jamais entré dans un CoinJoin. Où est-il dépensé, et avec quoi ?',
          explanation: `${consTx.hash.slice(0, 16)}… dépense ensemble le reliquat non mixé ${A(w, L)} (${btc(leftoverValue)}, rendu de la transaction de préparation, directement issu des paiements des acheteurs) et ${merged.length} sorties mixées venant des tours ${roundsInCons.slice(0, -1).join(', ')} et ${roundsInCons[roundsInCons.length - 1]}. Par entrées communes, toutes appartiennent au propriétaire du reliquat : l'analyse post-mix de chaque CoinJoin rattache cette dépense au même participant.`,
        },
        {
          id: 'o10', type: 'number', points: 8, tolerance: 1, unit: 'heures',
          prompt: 'Combien d\'heures séparent le dernier tour de CoinJoin du vendeur de la dépense post-mix fautive ?',
          answer: (tCons - lastCj.time) / HOUR,
          hint: 'Comparez l\'horodatage du dernier tour (celui dont aucune sortie du vendeur n\'est remixée) et celui de la dépense qui regroupe le reliquat.',
          explanation: `Dernier tour le ${fmtDate(lastCj.time)}, regroupement le ${fmtDate(tCons)} : environ ${Math.round((tCons - lastCj.time) / HOUR)} h. Le vendeur dépense ses pièces très vite après le mix, toutes ensemble et avec le reliquat : l'ensemble d'anonymat du dernier tour n'a pas eu le temps de « vieillir » (peu d'autres sorties dépensées entre-temps), ce qui rend la dépense d'autant plus saillante dans l'analyse post-mix.`,
        },
        {
          id: 'o4', type: 'addresses', points: 14,
          prompt: 'Sélectionnez les sorties mixées (issues d\'un CoinJoin) que cette dépense rattache au vendeur.',
          answer: merged,
          hint: 'Parmi les entrées de la dépense fautive, une seule n\'est pas une sortie de CoinJoin : écartez-la.',
          explanation: `${merged.length} sorties mixées : ${merged.map((a) => `${A(w, a)} (tour ${fromRound(a)})`).join(', ')}. Le reliquat ${A(w, L)} n'est pas une sortie mixée : il est rattaché au vendeur dès l'origine.${unspentFinal ? ` Une autre sortie du dernier tour (${A(w, unspentFinal)}) n'a pas encore été dépensée : rien ne permet aujourd'hui de la rattacher, mais elle mérite une surveillance.` : ''}`,
        },
        {
          id: 'o5', type: 'entity', points: 10,
          prompt: 'Vers quelle plateforme les fonds regroupés ont-ils été envoyés ?',
          answer: [exKey],
          hint: 'La dépense fautive n\'a qu\'une sortie : vers quelle adresse, et où cette adresse est-elle balayée ensuite ?',
          explanation: `La dépense post-mix verse ${btc(deposited)} sur une adresse de dépôt ${ex.entity.name}, balayée ensuite vers son portefeuille chaud. Réquisition sur cette adresse de dépôt, en joignant la démonstration (paiements des acheteurs → préparation → reliquat → regroupement). ${procedureFor(ex.entity)}`,
        },
        {
          id: 'o11', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant (en BTC) la dépense post-mix fautive verse-t-elle sur l\'adresse de dépôt de cette plateforme ?',
          answer: deposited,
          hint: 'La dépense fautive n\'a qu\'une sortie : lisez sa valeur.',
          explanation: `${btc(deposited)} : ${merged.length} sorties mixées de ${btc(denom)} plus le reliquat de ${btc(leftoverValue)}, moins les frais de réseau. C'est le montant à indiquer dans la réquisition, avec le hash de la dépense et l'adresse de dépôt ${A(w, deposit)}, pour que la plateforme retrouve le crédit et, le cas échéant, gèle le solde.`,
        },
        {
          id: 'o12', type: 'entity', points: 10,
          prompt: 'L\'un des acheteurs de la base a payé par un retrait direct depuis une plateforme régulée. Laquelle ?',
          answer: [buyerKey],
          hint: 'Examinez l\'émetteur de chaque paiement reçu par l\'adresse de l\'annonce : l\'un d\'eux part du portefeuille chaud d\'un service attribué.',
          explanation: `Le paiement du ${fmtDate(sales[kycIdx].time)} (${btc(sales[kycIdx].outputs.find((o) => o.address === R)!.value)}) part du portefeuille chaud de ${buyerEx.entity.name}, avec un rendu vers ce même portefeuille : c'est un retrait de client. La plateforme peut identifier le titulaire du compte qui a ordonné ce retrait vers l'adresse de l'annonce, c'est-à-dire un acheteur de données volées (volet recel), et lui demander l'échantillon ou le fichier obtenu. ${procedureFor(buyerEx.entity)}`,
        },
        {
          id: 'o6', type: 'tx', points: 10,
          prompt: 'Un autre regroupement de sorties mixées figure dans les mêmes CoinJoin. Lequel ne doit pas être imputé au vendeur ?',
          answer: [fpTx.id],
          hint: 'L\'analyse post-mix signale les regroupements « sans lien avec un participant ».',
          explanation: `${fpTx.hash.slice(0, 16)}… regroupe deux sorties de ${btc(denom)} du dernier tour, mais aucune de ses entrées n'est reliée au vendeur (ni reliquat, ni rendu, ni adresse d'entrée). Elle prouve seulement qu'un même acteur détient ces deux sorties, sans dire lequel. Son empreinte de logiciel est pourtant identique à celle du vendeur : c'est un piège.`,
        },
        {
          id: 'o7', type: 'choice', points: 12,
          prompt: 'Deux regroupements de sorties mixées présentent la même empreinte de logiciel que la transaction de préparation du vendeur. Quelle valeur accorder à cette empreinte ?',
          ...choice(r,
            'Un indice de même famille de logiciel, partagée par beaucoup : il corrobore un lien établi autrement',
            [
              'Une preuve d\'identité : deux transactions de même empreinte ont nécessairement le même auteur',
              'Aucune valeur : ces champs sont tirés au hasard à chaque transaction et ne disent rien',
              'Une preuve suffisante dès lors que les deux transactions ont lieu le même jour',
            ]),
          hint: 'Comparez les deux regroupements : lequel repose sur un lien de propriété avec un élément déjà attribué au vendeur ?',
          explanation: `Version, nLockTime, signalement RBF et ordre des sorties sont fixés par le logiciel : ils désignent une famille de portefeuilles, utilisée par de nombreuses personnes. Ici, le rattachement de la dépense fautive repose sur un lien de propriété (le reliquat non mixé) ; l'empreinte identique le corrobore. Pour l'autre regroupement, la même empreinte ne prouve rien : sans lien de propriété, l'imputer au vendeur serait une erreur.`,
        },
      ],
      truth: {
        path: [...sales.map((x) => x.id), feeTx.id, preTx.id, ...cjs.map((x) => x.id), consTx.id, sweep.id],
        addresses: [R, L, ...premix, ...merged, deposit, forumFeeAddr],
        debrief:
          `1. ${nB} acheteurs paient au total ${btc(totalSales)} sur l'adresse de l'annonce ; l'un d'eux par un retrait direct depuis ${buyerEx.entity.name} (acheteur identifiable, volet recel). Le vendeur règle ${btc(forumFee)} d'option d'annonce au ${forumE.name}, rendu sur la même adresse.\n` +
          `2. Préparation (${fmtDate(preTx.time)}) : ${m} pièces de ${btc(r8(denom + PREMIX_EXTRA))} (dénomination + frais) et un reliquat de ${btc(leftoverValue)} sur ${A(w, L)}.\n` +
          `3. ${nRounds} tours de CoinJoin : à chaque tour, une partie des sorties est remixée dans le suivant, le reste attend.\n` +
          `4. Erreur : le ${fmtDate(consTx.time)}, ${merged.length} sorties mixées de tours différents sont dépensées avec le reliquat non mixé vers un dépôt ${ex.entity.name} (${btc(deposited)}).\n` +
          `5. Piège : un autre participant regroupe deux sorties du dernier tour avec un logiciel de même empreinte ; rien ne le relie au vendeur.\n\n` +
          `À retenir : les remix augmentent l'ensemble d'anonymat, mais une seule dépense post-mix maladroite suffit à relier toutes les pièces qu'elle réunit, quel que soit le nombre de tours. L'analyse post-mix cherche un lien de propriété (reliquat, rendu, réutilisation d'adresse) ; l'empreinte de logiciel et les horaires ne sont que des indices de corroboration, à présenter comme tels.`,
      },
      hints: [
        'Partez de l\'adresse de l\'annonce : la transaction de préparation crée plusieurs sorties identiques et une sortie différente.',
        'Les CoinJoin sont détectés automatiquement. Dans l\'inspecteur, l\'analyse post-mix montre les sorties remixées et les dépenses rattachées.',
        'La sortie différente de la préparation (le reliquat) n\'est jamais mixée : suivez sa dépense.',
        'Un regroupement de sorties mixées sans lien avec un participant ne désigne personne, même avec une empreinte de logiciel identique.',
        'Les paiements reçus par l\'adresse de l\'annonce ne viennent pas tous d\'adresses anonymes : regardez qui les émet, et ce que l\'adresse paie avant la préparation.',
      ],
    }
  },
}
