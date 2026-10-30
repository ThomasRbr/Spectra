import { World, type Tx } from '../engine/world'
import { coinjoin, exchange, HOUR, DAY } from '../engine/patterns'
import { detectCoinjoin } from '../engine/analysis'
import { roundAsset } from '../engine/chains'
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
  estMinutes: 40,
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
    for (const v of parts) {
      sales.push(w.fund(R, roundAsset('BTC', Math.max(0.0015, v)), t))
      t += Math.round(r.float(6, 40) * HOUR)
    }
    const totalSales = r8(sales.reduce((s, x) => s + x.outputs.find((o) => o.address === R)!.value, 0))

    // ── Préparation : découpage en pièces de la dénomination + reliquat ──────
    const tPre = t + Math.round(r.float(4, 30) * HOUR)
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
            `Livraison du fichier après une confirmation.`,
        },
        {
          id: 'pv', type: 'pv', title: 'Procès-verbal de constatations (extrait)', date: tPost, author: 'Section de recherches — groupe cyber',
          body:
            `Constatons que l'adresse de paiement de l'annonce a reçu ${nB} paiements entre le ${fmtDate(sales[0].time, false)} et le ${fmtDate(sales[sales.length - 1].time, false)}, pour ${btc(totalSales)}.\n` +
            `Constatons que ces fonds ont été dépensés le ${fmtDate(preTx.time)} par la transaction ${preTx.hash}, qui crée plusieurs sorties de montant identique.`,
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
          id: 'o1', type: 'tx', points: 10,
          prompt: 'Identifiez une transaction CoinJoin dans laquelle des fonds du vendeur ont été mélangés.',
          answer: cjs.map((x) => x.id),
          hint: 'Suivez les sorties de montant identique créées par la transaction mentionnée au procès-verbal de constatations.',
          explanation: `Le premier tour compte ${cjs[0].inputs.length} entrées et ${eq} sorties de ${btc(denom)} : les pièces du vendeur y deviennent indiscernables de celles des autres participants. ${nRounds > 1 ? `Toute transaction parmi les ${nRounds} tours est acceptée.` : ''}`,
        },
        {
          id: 'o2', type: 'number', points: 10, tolerance: 0, unit: 'tours',
          prompt: 'Combien de tours de CoinJoin distincts ont mélangé des fonds du vendeur ?',
          answer: nRounds,
          hint: 'Dans l\'analyse post-mix d\'un CoinJoin, les sorties « remixées » mènent au tour suivant. Suivez-les jusqu\'au dernier.',
          explanation: `${nRounds} tours : ${cjs.map((cj, i) => `n° ${i + 1} le ${fmtDate(cj.time)}`).join(', ')}. À chaque tour, une partie des pièces est remixée, le reste attend : c'est ce qui rend la dépense finale si révélatrice, puisqu'elle réunit des pièces de tours différents.`,
        },
        {
          id: 'o3', type: 'tx', points: 20,
          prompt: 'Quelle dépense post-mix permet de rattacher des sorties mixées au vendeur ?',
          answer: [consTx.id],
          hint: 'Le découpage initial a laissé un reliquat qui n\'est jamais entré dans un CoinJoin. Où est-il dépensé, et avec quoi ?',
          explanation: `${consTx.hash.slice(0, 16)}… dépense ensemble le reliquat non mixé ${A(w, L)} (${btc(leftoverValue)}, rendu de la transaction de préparation, directement issu des paiements des acheteurs) et ${merged.length} sorties mixées venant des tours ${roundsInCons.slice(0, -1).join(', ')} et ${roundsInCons[roundsInCons.length - 1]}. Par entrées communes, toutes appartiennent au propriétaire du reliquat : l'analyse post-mix de chaque CoinJoin rattache cette dépense au même participant.`,
        },
        {
          id: 'o4', type: 'addresses', points: 20,
          prompt: 'Sélectionnez les sorties mixées (issues d\'un CoinJoin) que cette dépense rattache au vendeur.',
          answer: merged,
          hint: 'Parmi les entrées de la dépense fautive, une seule n\'est pas une sortie de CoinJoin : écartez-la.',
          explanation: `${merged.length} sorties mixées : ${merged.map((a) => `${A(w, a)} (tour ${fromRound(a)})`).join(', ')}. Le reliquat ${A(w, L)} n'est pas une sortie mixée : il est rattaché au vendeur dès l'origine.${unspentFinal ? ` Une autre sortie du dernier tour (${A(w, unspentFinal)}) n'a pas encore été dépensée : rien ne permet aujourd'hui de la rattacher, mais elle mérite une surveillance.` : ''}`,
        },
        {
          id: 'o5', type: 'entity', points: 10,
          prompt: 'Vers quelle plateforme les fonds regroupés ont-ils été envoyés ?',
          answer: [exKey],
          explanation: `La dépense post-mix verse ${btc(deposited)} sur une adresse de dépôt ${ex.entity.name}, balayée ensuite vers son portefeuille chaud. Réquisition sur cette adresse de dépôt, en joignant la démonstration (paiements des acheteurs → préparation → reliquat → regroupement). ${procedureFor(ex.entity)}`,
        },
        {
          id: 'o6', type: 'tx', points: 10,
          prompt: 'Un autre regroupement de sorties mixées figure dans les mêmes CoinJoin. Lequel ne doit pas être imputé au vendeur ?',
          answer: [fpTx.id],
          hint: 'L\'analyse post-mix signale les regroupements « sans lien avec un participant ».',
          explanation: `${fpTx.hash.slice(0, 16)}… regroupe deux sorties de ${btc(denom)} du dernier tour, mais aucune de ses entrées n'est reliée au vendeur (ni reliquat, ni rendu, ni adresse d'entrée). Elle prouve seulement qu'un même acteur détient ces deux sorties, sans dire lequel. Son empreinte de logiciel est pourtant identique à celle du vendeur : c'est un piège.`,
        },
        {
          id: 'o7', type: 'choice', points: 20,
          prompt: 'Deux regroupements de sorties mixées présentent la même empreinte de logiciel que la transaction de préparation du vendeur. Quelle valeur accorder à cette empreinte ?',
          ...choice(r,
            'Un indice de même famille de logiciel, partagée par beaucoup : il corrobore un lien établi autrement',
            [
              'Une preuve d\'identité : deux transactions de même empreinte ont nécessairement le même auteur',
              'Aucune valeur : ces champs sont tirés au hasard à chaque transaction et ne disent rien',
              'Une preuve suffisante dès lors que les deux transactions ont lieu le même jour',
            ]),
          explanation: `Version, nLockTime, signalement RBF et ordre des sorties sont fixés par le logiciel : ils désignent une famille de portefeuilles, utilisée par de nombreuses personnes. Ici, le rattachement de la dépense fautive repose sur un lien de propriété (le reliquat non mixé) ; l'empreinte identique le corrobore. Pour l'autre regroupement, la même empreinte ne prouve rien : sans lien de propriété, l'imputer au vendeur serait une erreur.`,
        },
      ],
      truth: {
        path: [...sales.map((x) => x.id), preTx.id, ...cjs.map((x) => x.id), consTx.id, sweep.id],
        addresses: [R, L, ...premix, ...merged, deposit],
        debrief:
          `1. ${nB} acheteurs paient au total ${btc(totalSales)} sur l'adresse de l'annonce.\n` +
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
      ],
    }
  },
}
