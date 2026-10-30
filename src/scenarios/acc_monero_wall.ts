import { World, type Tx } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakeName, fmtDate, forwardAll, procedureFor } from './util'

/**
 * Bruit d'exchange UTXO dans l'ordre chronologique : `ExchangeKit.noise` tire
 * des horaires aléatoires dans le désordre, ce qui peut faire dépenser au hot
 * wallet un rendu créé « plus tard ». Ici on constitue une réserve initiale
 * puis on génère retraits et dépôts triés par date.
 */
function chronoNoise(w: World, kit: ExchangeKit, n: number, from: number, to: number): void {
  w.sweepInto(kit.hot, roundCoin(w, 40, 60, 0.0001), from - DAY)
  const times = Array.from({ length: n }, () => Math.round(w.rng.float(from, to))).sort((a, b) => a - b)
  for (const t of times) {
    const v = roundAsset('BTC', w.rng.float(50, 25000) / usd('BTC', 1))
    if (w.rng.chance(0.55)) kit.withdraw(w.addr('btc'), v, t)
    else kit.receive(w.addr('btc'), v, t)
  }
}

export const accMoneroWall: ScenarioTemplate = {
  id: 'monero-wall',
  title: 'Le mur Monero',
  tagline: 'BTC → XMR → BTC : quand la blockchain se tait, seuls le temps, les montants et l\'OSINT parlent.',
  description:
    'Les gains d\'un centre d\'appels de faux support technique sont convertis en Monero sur un échangeur instantané, puis reconvertis en bitcoins quelques jours plus tard. Aucune donnée XMR n\'est exploitable : retrouvez le point d\'entrée, le candidat de sortie le plus probable et mesurez ce que l\'on peut honnêtement conclure.',
  difficulty: 3,
  chains: ['btc', 'xmr'],
  skills: ['privacy', 'crosschain', 'osint', 'exchange_id', 'requisition'],
  estMinutes: 60,
  lessons: ['monero', 'chain-hopping', 'osint', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const victimName = fakeName(r)
    const handle = fakeHandle(r)

    const fx = w.entity('exch')
    const fxDep = w.addr('btc', { entity: fx, label: 'eXch — Adresse de dépôt', tags: ['deposit'] })
    const fxHot = w.addr('btc', { entity: fx, label: 'eXch — Hot Wallet BTC', tags: ['liquid', 'hot'], kind: 'p2wpkh' })
    const destKey = r.pick(['coinhouse', 'bitstamp', 'binance'] as const)
    const dest = exchange(w, destKey, 'btc')
    const orbit = w.entity('orbit')
    const orbitAddr = w.addr('btc', { entity: orbit, label: 'OrbitCasino — Dépôts', tags: ['liquid'] })

    const suspect = w.customEntity({ name: `@${handle} (auteur présumé)`, category: 'suspect' })
    const s = w.addr('btc', { entity: suspect, kind: 'p2wpkh' })

    // Faux support technique : nombreux paiements de « frais de dépannage »
    const nPay = r.int(10, 16)
    const pays: string[] = []
    let complainantTx = ''
    let complainantValue = 0
    let complainantAddr = ''
    let complainantT = 0
    for (let i = 0; i < nPay; i++) {
      const named = i === 2
      const va = named ? w.addr('btc', { entity: w.customEntity({ name: victimName, category: 'victim' }) }) : w.addr('btc')
      const value = roundAsset('BTC', r.float(900, 2600) / usd('BTC', 1))
      const tx = w.fund(s, value, w.at(-r.float(1, 10) * 24), { from: [va] })
      pays.push(tx.id)
      if (named) {
        complainantTx = tx.hash
        complainantValue = value
        complainantAddr = va
        complainantT = tx.time
      }
    }

    const collectedBtc = roundAsset('BTC', pays.reduce((t, id) => t + w.flowIn(w.tx(id), s)[0].value, 0))

    // Entrée : tout le solde part chez eXch (BTC → XMR)
    const entryT = w.at(r.float(30, 60))

    // Commissions des téléopérateurs, versées en une transaction peu avant le passage en Monero
    const nOps = r.int(3, 5)
    const opName = fakeName(r)
    const opAddrs = Array.from({ length: nOps }, (_, i) => w.addr('btc', { entity: w.customEntity({ name: i === 0 ? opName : `Téléopérateur ${i + 1} (non identifié)`, category: 'individual' }) }))
    const opValues = opAddrs.map(() => roundAsset('BTC', collectedBtc * r.float(0.03, 0.07)))
    const commTx = w.utxoTx({ time: entryT - Math.round(r.float(3, 20) * HOUR), from: [s], to: opAddrs.map((a, i) => ({ address: a, value: opValues[i] })), change: s })
    const commTotal = roundAsset('BTC', opValues.reduce((t, v) => t + v, 0))
    const entryTx = forwardAll(w, s, fxDep, entryT)
    const entryBtc = w.flowIn(entryTx, fxDep)[0].value
    const sweepTx = forwardAll(w, fxDep, fxHot, entryT + r.int(10, 60) * 60, undefined, ['sweep'])

    // Sortie : quelques jours plus tard, XMR → BTC vers une adresse neuve
    const exitT = entryT + Math.round(r.float(4, 8) * DAY)
    const x1 = w.addr('btc', { entity: suspect, kind: r.pick(['p2wpkh', 'p2tr'] as const) })
    const exitBtc = roundAsset('BTC', entryBtc * r.float(0.55, 0.8))
    const msgT = exitT + Math.round(r.float(1, 3) * HOUR)
    const quoted = Math.round(exitBtc * 1000) / 1000

    // Paiements du hot wallet eXch, générés dans l'ordre chronologique
    // (réserve initiale importante pour que la chaîne des rendus reste cohérente)
    w.sweepInto(fxHot, roundCoin(w, 55, 70, 0.0001), entryT - 2 * DAY)
    const plan: { to: string; value: number; time: number }[] = [{ to: x1, value: exitBtc, time: exitT }]
    const dA = w.addr('btc')
    // Leurres : montants proches dans la fenêtre, ou très proches hors fenêtre
    plan.push({ to: dA, value: exitBtc * (1 + r.pick([-1, 1]) * r.float(0.022, 0.045)), time: msgT - r.float(4, 20) * HOUR })
    plan.push({ to: w.addr('btc'), value: exitBtc * (1 + r.pick([-1, 1]) * r.float(0.022, 0.045)), time: msgT - r.float(4, 22) * HOUR })
    plan.push({ to: w.addr('btc'), value: exitBtc * (1 + r.pick([-1, 1]) * r.float(0.003, 0.012)), time: msgT + r.float(8, 30) * HOUR })
    plan.push({ to: w.addr('btc'), value: exitBtc * (1 + r.pick([-1, 1]) * r.float(0.003, 0.012)), time: msgT - r.float(30, 60) * HOUR })
    // Activité courante du hot wallet
    for (let i = 0; i < r.int(22, 30); i++) {
      let v = roundCoin(w, 0.005, 1.5, 0.00001)
      if (Math.abs(v / exitBtc - 1) < 0.07) v *= 1.25
      plan.push({ to: w.addr('btc'), value: v, time: exitT + r.float(-3, 3) * DAY })
    }
    plan.sort((a, b) => a.time - b.time)
    const paid = new Map<string, Tx>()
    for (const p of plan) {
      paid.set(p.to, w.utxoTx({ time: Math.round(p.time), from: [fxHot], to: [{ address: p.to, value: roundAsset('BTC', p.value) }], change: fxHot, tags: ['payout'] }))
    }
    const exitTx = paid.get(x1)!
    const decoyA = paid.get(dA)!
    w.utxoTx({ time: decoyA.time + r.int(1, 6) * HOUR, from: [dA], to: [{ address: orbitAddr, value: roundAsset('BTC', w.unspentValue(dA) * 0.6) }] })

    // Dépôt « direct sur mon compte »
    const depAddr = dest.newDeposit()
    const depTx = forwardAll(w, x1, depAddr, Math.round(exitT + r.float(1.5, 5) * HOUR))
    const depValue = w.flowIn(depTx, depAddr)[0].value
    const depSweep = dest.sweep([depAddr], depTx.time + r.int(1, 8) * HOUR)[0]
    const dep = { tx: depTx, deposit: depAddr, sweep: depSweep }

    // Autres clients qui déposent chez eXch
    for (let i = 0; i < r.int(5, 9); i++) {
      const c = w.addr('btc')
      const d = w.addr('btc', { entity: fx, label: 'eXch — Adresse de dépôt', tags: ['deposit'] })
      const t = entryT + r.float(-2, 7) * DAY
      w.fund(c, roundCoin(w, 0.01, 0.9, 0.0001), t - r.int(2, 30) * HOUR)
      forwardAll(w, c, d, t)
      forwardAll(w, d, fxHot, t + r.int(10, 60) * 60, undefined, ['sweep'])
    }
    // Activité de l'exchange, générée dans l'ordre chronologique (voir chronoNoise)
    chronoNoise(w, dest, 14, exitT - 2 * DAY, exitT + 2 * DAY)

    const entryUsd = usd('BTC', entryBtc)
    const quoteGapPct = (Math.abs(quoted - exitBtc) / exitBtc) * 100
    const quoteGapTxt = quoteGapPct < 0.05 ? 'moins de 0,05 %' : `${quoteGapPct.toFixed(2).replace('.', ',')} %`
    // Délai observé entre l'entrée chez eXch et le paiement de sortie (heures)
    const xmrH = Math.round(((exitTx.time - entryTx.time) / 3600) * 10) / 10
    const destName = dest.entity.name

    return {
      world: w,
      title: `Faux support technique et Monero — ${city}`,
      briefing:
        `Depuis plusieurs semaines, une fausse fenêtre d'alerte (« Votre ordinateur est infecté, appelez immédiatement le support ») bloque le navigateur d'internautes francophones, souvent âgés. Au téléphone, un pseudo-technicien prend la main à distance sur l'ordinateur puis exige des « frais de dépannage » payables uniquement en bitcoins. ${victimName} (${city}) a payé et porté plainte ; ${nPay} paiements ont été identifiés sur l'adresse BTC indiquée aux victimes.\n\n` +
        `L'exploitation du téléphone d'un téléopérateur interpellé, ${opName}, a révélé une conversation Telegram avec le responsable présumé du centre d'appels, @${handle}. Il s'y vante d'avoir « tout passé en Monero ».\n\n` +
        `Monero masque l'émetteur, le destinataire et le montant : on ne peut pas suivre les fonds à l'intérieur. Il reste deux bords observables, côté Bitcoin : l'entrée vers l'échangeur et, peut-être, une sortie quelques jours plus tard. Avant le passage en Monero, l'organisation a aussi rémunéré ses téléopérateurs : ces paiements sont autant de pistes vers les membres du réseau. Utilisez l'outil de corrélation et les éléments OSINT, et mesurez la force de vos conclusions.`,
      evidence: [
        {
          id: 'consignes', type: 'capture', title: 'Capture — consignes de paiement laissées sur l\'ordinateur de la victime', date: complainantT - r.int(1, 3) * HOUR, author: '« Service technique agréé »',
          body:
            `SUPPORT TECHNIQUE — DOSSIER N° ${r.int(10000, 99999)}\n\n` +
            `Intervention : suppression de virus bancaire + licence de protection 3 ans\n` +
            `Montant à régler : ${amt(complainantValue, 'BTC')}\n` +
            `Paiement UNIQUEMENT en Bitcoin, vers l'adresse sécurisée du service :\n${A(w, s)}\n\n` +
            `Ne raccrochez pas pendant l'opération. Ne prévenez pas votre banque, cela bloquerait la réparation.`,
        },
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(20), author: victimName,
          body: `« Le technicien avait la main sur mon ordinateur. Il m'a fait installer une application et acheter des bitcoins, puis j'ai payé ${amt(complainantValue, 'BTC')} en suivant ses instructions. Adresse d'envoi : ${A(w, complainantAddr)}. Transaction : ${complainantTx} »`,
        },
        {
          id: 'telegram', type: 'telegram', title: 'Telegram — extraction du téléphone du téléopérateur', author: `@${handle}`, date: msgT,
          body:
            `[${fmtDate(commTx.time + 20 * 60)}] @${handle} : commissions envoyées à toute l'équipe, vérifiez vos wallets\n` +
            `[${fmtDate(entryT + 50 * 60)}] @${handle} : le reste est passé en XMR chez eXch 🔒 qu'ils viennent me chercher 😂\n` +
            `[${fmtDate(entryT + 70 * 60)}] téléopérateur : et tu ressors quand ? on attend la prime de fin de mois\n` +
            `[${fmtDate(entryT + 75 * 60)}] @${handle} : je laisse dormir quelques jours\n` +
            `[${fmtDate(msgT)}] @${handle} : c'est ressorti en BTC, ${quoted.toLocaleString('fr-FR')} tout propre 🧼 je mets direct sur mon compte`,
        },
        {
          id: 'extraction', type: 'extraction', title: `Extraction — application portefeuille du téléphone de ${opName}`, date: w.at(10 * 24), author: 'Service régional d\'investigation numérique',
          body:
            `Application : portefeuille Bitcoin mobile (non custodial)\n` +
            `Historique : 1 réception\n` +
            `— le ${fmtDate(commTx.time)} : + ${amt(opValues[0], 'BTC')} (statut : confirmé)\n` +
            `Adresse de réception : non affichée par l'application (affichage tronqué lors de l'extraction).\n` +
            `Phrase de récupération : non retrouvée.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o5', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.01,
          prompt: 'Quel montant total (BTC) l\'adresse de collecte a-t-elle reçu des victimes ?',
          answer: collectedBtc,
          hint: `Additionnez les ${nPay} paiements entrants de l'adresse de collecte (fiche de l'adresse).`,
          explanation: `Les ${nPay} paiements cumulent ${amt(collectedBtc, 'BTC')} (≈ ${Math.round(usd('BTC', collectedBtc)).toLocaleString('fr-FR')} $). C'est le produit brut de l'escroquerie visible on-chain : il fonde l'évaluation du préjudice et permet ensuite de mesurer la part versée aux téléopérateurs et la part passée en Monero.`,
        },
        {
          id: 'o10', type: 'addresses', points: 10,
          prompt: 'Avant le passage en Monero, l\'organisation a payé ses téléopérateurs. Sélectionnez les adresses rémunérées.',
          answer: [...opAddrs],
          hint: 'L\'adresse de collecte effectue une transaction à plusieurs sorties peu avant de se vider chez eXch ; l\'une des sorties revient à l\'adresse de collecte elle-même.',
          explanation: `La transaction ${commTx.hash.slice(0, 14)}… (${fmtDate(commTx.time)}) verse ${nOps} montants (${opValues.map((v) => amt(v, 'BTC')).join(', ')}, soit ${amt(commTotal, 'BTC')}) à des adresses neuves et renvoie le reste sur l'adresse de collecte (réutilisation d'adresse : ce retour est le rendu, pas un téléopérateur). Le message « commissions envoyées » confirme la lecture. Chaque adresse est une piste vers un membre du réseau.`,
        },
        {
          id: 'o11', type: 'address', points: 9,
          prompt: `Laquelle de ces adresses appartient au téléopérateur interpellé, ${opName} ?`,
          answer: [opAddrs[0]],
          hint: 'L\'extraction de son téléphone indique le montant exact reçu et sa date : comparez avec les sorties de la transaction de commissions.',
          explanation: `Seule la sortie de ${amt(opValues[0], 'BTC')} vers ${A(w, opAddrs[0])} correspond à la réception affichée par l'application du téléphone saisi, à la même date. Ce rapprochement relie formellement ${opName} au circuit de l'escroquerie (il a été payé par l'adresse de collecte des victimes), élément utile pour son audition.`,
        },
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Point d\'entrée : sur quelle adresse de dépôt eXch les bitcoins collectés auprès des victimes ont-ils été envoyés ?',
          answer: [fxDep],
          hint: 'Suivez la transaction qui vide l\'adresse de collecte : la destination est une adresse de dépôt d\'échangeur, balayée peu après vers son hot wallet.',
          explanation: `Le ${fmtDate(entryT)}, ${amt(entryBtc, 'BTC')} (≈ ${Math.round(entryUsd).toLocaleString('fr-FR')} $) partent sur ${A(w, fxDep)}, aussitôt balayée vers le hot wallet BTC d'eXch. Côté Monero, plus rien n'est visible. ${procedureFor(fx)}`,
        },
        {
          id: 'o2', type: 'address', points: 14,
          prompt: 'Quelle adresse BTC est le candidat de sortie le plus probable (paiement eXch au suspect) ?',
          answer: [x1],
          hint: `Corrélez à partir du message Telegram, pas du dépôt d'entrée : émetteur eXch, chaîne Bitcoin, fenêtre de 24 h précédant le message, montant ≈ ${quoted.toLocaleString('fr-FR')} BTC, tolérance élargie (~5 %). Examinez ensuite ce que fait chaque candidat.`,
          explanation: `${A(w, x1)} reçoit ${amt(exitBtc, 'BTC')} d'eXch ${Math.round((msgT - exitT) / 60)} minutes avant le message, montant compatible avec « ${quoted.toLocaleString('fr-FR')} », puis dépose tout sur ${destName} (« direct sur mon compte »). Les autres candidats ont un montant moins proche ou un horaire incompatible, ou finissent dans un casino.`,
        },
        {
          id: 'o8', type: 'address', points: 8,
          prompt: 'Parmi les candidats écartés dans la fenêtre de 24 h, lequel envoie ensuite une partie de ses fonds vers un casino ?',
          answer: [dA],
          hint: 'Reprenez les candidats de la corrélation et dépliez la dépense de chacun.',
          explanation: `${A(w, dA)} reçoit d'eXch ${amt(decoyA.outputs.find((o) => o.address === dA)!.value, 'BTC')}, à quelques % du montant annoncé, puis envoie une partie de ses fonds à OrbitCasino : rien ne correspond au « direct sur mon compte » du message, et le montant est moins proche que celui du candidat retenu. Le documenter dans le rapport montre que les hypothèses concurrentes ont été examinées et écartées pour des raisons objectives.`,
        },
        {
          id: 'o6', type: 'number', points: 8, tolerance: 2, unit: 'heures',
          prompt: 'Combien d\'heures séparent le dépôt d\'entrée chez eXch du paiement de sortie au suspect ?',
          answer: xmrH,
          hint: 'Comparez l\'horodatage de la transaction vers l\'adresse de dépôt eXch et celui du paiement reçu par le candidat de sortie.',
          explanation: `Entrée le ${fmtDate(entryTx.time)}, sortie le ${fmtDate(exitTx.time)} : environ ${Math.round(xmrH)} h (${(xmrH / 24).toFixed(1).replace('.', ',')} jours). Ce délai, cohérent avec « je laisse dormir quelques jours », explique pourquoi une corrélation lancée depuis le dépôt d'entrée, avec une fenêtre courte, ne pouvait rien donner.`,
        },
        {
          id: 'o9', type: 'address', points: 9,
          prompt: 'Sur quelle adresse de dépôt d\'exchange le candidat de sortie verse-t-il ses bitcoins ?',
          answer: [depAddr],
          hint: 'Suivez la dépense du candidat de sortie : l\'adresse reçue est ensuite regroupée avec d\'autres vers un portefeuille chaud étiqueté.',
          explanation: `${A(w, depAddr)} reçoit ${amt(depValue, 'BTC')} le ${fmtDate(depTx.time)}, puis est balayée vers le portefeuille chaud de ${destName} avec d'autres dépôts : c'est l'adresse de dépôt propre au compte du suspect, à viser précisément dans la réquisition.`,
        },
        {
          id: 'o3', type: 'entity', points: 10,
          prompt: 'Sur quel exchange les fonds de sortie ont-ils été déposés ?',
          answer: [destKey],
          hint: 'Identifiez le propriétaire du portefeuille chaud qui balaie l\'adresse de dépôt.',
          explanation: `${amt(depValue, 'BTC')} sont déposés sur une adresse de dépôt ${destName}. C'est la réquisition clé : identité du titulaire, IP de connexion, comparaison avec les éléments connus du suspect. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o7', type: 'choice', points: 8,
          prompt: 'Lors d\'une perquisition chez @' + handle + ', quel élément permettrait de reconstituer ses transactions Monero ?',
          ...choice(r,
            'Le fichier de portefeuille Monero ou sa phrase de récupération (clés de vue et de dépense)',
            [
              'Son adresse publique Monero seule, qui suffit à lister ses transactions sur un explorateur',
              'Les journaux de n\'importe quel nœud Monero public, qui enregistrent les montants échangés',
              'Le reçu de commande eXch, qui contient la liste des transactions Monero internes',
            ]),
          hint: 'Sur Monero, les informations sont chiffrées pour le destinataire : qu\'est-ce qui permet de les déchiffrer ?',
          explanation: 'Sur Monero, l\'adresse publique ne permet pas de retrouver les transactions sur un explorateur : il faut la clé de vue (entrées) et, pour les sorties, les données du portefeuille (clé de dépense, fichier). Les nœuds publics ne voient que des données chiffrées. D\'où l\'importance de rechercher le matériel (téléphone, ordinateur, papier de sauvegarde) et de le saisir selon le cadre procédural applicable.',
        },
        {
          id: 'o4', type: 'choice', points: 10,
          prompt: 'Que peut-on honnêtement conclure de cette analyse ?',
          ...choice(r,
            'Attribution probable mais probabiliste : à corroborer par réquisition (KYC, IP) et l\'enquête',
            [
              'Lien certain : la corrélation montant/temps prouve à elle seule l\'identité du titulaire',
              'Aucune conclusion possible : Monero rend toute analyse inutile, l\'affaire doit être classée',
              'Lien certain dès qu\'eXch aura « déchiffré » la blockchain Monero sur réquisition',
            ]),
          hint: 'Distinguez ce que prouve la blockchain (de chaque côté du mur) de ce que suggère la corrélation (à travers le mur).',
          explanation: `Le passage par Monero rompt la preuve on-chain. La sortie est une hypothèse étayée par un faisceau d'indices (écart de ${quoteGapTxt} avec le montant annoncé dans le message, horaire, dépôt immédiat sur un exchange) ; elle devient solide si la réquisition à ${destName} renvoie vers @${handle} (identité, IP, appareil). Noter aussi qu'on ne retrouve que ${Math.round((exitBtc / entryBtc) * 100)} % du montant d'entrée : une partie des XMR a été conservée ou dépensée ailleurs, et la corrélation à partir du dépôt d'entrée échoue.`,
        },
      ],
      truth: {
        path: [...pays, commTx.id, entryTx.id, sweepTx.id, exitTx.id, dep.tx.id, ...(dep.sweep ? [dep.sweep.id] : [])],
        addresses: [s, fxDep, x1, dep.deposit, ...opAddrs],
        debrief:
          `1. ${nPay} victimes du faux support technique versent ${amt(collectedBtc, 'BTC')} sur ${A(w, s)}.\n` +
          `2. Le ${fmtDate(commTx.time)}, l'adresse de collecte rémunère ${nOps} téléopérateurs (${amt(commTotal, 'BTC')} au total), dont ${opName} (${A(w, opAddrs[0])}, ${amt(opValues[0], 'BTC')}, montant retrouvé dans son téléphone).\n` +
          `3. Le ${fmtDate(entryT)}, le suspect envoie ${amt(entryBtc, 'BTC')} sur une adresse de dépôt eXch (commande BTC → XMR). Les XMR disparaissent de toute analyse publique : adresses furtives (stealth), signatures en anneau et montants masqués (RingCT).\n` +
          `4. Environ ${Math.round(xmrH)} h plus tard, une commande XMR → BTC fait payer ${amt(exitBtc, 'BTC')} par le hot wallet eXch vers ${A(w, x1)}, au milieu de dizaines d'autres paiements ; un candidat proche (${A(w, dA)}) est écarté (casino, montant moins proche).\n` +
          `5. Le message Telegram (« ${quoted.toLocaleString('fr-FR')} », « direct sur mon compte ») permet de cibler la corrélation ; ${A(w, x1)} dépose ensuite tout sur l'adresse ${A(w, depAddr)} de ${destName}.\n\n` +
          `À retenir : face à Monero, on travaille sur les bords (entrée/sortie), avec des fenêtres et tolérances larges, et on croise avec l'OSINT. Le résultat est une attribution probabiliste qu'il faut présenter comme telle dans la procédure et corroborer (réquisition exchange, téléphonie, perquisition : un portefeuille Monero saisi chez le suspect, avec ses clés, permettrait de reconstituer ses transactions — la clé de vue révèle les entrées, le fichier de portefeuille les sorties). Les paiements aux téléopérateurs, eux, restent entièrement on-chain.`,
      },
      hints: [
        'L\'adresse de collecte figure dans les consignes de paiement : dépliez ses entrées (victimes) puis ses sorties (commissions, puis eXch).',
        'Corréler à partir du dépôt d\'entrée ne donne rien : les montants et le délai ne correspondent pas. Partez du dernier message Telegram.',
        'Dans l\'outil de corrélation : émetteur eXch, Bitcoin, début 24 h avant le message, fenêtre 24 h, tolérance d\'environ 5 %.',
        'Parmi les candidats, cherchez celui qui envoie ses fonds « direct » sur un compte d\'exchange.',
      ],
    }
  },
}
