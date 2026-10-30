import { World, type Tx } from '../engine/world'
import { atm, exchange, HOUR, DAY } from '../engine/patterns'
import { createHdWallet } from '../engine/hd'
import { EUR_USD, fromUsd, roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fmtDate, forwardAll, procedureFor } from './util'

const r2 = (v: number) => Math.round(v * 100) / 100
const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const fmtUsdInt = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`
const PRICES = [20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250]
const CHANNELS = ['🍀 Le Trèfle Livraison', '❄️ Snow Express', '🌿 Green Delivery', '🚀 Fusée Drive', '🔥 Le Comptoir']
const SHOPS = ['bureau de tabac de la place du Marché', 'bureau de tabac de l\'avenue de la Gare', 'centre commercial des Portes, niveau 0', 'tabac-presse du boulevard Victor-Hugo']

/** Début du jour calendaire (heure de Paris) contenant `ts`. */
function parisDayStart(ts: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts * 1000))
  const g = (k: string) => Number(parts.find((p) => p.type === k)?.value ?? 0)
  return ts - (g('hour') * 3600 + g('minute') * 60 + g('second'))
}

interface Payment {
  tx: Tx
  chain: 'btc' | 'tron'
  usd: number
  week: number
}

export const btcStupsTelegram: ScenarioTemplate = {
  id: 'stups-telegram',
  title: 'Le canal Telegram du quartier',
  tagline: 'Un menu sur Telegram, des adresses qui changent chaque semaine, des collecteurs et un distributeur de billets.',
  description:
    'Un réseau local de trafic de stupéfiants vend par l\'intermédiaire d\'un canal Telegram. Les clients paient de petits montants en bitcoins ou en USDT (Tron) sur des adresses renouvelées chaque semaine. Un achat a été réalisé dans le cadre d\'une enquête sous pseudonyme. Remontez jusqu\'aux collecteurs, chiffrez l\'activité, identifiez les circuits de conversion en espèces et les actes urgents.',
  difficulty: 2,
  chains: ['btc', 'tron'],
  skills: ['utxo', 'cioh', 'tron', 'tokens', 'exchange_id', 'requisition'],
  estMinutes: 45,
  lessons: ['stupefiants-crypto', 'dab-cash-p2p', 'tron-usdt', 'portefeuilles-hd', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const channel = r.pick(CHANNELS)
    const admin = fakeHandle(r)
    const alias = r.pick(['Léo_92', 'Max.R', 'Nico B', 'Sam_K', 'Yanis.L'])
    const shop = r.pick(SHOPS)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const dab = atm(w, 'cryptoguichet', 'btc')
    const cv = exchange(w, 'coinhouse', 'btc')
    const exT = exchange(w, r.pick(['binance', 'okx'] as const), 'tron')
    const satsdesk = w.entity('satsdesk')
    const otc = w.addr('tron', { entity: satsdesk, label: 'SatsDesk OTC — Portefeuille de règlement', tags: ['liquid', 'hot'] })
    const net = w.customEntity({ name: `Réseau « ${channel.replace(/^\S+ /, '')} » (non identifié)`, category: 'suspect' })
    const ucE = w.customEntity({ name: 'Service enquêteur (achat sous pseudonyme)', category: 'individual' })
    const hd = createHdWallet(w, { chain: 'btc', kind: 'p2wpkh', entity: net, label: 'Caisse BTC du canal' })
    const K = w.addr('btc', { entity: net, kind: 'p2wpkh' })
    const KT = w.addr('tron', { entity: net })

    // ── Semaines de vente ────────────────────────────────────────────────────
    const nW = r.int(4, 5)
    const t0 = w.at(0)
    const wb = Array.from({ length: nW }, (_, k) => hd.receive(k))
    const wt = Array.from({ length: nW }, () => w.addr('tron', { entity: net }))
    const ucWeek = nW - 2
    const pays: Payment[] = []
    let ucTx: Tx | undefined
    let ucValue = 0
    const priceEur = () => r.pick(PRICES)
    const payBtc = (to: string, time: number, week: number, uc = false) => {
      const eur = priceEur()
      const value = roundAsset('BTC', fromUsd('BTC', eur * EUR_USD * r.float(0.98, 1.03)))
      let tx: Tx
      if (uc) {
        const svc = w.addr('btc', { entity: ucE, kind: 'p2wpkh' })
        tx = w.fund(to, value, time, { from: [svc] })
        ucTx = tx
        ucValue = value
      } else if (r.chance(0.3)) {
        // Client qui achète ses bitcoins en espèces au distributeur avant de payer
        const cust = w.addr('btc', { kind: 'p2wpkh' })
        const buy = dab.cashIn({ cashEur: Math.ceil((eur * 1.25) / 10) * 10 + 10, to: cust, time: time - Math.round(r.float(0.3, 20) * HOUR) })
        tx = w.utxoTx({ time, from: [cust], to: [{ address: to, value: Math.min(value, r8(buy.value - 0.00005)) }] })
      } else {
        tx = w.fund(to, value, time)
      }
      pays.push({ tx, chain: 'btc', usd: usd('BTC', w.flowIn(tx, to)[0].value), week })
      return tx
    }
    const payTron = (to: string, time: number, week: number) => {
      const value = r2(priceEur() * EUR_USD)
      const cust = w.addr('tron')
      if (r.chance(0.6)) exT.withdraw(cust, r2(value + r.int(0, 25)), time - Math.round(r.float(0.2, 30) * HOUR), 'USDT')
      const tx = w.transfer({ time, from: cust, to, value, asset: 'USDT' })
      pays.push({ tx, chain: 'tron', usd: value, week })
      return tx
    }

    const sweeps: Tx[] = []
    const tronIn: { time: number; value: number }[] = []
    const tickets: { tx: Tx; cashEur: number; deposit: string }[] = []
    const otcTxs: Tx[] = []
    let latePaid = 0
    const sweepTimes: number[] = []
    for (let k = 0; k < nW; k++) {
      const ws = t0 + k * 7 * DAY
      const nb = r.int(3, 6)
      const nt = r.int(3, 5)
      const ucAt = k === ucWeek ? r.int(0, nb - 1) : -1
      const tb = Array.from({ length: nb }, () => ws + Math.round(r.float(2, 160) * HOUR)).sort((a, b) => a - b)
      tb.forEach((tt, i) => payBtc(wb[k], tt, k, i === ucAt))
      const tts = Array.from({ length: nt }, () => ws + Math.round(r.float(2, 160) * HOUR)).sort((a, b) => a - b)
      const tronVals = tts.map((tt) => payTron(wt[k], tt, k))
      // Regroupement hebdomadaire vers les collecteurs
      const tSweep = ws + 7 * DAY + Math.round(r.float(2, 14) * HOUR)
      sweepTimes.push(tSweep)
      sweeps.push(forwardAll(w, wb[k], K, tSweep))
      const sumT = r2(tronVals.reduce((s, x) => s + x.transfers[0].value, 0))
      sweeps.push(w.transfer({ time: tSweep + r.int(300, 3600), from: wt[k], to: KT, value: sumT, asset: 'USDT' }))
      tronIn.push({ time: tSweep, value: sumT })
      // Client retardataire : paie l'adresse de la semaine précédente après le regroupement
      if (k >= 1 && latePaid < 2 && r.chance(0.6)) {
        payBtc(wb[k - 1], sweepTimes[k - 1] + Math.round(r.float(2, 90) * HOUR), k - 1)
        latePaid++
      }
      // Conversion en espèces au distributeur, par tickets sous 1 000 €
      if (k >= 1) {
        let prevT = tSweep
        for (let j = 0; j < r.int(1, 2); j++) {
          // Retrait aux heures d'ouverture du commerce qui héberge le distributeur
          let tt = parisDayStart(prevT + Math.round(r.float(6, 40) * HOUR)) + Math.round(r.float(9.5, 19.5) * HOUR)
          while (tt <= prevT + HOUR) tt += DAY
          prevT = tt
          const balEur = usd('BTC', w.unspentValue(K, tt)) / EUR_USD
          const eur = Math.min(950, Math.floor((balEur * r.float(0.55, 0.8)) / 10) * 10)
          if (eur < 150) continue
          const value = roundAsset('BTC', fromUsd('BTC', eur * EUR_USD))
          const res = dab.cashOut({ from: K, value, time: tt, change: K })
          tickets.push({ tx: res.tx, cashEur: res.cashEur, deposit: res.deposit })
        }
      }
    }
    // USDT : règlement de gré à gré (OTC) contre espèces, en deux fois
    const tEnd = t0 + nW * 7 * DAY + Math.round(r.float(1, 3) * DAY)
    const mid = Math.max(1, nW - 2)
    const firstOtc = r2(tronIn.slice(0, mid).reduce((s, x) => s + x.value, 0) * r.float(0.75, 0.9))
    otcTxs.push(w.transfer({ time: tronIn[mid - 1].time + Math.round(r.float(10, 40) * HOUR), from: KT, to: otc, value: firstOtc, asset: 'USDT' }))
    otcTxs.push(w.transfer({ time: tEnd + Math.round(r.float(2, 30) * HOUR), from: KT, to: otc, value: r2(w.balanceOf(KT, 'USDT') - r.float(5, 60)), asset: 'USDT' }))

    // ── Bruit ────────────────────────────────────────────────────────────────
    dab.noise(22, t0 - 5 * DAY, tEnd + 5 * DAY)
    cv.noise(8, t0 - 5 * DAY, tEnd)
    exT.noise(12, t0 - 5 * DAY, tEnd + 3 * DAY, 'USDT')
    // Autres clients du courtier (qui conservent ou dépensent aussi ailleurs)
    for (let i = 0; i < r.int(3, 5); i++) {
      const c = w.addr('tron')
      const tc = Math.round(r.float(t0, tEnd + 5 * DAY))
      const vo = r2(r.float(3000, 40000))
      w.transfer({ time: tc, from: c, to: otc, value: vo, asset: 'USDT' })
      w.transfer({ time: tc + Math.round(r.float(1, 72) * HOUR), from: c, to: w.addr('tron'), value: r2(vo * r.float(0.3, 0.8)), asset: 'USDT' })
    }

    // ── Valeurs ──────────────────────────────────────────────────────────────
    const nPays = pays.length
    const turnover = Math.round(pays.reduce((s, p) => s + p.usd, 0))
    const nBtc = pays.filter((p) => p.chain === 'btc').length
    const btcUsd = pays.filter((p) => p.chain === 'btc').reduce((s, p) => s + p.usd, 0)
    const cashTotal = tickets.reduce((s, x) => s + x.cashEur, 0)
    const otcTotal = r2(otcTxs.reduce((s, x) => s + x.transfers[0].value, 0))
    const lastTicket = tickets[tickets.length - 1]
    const tCourier = t0 + (nW - 1) * 7 * DAY + Math.round(r.float(30, 120) * HOUR)
    const tNow = Math.max(tEnd, ...otcTxs.map((x) => x.time), ...(lastTicket ? [lastTicket.tx.time] : [])) + Math.round(r.float(2, 6) * DAY)
    const daysSinceLast = lastTicket ? Math.round((tNow - lastTicket.tx.time) / DAY) : 0
    const ucT = ucTx!
    // Solde USDT laissé sur le collecteur après le second règlement OTC (gelable par l'émetteur)
    const ktLeft = r2(w.balanceOf(KT, 'USDT'))
    const nTicketsBig = tickets.filter((x) => x.cashEur >= 900).length

    return {
      world: w,
      title: `Trafic de stupéfiants via Telegram — ${city}`,
      briefing:
        `À ${city}, un canal Telegram, « ${channel} », propose la livraison de stupéfiants à domicile. Les commandes se passent par messagerie ; le paiement se fait en bitcoins ou en USDT sur le réseau Tron, sur des adresses que le canal renouvelle chaque semaine. Un livreur interpellé en flagrant délit avait sur son téléphone une application de suivi des paiements.\n\n` +
        `Un achat a été réalisé par un enquêteur habilité agissant sous pseudonyme, sur autorisation du magistrat. Le paiement figure au procès-verbal.\n\n` +
        `Objectif : remonter des adresses de paiement aux portefeuilles qui regroupent les fonds, chiffrer l'activité du canal sur la période, et identifier comment le réseau transforme ses crypto-actifs en espèces, pour engager sans tarder les réquisitions utiles.`,
      evidence: [
        {
          id: 'canal', type: 'telegram', title: `Canal Telegram « ${channel} » — messages visibles (capture)`, date: t0 + (nW - 1) * 7 * DAY + Math.round(r.float(1, 6) * HOUR), author: `@${admin} (administrateur)`,
          body:
            `📋 MENU de la semaine — livraison 7j/7 de 14h à 2h, ${city} et alentours\n` +
            `Paiement crypto UNIQUEMENT. Les adresses changent chaque semaine : vérifie toujours le dernier message épinglé ❗\n\n` +
            `[${fmtDate(t0 + (nW - 2) * 7 * DAY + Math.round(r.float(1, 5) * HOUR))}] 📌 Adresses de la semaine\nBTC : ${A(w, wb[nW - 2])}\nUSDT (TRC20 uniquement) : ${A(w, wt[nW - 2])}\n\n` +
            `[${fmtDate(t0 + (nW - 1) * 7 * DAY + Math.round(r.float(1, 5) * HOUR))}] 📌 Adresses de la semaine\nBTC : ${A(w, wb[nW - 1])}\nUSDT (TRC20 uniquement) : ${A(w, wt[nW - 1])}\n\n` +
            `Les messages plus anciens ont été supprimés (messages éphémères).`,
        },
        {
          id: 'pseudo', type: 'pv', title: 'Procès-verbal d\'enquête sous pseudonyme (extrait)', date: ucT.time + Math.round(r.float(1, 4) * HOUR), author: 'Enquêteur spécialement habilité — section de recherches',
          body:
            `Agissant en application de l'article 230-46 du code de procédure pénale, sous l'identité d'emprunt « ${alias} », en vertu de l'autorisation d'acquisition délivrée par le procureur de la République.\n\n` +
            `Avons répondu au menu publié sur le canal, sans formuler d'autre demande que la commande d'une quantité usuelle proposée au menu. Avons réglé le prix annoncé, soit ${amt(ucValue, 'BTC')}, depuis le portefeuille du service, sur l'adresse indiquée pour la semaine : ${A(w, wb[ucWeek])}.\n` +
            `Transaction : ${ucT.hash} (${fmtDate(ucT.time)}).\n` +
            `La livraison a été effectuée le jour même ; le produit a été placé sous scellé.`,
        },
        {
          id: 'livreur', type: 'extraction', title: 'Exploitation du téléphone du livreur — application de suivi', date: tCourier + Math.round(r.float(1, 3) * DAY), author: 'Cellule d\'appui numérique',
          body:
            `Téléphone isolé du réseau dès l'interpellation ; extraction sur copie, empreinte consignée.\n\n` +
            `Application de portefeuille en lecture seule nommée « Caisse », utilisée selon le livreur pour « vérifier que le client a payé avant de donner ». Clé importée :\n${hd.xpub}\n\n` +
            `Aucune clé privée. Aucune adresse Tron configurée : selon le livreur, « pour les USDT, c'est le chef qui vérifie ».`,
        },
        {
          id: 'surveillance', type: 'pv', title: 'Procès-verbal de surveillance (extrait)', date: lastTicket ? lastTicket.tx.time + Math.round(r.float(1, 6) * HOUR) : tNow, author: 'Section de recherches',
          body:
            `Le ${lastTicket ? fmtDate(lastTicket.tx.time) : fmtDate(tNow)}, un individu au profil correspondant au « chef » décrit par le livreur est observé au ${shop} de ${city}. Il utilise le distributeur automatique de crypto-actifs installé dans le commerce, puis repart avec des billets. Il n'a pas pu être suivi au-delà.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Sur quelle adresse le réseau regroupe-t-il les paiements Bitcoin des clients ?',
          answer: [K],
          hint: 'Partez du paiement de l\'achat sous pseudonyme et suivez la sortie de l\'adresse de la semaine.',
          explanation: `Chaque semaine, l'adresse BTC de la semaine écoulée est vidée vers ${A(w, K)}. Les ${nW} adresses hebdomadaires dérivent toutes de la clé publique étendue trouvée chez le livreur (m/84'/0'/0'/0/0 à ${nW - 1}) : un seul portefeuille derrière les rotations. Le collecteur, lui, est une adresse distincte, réutilisée à chaque regroupement.`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Que permet la clé publique étendue trouvée dans le téléphone du livreur ?',
          ...choice(r,
            'Dériver et surveiller toutes les adresses de réception BTC du portefeuille, y compris les prochaines, sans pouvoir dépenser les fonds',
            [
              'Transférer les bitcoins du réseau vers une adresse de saisie du service',
              'Identifier les adresses USDT du canal, la même clé servant sur Tron',
              'Rien de plus que l\'adresse de la semaine en cours, chaque adresse ayant une clé indépendante',
            ]),
          hint: 'Une clé publique étendue (xpub/zpub) contient-elle une clé privée ? Sur quelle chaîne et quel chemin de dérivation porte-t-elle ?',
          explanation: `La zpub permet de recalculer toutes les adresses publiques du compte (m/84'/0'/0'/0/i), passées et futures : les adresses des semaines non conservées sur le canal réapparaissent, et celles des semaines à venir peuvent être surveillées dès maintenant. Elle ne contient aucune clé privée : impossible de dépenser ou de saisir les fonds avec elle. Elle ne vaut que pour ce portefeuille Bitcoin ; les adresses Tron du canal se retrouvent par leur collecteur commun.`,
        },
        {
          id: 'o2', type: 'number', points: 9, tolerance: 2, unit: 'paiements',
          prompt: 'Combien de paiements de clients (BTC et USDT, achat sous pseudonyme compris) les adresses hebdomadaires ont-elles reçus sur la période ?',
          answer: nPays,
          hint: 'Côté BTC, l\'outil « Dérivation HD » liste toutes les adresses hebdomadaires. Côté Tron, l\'onglet « Dépôt » d\'une adresse hebdomadaire connue liste les autres adresses qui reversent tout au même collecteur. Additionnez les transactions entrantes de chacune.',
          explanation: `${nPays} paiements : ${nBtc} en BTC sur ${nW} adresses (dont ${latePaid ? `${latePaid} versé${latePaid > 1 ? 's' : ''} en retard sur l'adresse d'une semaine déjà regroupée, et ` : ''}l'achat sous pseudonyme) et ${nPays - nBtc} en USDT sur ${nW} adresses Tron. Chaque paiement correspond vraisemblablement à une transaction de stupéfiants : ce chiffrage nourrit la qualification et le volume du trafic.`,
        },
        {
          id: 'o3', type: 'amount', points: 9, unit: 'USD', tolerance: 0.03,
          prompt: 'Quel chiffre d\'affaires total (en dollars) ces paiements représentent-ils ?',
          answer: turnover,
          hint: 'Le « Total reçu » de chaque adresse hebdomadaire est affiché en dollars dans l\'inspecteur.',
          explanation: `≈ ${fmtUsdInt(turnover)} (≈ ${Math.round(turnover / EUR_USD).toLocaleString('fr-FR')} €) : ${fmtUsdInt(btcUsd)} en BTC et ${fmtUsdInt(turnover - btcUsd)} en USDT, pour un panier moyen de ${Math.round(turnover / nPays / EUR_USD)} €. Les montants reçus par les collecteurs sont légèrement inférieurs (frais de réseau, paiements retardataires non regroupés).`,
        },
        {
          id: 'o4', type: 'entity', points: 10,
          prompt: 'Quel exploitant faut-il requérir pour identifier la personne qui convertit en espèces les bitcoins regroupés ?',
          answer: ['cryptoguichet'],
          hint: 'Suivez les sorties du collecteur Bitcoin : petites sommes, adresses à usage unique, toutes attribuées au même service.',
          explanation: `Le collecteur envoie ${tickets.length} tickets de vente au distributeur (${cashTotal.toLocaleString('fr-FR')} € d'espèces au total), chacun sous 1 000 € : le seuil au-delà duquel l'exploitant exige une pièce d'identité. Ce fractionnement est un indicateur de blanchiment. Les données du ticket (téléphone vérifié par SMS, appareil, heure, image) permettent d'identifier le porteur. ${procedureFor(dab.entity)}`,
        },
        {
          id: 'o9', type: 'number', points: 9, tolerance: 0, unit: 'tickets',
          prompt: 'Combien de tickets de vente au distributeur le collecteur Bitcoin a-t-il émis ?',
          answer: tickets.length,
          hint: 'Dépliez les sorties du collecteur Bitcoin : chaque envoi vers une adresse de ticket de l\'exploitant (hors rendu) est une vente contre espèces.',
          explanation: `${tickets.length} tickets, du ${fmtDate(tickets[0].tx.time, false)} au ${fmtDate(lastTicket.tx.time, false)}, pour ${cashTotal.toLocaleString('fr-FR')} € remis en espèces${nTicketsBig ? `, dont ${nTicketsBig} juste sous le plafond de 1 000 €` : ''}. Chaque ticket a sa propre adresse de réception et revient en rendu sur le collecteur : le réseau fractionne volontairement pour rester sous le seuil d'identité de l'exploitant. La réquisition doit lister chaque ticket (hash, horodatage, adresse de ticket).`,
        },
        {
          id: 'o10', type: 'tx', points: 9,
          prompt: 'Quelle transaction correspond au retrait d\'espèces observé lors de la surveillance ?',
          answer: [lastTicket.tx.id],
          hint: 'Le procès-verbal de surveillance date précisément la scène : cherchez le ticket de vente émis par le collecteur à ce moment-là.',
          explanation: `La transaction ${lastTicket.tx.hash.slice(0, 16)}… (${fmtDate(lastTicket.tx.time)}) envoie le prix d'un ticket de ${lastTicket.cashEur.toLocaleString('fr-FR')} € du collecteur vers ${A(w, lastTicket.deposit).slice(0, 14)}…, adresse de ticket CryptoGuichet. Le rapprochement entre l'observation physique et la transaction est un élément fort : la réquisition de l'exploitant sur ce ticket précis (téléphone vérifié, images de l'appareil) doit permettre d'identifier le « chef » observé, et de démontrer qu'il dispose des clés du collecteur.`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Le dernier retrait d\'espèces date de quelques jours. Quelle démarche s\'impose ?',
          ...choice(r,
            'Requérir sans délai l\'exploitant : tickets, téléphone et images de l\'appareil, conservées peu de temps',
            [
              'Attendre l\'identification complète du réseau pour adresser une seule réquisition groupée',
              'Se fonder sur les seules données on-chain, l\'adresse de ticket suffisant à identifier le client',
              'Demander au buraliste de remettre les images, l\'exploitant ne conservant aucune donnée',
            ]),
          hint: 'Quelles données l\'exploitant détient-il sur un ticket, et combien de temps les conserve-t-il ? Regardez sa fiche conformité.',
          explanation: `La vidéosurveillance des distributeurs n'est conservée que quelques semaines (environ 30 jours selon la fiche de l'exploitant) : le dernier ticket date de ${daysSinceLast} jour${daysSinceLast > 1 ? 's' : ''}, les plus anciens approchent de la limite. Réquisition immédiate pour tous les tickets identifiés (adresses de ticket, horodatages), avec demande expresse de préservation des images. L'adresse de ticket est propre à l'exploitant : on-chain, elle ne dit rien du client. Le commerçant hôte peut détenir ses propres images, en complément.`,
        },
        {
          id: 'o8', type: 'address', points: 9,
          prompt: 'Sur quelle adresse Tron le réseau regroupe-t-il les paiements en USDT ?',
          answer: [KT],
          hint: 'Partez d\'une adresse USDT publiée sur le canal et suivez sa sortie en fin de semaine.',
          explanation: `Chaque adresse USDT hebdomadaire reverse en une fois, en fin de semaine, tout ce qu'elle a reçu à ${A(w, KT)}. Contrairement au Bitcoin, aucune clé étendue ne relie les adresses Tron entre elles : c'est le collecteur commun qui les rassemble. L'onglet « Dépôt » de l'inspecteur fait ressortir ce schéma (adresses à solde nul, reversement intégral vers une même destination), y compris pour les semaines dont l'adresse n'a pas été conservée sur le canal.`,
        },
        {
          id: 'o6', type: 'entity', points: 8,
          prompt: 'Vers quel prestataire les USDT regroupés sont-ils envoyés ?',
          answer: ['satsdesk'],
          hint: 'Identifiez d\'abord le portefeuille qui reçoit les reversements des adresses USDT hebdomadaires, puis suivez ses sorties.',
          explanation: `Les adresses USDT hebdomadaires reversent tout à ${A(w, KT)} (l'heuristique « dépôt / collecteur » de l'inspecteur le fait ressortir), qui envoie ${amt(otcTotal, 'USDT')} en deux fois à SatsDesk OTC, courtier de gré à gré qui règle en espèces. ${procedureFor(satsdesk)} En parallèle, l'émetteur de l'USDT peut être sollicité pour geler le solde résiduel du collecteur.`,
        },
        {
          id: 'o11', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDT le collecteur Tron a-t-il réglé au courtier de gré à gré ?',
          answer: otcTotal,
          hint: 'Additionnez les sorties d\'USDT du collecteur Tron vers le portefeuille de règlement du courtier.',
          explanation: `${otcTxs.map((x) => amt(x.transfers[0].value, 'USDT')).join(' + ')} = ${amt(otcTotal, 'USDT')}, réglés en deux fois (${otcTxs.map((x) => fmtDate(x.time, false)).join(' et ')}). En contrepartie, le courtier remet des espèces hors chaîne. Il ne reste que ${amt(ktLeft, 'USDT')} sur le collecteur, un reliquat que l'émetteur peut geler mais qui ne justifie pas à lui seul l'urgence. ${procedureFor(satsdesk)}`,
        },
        {
          id: 'o7', type: 'choice', points: 8,
          prompt: 'À quelles conditions l\'achat réalisé sous pseudonyme est-il exploitable en procédure ?',
          ...choice(r,
            'Agent habilité, acquisition autorisée par le magistrat, aucune incitation, actes retranscrits en procédure',
            [
              'Tout enquêteur peut acheter sous pseudonyme sans autorisation, dès lors que le PV le mentionne',
              'L\'achat reste valable s\'il pousse le vendeur à proposer davantage que ce qu\'il vend d\'habitude',
              'Le paiement doit partir du compte personnel de l\'enquêteur pour rester crédible auprès du vendeur',
            ]),
          hint: 'Relisez le procès-verbal d\'enquête sous pseudonyme : qui agit, sur quelle autorisation, et dans quelles limites ?',
          explanation: `L'enquête sous pseudonyme (article 230-46 du CPP) est réservée à des agents affectés dans un service spécialisé et spécialement habilités. L'acquisition d'un produit illicite suppose l'autorisation préalable du procureur de la République ou du juge d'instruction, et les actes ne doivent pas inciter à commettre l'infraction, à peine de nullité. Le paiement part des moyens du service et chaque étape est retranscrite au procès-verbal : c'est ce qui permet d'exploiter le hash de transaction comme point de départ.`,
        },
      ],
      truth: {
        path: [...pays.map((p) => p.tx.id), ...sweeps.map((x) => x.id), ...tickets.map((x) => x.tx.id), ...otcTxs.map((x) => x.id)],
        addresses: [wb[ucWeek], K, KT, ...wb, ...wt, ...tickets.map((x) => x.deposit), otc],
        debrief:
          `1. Chaque semaine, le canal publie une adresse BTC (dérivée d'un même portefeuille HD) et une adresse USDT-TRC20. ${nPays} paiements de clients sont reçus en ${nW} semaines, pour ≈ ${fmtUsdInt(turnover)}.\n` +
          `2. L'enquêteur sous pseudonyme paie ${amt(ucValue, 'BTC')} sur l'adresse de la semaine ${ucWeek + 1} (${fmtDate(ucT.time)}).\n` +
          `3. En fin de semaine, les adresses de la semaine sont vidées : BTC vers ${A(w, K)}, USDT vers ${A(w, KT)}.\n` +
          `4. Le collecteur BTC est converti en espèces au distributeur CryptoGuichet du ${shop}, par ${tickets.length} tickets sous le seuil d'identité (${cashTotal.toLocaleString('fr-FR')} €).\n` +
          `   Le dernier ticket (${lastTicket.tx.hash.slice(0, 14)}…, ${fmtDate(lastTicket.tx.time)}) correspond au retrait observé en surveillance.\n` +
          `5. Le collecteur USDT règle ${amt(otcTotal, 'USDT')} à SatsDesk OTC, contre espèces ; il n'y reste que ${amt(ktLeft, 'USDT')}.\n\n` +
          `À retenir : la rotation des adresses ne protège pas un réseau qui regroupe ensuite ses fonds ; un paiement sous pseudonyme suffit à entrer dans le circuit, et une clé publique étendue saisie chez un livreur relie toutes les adresses BTC. Côté sortie, les DAB crypto et le gré à gré sont les points d'identification : réquisition immédiate de l'exploitant, car les images ne sont conservées que quelques semaines.`,
      },
      hints: [
        'Ouvrez le paiement de l\'achat sous pseudonyme (procès-verbal) et suivez la sortie de l\'adresse de la semaine.',
        'La clé publique étendue du téléphone du livreur ouvre l\'outil « Dérivation HD » : toutes les adresses BTC hebdomadaires apparaissent d\'un coup.',
        'Côté Tron, l\'onglet « Dépôt » d\'une adresse USDT hebdomadaire repère le collecteur et les autres adresses qui lui reversent tout ce qu\'elles reçoivent.',
        'Les sorties du collecteur BTC partent vers des adresses à usage unique d\'un même exploitant : ce sont des tickets de vente au distributeur.',
      ],
    }
  },
}
