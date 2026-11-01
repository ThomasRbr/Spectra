import { World } from '../engine/world'
import { dex, exchange, DAY, HOUR } from '../engine/patterns'
import { addLiquidity, aggregator, lpNoise, removeLiquidity } from '../engine/defi'
import { fromUsd, roundAsset, usd, type AssetId } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakePerson, fmtDate, procedureFor } from './util'
import { dusting, lookalikeFlows, otherVictimPayments, personalSpending, type Dressing } from '../engine/realism'

/** Liste française : « A », « A et B », « A, B et C ». */
const listFr = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} et ${xs[xs.length - 1]}`)

/** Ce que révèlent des dépenses personnelles : commerçants payés (lus dans le monde) et particuliers. */
function spendingSummary(w: World, d: Dressing): { shops: string[]; nPeople: number } {
  const shops: string[] = []
  let nPeople = 0
  for (const a of d.addresses) {
    const e = w.get(a).entityId ? w.entities.get(w.get(a).entityId!) : undefined
    if (e) {
      if (!shops.includes(e.name)) shops.push(e.name)
    } else nPeople++
  }
  return { shops, nPeople }
}

export const defiLpBlanchiment: ScenarioTemplate = {
  id: 'lp-blanchiment',
  title: 'Le détour par le pool',
  tagline: 'De l\'ETH volé placé en liquidité sur Uniswap, des parts LP cédées à une adresse « propre », un retrait vers une troisième adresse.',
  description:
    'Les ETH d\'une victime, volés après la saisie de sa phrase de récupération dans une fausse application, sont convertis en partie en USDC puis déposés comme liquidité dans le pool ETH/USDC d\'Uniswap. Les parts LP sont cédées à une adresse neuve, financée en gas par un tiers, qui retire la liquidité vers une troisième adresse : l\'ETH file sur un exchange, mais les USDC s\'arrêtent sur une adresse contrôlée, encore gelables par Circle. Lisez les créations et destructions de parts LP, l\'argument « to » du retrait, l\'origine du gas, et triez une adresse de collecte qui mêle plusieurs victimes et des dépenses personnelles.',
  difficulty: 4,
  chains: ['eth'],
  skills: ['evm', 'defi', 'dex', 'tokens', 'exchange_id', 'requisition'],
  estMinutes: 55,
  lessons: ['pools-liquidite', 'jetons-enveloppes', 'agregateurs-routeurs'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victim = fakePerson(r)
    const g = victim.g
    const city = fakeCity(r)
    const appName = r.pick(['Walletly Pro', 'SafeVault Mobile', 'CoinKeep Wallet', 'EtherNest'])

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const uni = dex(w, 'uniswap', 'eth')
    const agg = aggregator(w, 'oneinch', 'eth', uni)
    const ch = exchange(w, 'coinhouse', 'eth')
    const exGKey = r.pick(['kraken', 'bitstamp', 'coinbase'] as const)
    const exG = exchange(w, exGKey, 'eth')
    const exKey = r.pick(['binance', 'okx', 'huobex'] as const)
    const ex = exchange(w, exKey, 'eth')

    const victimE = w.customEntity({ name: victim.name, category: 'victim' })
    const V = w.addr('eth', { entity: victimE })
    const thiefE = w.customEntity({ name: `Opérateur de la fausse application « ${appName} » (inconnu)`, category: 'scam' })
    const T = w.addr('eth', { entity: thiefE })
    const P = w.addr('eth', { entity: thiefE })
    const Q = w.addr('eth', { entity: thiefE })
    const G = w.addr('eth')

    // ── Historique de la victime ─────────────────────────────────────────────
    const buys = [
      ch.withdraw(V, roundAsset('ETH', r.float(10, 40)), w.at(-r.int(200, 500) * 24)),
      ch.withdraw(V, roundAsset('ETH', r.float(8, 35)), w.at(-r.int(60, 180) * 24)),
      ch.withdraw(V, roundAsset('ETH', r.float(5, 20)), w.at(-r.int(10, 50) * 24)),
    ]
    const S = roundAsset('ETH', w.balanceOf(V, 'ETH') - r.float(0.002, 0.01))

    // ── Le tiers qui fournira le gas ─────────────────────────────────────────
    const gW = exG.withdraw(G, roundAsset('ETH', r.float(0.6, 1.4)), w.at(-r.float(10, 30) * 24))
    for (let i = 0; i < r.int(2, 4); i++) w.transfer({ time: w.at(-r.float(2, 9) * 24), from: G, to: w.addr('eth'), value: roundAsset('ETH', r.float(0.01, 0.06)), asset: 'ETH' })

    // ── Le vol et la mise en liquidité ───────────────────────────────────────
    const theft = w.transfer({ time: w.at(0), from: V, to: T, value: S, asset: 'ETH' })
    const sA = roundAsset('ETH', S * r.float(0.42, 0.5))
    const route: AssetId[] = ['ETH', 'USDT', 'USDC']
    const sw = agg.swap({ trader: T, route, amountIn: sA, time: w.at(r.float(1, 3)) })
    const a = roundAsset('ETH', fromUsd('ETH', sw.amountOut * r.float(0.9, 0.97)))
    const add = addLiquidity(w, uni, { from: T, assetA: 'ETH', amountA: a, assetB: 'USDC', time: w.at(r.float(4, 8)) })
    const lp = add.lp

    // ── Adresse « propre » : gas d'un tiers, puis cession des parts LP ───────
    const gas = w.transfer({ time: w.at(r.float(24, 40)), from: G, to: P, value: roundAsset('ETH', r.float(0.02, 0.07)), asset: 'ETH' })
    const lpMove = w.transfer({ time: w.at(r.float(44, 60)), from: T, to: P, value: lp, asset: 'LP' })

    // ── Retrait de la liquidité vers une troisième adresse ───────────────────
    const drift = (r.chance(0.5) ? 1 : -1) * r.float(0.03, 0.08)
    const rem = removeLiquidity(w, uni, { from: P, assetA: 'ETH', assetB: 'USDC', lp, to: Q, drift, time: w.at(r.float(3, 6) * 24) })
    // L'ETH part sur un exchange ; les USDC, eux, restent sur une adresse
    // contrôlée (encore gelables par leur émetteur tant qu'ils y demeurent).
    const depEth = ex.receive(Q, rem.amountA, rem.tx.time + r.float(1, 5) * HOUR)
    const deposit = depEth.deposit
    const circle = w.entity('circle')
    const R = w.addr('eth', { entity: thiefE })
    const usdcHold = w.transfer({ time: depEth.tx.time + r.float(12, 20) * HOUR, from: Q, to: R, value: rem.amountB, asset: 'USDC' })

    // ── Habillage des adresses du voleur et fausses pistes ───────────────────
    // L'adresse de collecte reçoit l'argent d'autres victimes de la fausse appli,
    // paie des services, subit de l'empoisonnement ; le tiers qui fournit le gas
    // a sa propre vie ; des tiers sans lien envoient le même montant à la même heure.
    otherVictimPayments(w, T, { start: w.at(-30 * 24), end: w.at(-1), n: 5, minUsd: 400, maxUsd: 6000, asset: 'ETH' })
    // Frais de l'escroquerie elle-même : promotion de la fausse appli, hébergement, compte développeur
    const thiefShops = [
      w.customEntity({ name: 'Publivo (régie publicitaire mobile)', category: 'merchant', known: true, description: 'Régie publicitaire pour applications mobiles (fictive), payable en crypto-actifs : conserve les comptes annonceurs et les campagnes diffusées.' }),
      w.customEntity({ name: 'Nubehost (hébergement web)', category: 'merchant', known: true, description: 'Hébergeur web et VPS (fictif) acceptant l\'ETH : conserve l\'adresse e-mail du client, les noms de domaine et les adresses IP de connexion.' }),
      w.customEntity({ name: 'StoreKit Pro (comptes développeur)', category: 'merchant', known: true, description: 'Revendeur (fictif) de comptes développeur pour boutiques d\'applications, payable en crypto-actifs.' }),
    ]
    const tSpend = spendingSummary(w, personalSpending(w, T, { start: w.at(2), end: w.at(20 * 24), n: 3, merchants: thiefShops, maxUsd: 450, asset: 'ETH' }))
    dusting(w, T, { time: w.at(0), n: 4, spreadH: 40 })
    // Vie propre du tiers, postérieure à son premier financement (aucun apport extérieur : petits montants)
    const gShops = [
      w.customEntity({ name: 'Rechargo (recharges mobiles)', category: 'merchant', known: true, description: 'Vente en ligne (fictive) de recharges de téléphone prépayé payables en crypto-actifs : conserve le numéro rechargé.' }),
      w.customEntity({ name: 'Lucky Spin (casino en ligne)', category: 'gambling', known: true, description: 'Casino en ligne (fictif) acceptant l\'ETH, licence offshore, KYC au-delà d\'un seuil de retrait.' }),
    ]
    personalSpending(w, G, { start: gW.time + 1 * DAY, end: w.at(-2 * 24), n: 4, merchants: gShops, maxUsd: 45, asset: 'ETH' })
    lookalikeFlows(w, { chain: 'eth', value: S, time: theft.time, n: 3, asset: 'ETH' })
    lookalikeFlows(w, { chain: 'eth', value: rem.amountA, time: depEth.tx.time, n: 2, asset: 'ETH' })

    // ── Bruit de fond ────────────────────────────────────────────────────────
    lpNoise(w, uni, ['ETH', 'USDC'], 26, w.at(-20 * 24), w.at(8 * 24))
    lpNoise(w, uni, ['ETH', 'USDT'], 8, w.at(-20 * 24), w.at(8 * 24))
    uni.noise(30, w.at(-3 * 24), w.at(8 * 24), [['ETH', 'USDC'], ['ETH', 'USDT'], ['USDT', 'USDC']])
    for (let i = 0; i < 10; i++) {
      const rt = r.pick([['ETH', 'USDT', 'USDC'], ['USDC', 'ETH'], ['ETH', 'USDC']] as AssetId[][])
      agg.swap({ trader: w.addr('eth'), route: rt, amountIn: roundAsset(rt[0], fromUsd(rt[0], r.float(500, 50000))), time: w.at(r.float(-3 * 24, 8 * 24)) })
    }
    // D'autres cessions de parts LP entre adresses (pratique courante, licite)
    for (let i = 0; i < 4; i++) {
      const u = w.addr('eth')
      const t = w.at(r.float(-15 * 24, 6 * 24))
      const pos = addLiquidity(w, uni, { from: u, assetA: 'ETH', amountA: roundAsset('ETH', r.float(0.5, 12)), assetB: 'USDC', time: t })
      w.transfer({ time: t + r.int(2, 72) * HOUR, from: u, to: w.addr('eth'), value: pos.lp, asset: 'LP' })
    }
    exG.noise(14, w.at(-30 * 24), w.at(2 * 24), 'ETH')
    ex.noise(16, w.at(-1 * 24), w.at(9 * 24), 'ETH')
    ex.noise(12, w.at(-1 * 24), w.at(9 * 24), 'USDC')
    ch.noise(6, w.at(-5 * 24), w.at(3 * 24), 'ETH')

    const d = (ts: number) => fmtDate(ts)
    // « depuis mars 2023 » : mois du premier achat de la victime
    const sinceBuy = fmtDate(buys[0].time, false).replace(/^\d+(er)? /, '')
    const people = tSpend.nPeople === 1 ? 'd\'un particulier' : `de ${tSpend.nPeople} particuliers`
    const spendTxt = tSpend.shops.length
      ? `chez ${listFr(tSpend.shops.map((s) => s.replace(/ \(.*\)$/, '')))}, des prestataires qui connaissent leur client (pistes de réquisition secondaires)${tSpend.nPeople ? `, ainsi qu'auprès ${people}` : ''}`
      : `auprès ${people}`
    const addUsd = usd('ETH', a) + usd('USDC', add.amountB)
    const remUsd = usd('ETH', rem.amountA) + usd('USDC', rem.amountB)

    return {
      world: w,
      title: `Vol de phrase de récupération — ${city}`,
      briefing:
        `${victim.name} (${city}) a installé « ${appName} », présentée comme un portefeuille mobile sécurisé, et y a saisi sa phrase de récupération pour « importer » son portefeuille. Une heure plus tard, la quasi-totalité de ses ETH, achetés sur Coinhouse depuis ${sinceBuy}, a été transférée vers une adresse inconnue.\n\n` +
        `Le voleur ne s'est pas contenté de swaps. Il a déposé une partie des fonds comme liquidité dans un pool Uniswap : en échange, le pool crée des parts (jetons LP), qui se transfèrent comme n'importe quel jeton. Les parts peuvent être cédées à une autre adresse, qui retire la liquidité et désigne librement le destinataire des actifs. Les montants retirés diffèrent des montants déposés, car le prix du pool a bougé.\n\n` +
        `Objectifs : suivre l'ETH volé jusqu'au pool, compter les parts LP créées et suivre leur cession, identifier qui a financé le gas de l'adresse « propre », lire le retrait de liquidité (argument « to », montants), puis séparer les deux sorties — l'ETH vers un exchange à requérir, les USDC laissés sur une adresse que l'émetteur peut encore geler.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(2 * 24), author: victim.name,
          body:
            `« J'ai téléchargé l'application depuis une publicité. Elle m'a demandé mes douze mots pour retrouver mon portefeuille, ce que j'ai fait. Une heure plus tard à peine, le ${d(theft.time)}, mon solde était presque à zéro.\n\n` +
            `Mon adresse : ${A(w, V)}\n` +
            `La transaction que je n'ai jamais faite : ${theft.hash}\n\n` +
            `Je n'ai jamais donné mes mots à personne d'autre. »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture de la fausse application', date: w.at(-1), author: appName,
          body:
            `${appName} — Importer un portefeuille existant\n` +
            `Saisissez votre phrase de récupération (12 ou 24 mots) pour synchroniser vos actifs.\n` +
            `[ ______ ] [ ______ ] [ ______ ] …\n` +
            `🔒 Vos données sont chiffrées de bout en bout.\n` +
            `[ Importer ]`,
        },
        {
          id: 'releve', type: 'releve', title: 'Historique des retraits Coinhouse de la victime', date: w.at(3 * 24), author: 'Coinhouse (réponse à réquisition)',
          body:
            buys.map((b) => `${fmtDate(b.time, false)} — retrait de ${amt(b.transfers[0].value, 'ETH')} vers ${A(w, V)}`).join('\n') +
            `\n\nAucune autre adresse de retrait enregistrée pour ce client.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de la cellule d\'appui : parts de pool (LP)', date: w.at(3 * 24), author: 'Cellule d\'appui',
          body:
            `• addLiquidity / addLiquidityETH : les deux actifs entrent dans le pool ; des parts LP sont créées depuis l'adresse nulle au profit de l'argument « to » (événement Mint du pool).\n` +
            `• Les parts LP sont des jetons ERC-20 : elles se cèdent par un simple transfert.\n` +
            `• removeLiquidity / removeLiquidityETH : les parts sont détruites (envoyées à l'adresse nulle) et les deux actifs versés à l'argument « to », qui peut différer du signataire.\n` +
            `• Une adresse neuve doit recevoir un peu d'ETH pour payer le gas : l'origine de ce financement est souvent la faille.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 7,
          prompt: 'Quelle adresse reçoit les ETH volés ?',
          answer: [T],
          hint: 'Ouvrez la transaction citée dans la plainte.',
          explanation: `La transaction ${theft.hash.slice(0, 18)}…, signée avec la clé de la victime (dérivée de la phrase de récupération volée), envoie ${amt(S, 'ETH')} à ${A(w, T)}. Cette adresse de collecte n'a pas reçu que les fonds ${g('du plaignant', 'de la plaignante')} : d'autres victimes de la fausse application y ont été drainées, et le voleur en dépense une partie ${spendTxt}. Attention aussi aux micro-dépôts d'adresses sosies (empoisonnement), à ignorer.`,
        },
        {
          id: 'o2', type: 'amount', points: 9, unit: 'LP', tolerance: 0.01,
          prompt: 'Combien de parts LP le voleur obtient-il en déposant de la liquidité dans le pool ETH/USDC ?',
          answer: lp,
          hint: 'Après un swap via 1inch (ETH → USDT → USDC), le voleur appelle addLiquidityETH sur le routeur Uniswap. Les parts sont créées depuis l\'adresse nulle (événement Mint du pool).',
          explanation: `Le ${d(add.tx.time)}, addLiquidityETH dépose ${amt(a, 'ETH')} et ${amt(add.amountB, 'USDC')} (valeurs égales, au prix du pool) ; le pool crée ${amt(lp, 'LP')} au profit du voleur. Les USDC proviennent de son swap 1inch (${amt(sA, 'ETH')} → ${amt(sw.amountOut, 'USDC')}, deux pools traversés). Les parts LP représentent une créance sur le pool : leur détenteur pourra retirer la quote-part correspondante des deux actifs.`,
        },
        {
          id: 'o3', type: 'address', points: 9,
          prompt: 'À quelle adresse le voleur cède-t-il ses parts LP ?',
          answer: [P],
          hint: 'Suivez la sortie de jetons LP de l\'adresse du voleur : c\'est un simple transfert de jeton.',
          explanation: `Le ${d(lpMove.time)}, le voleur transfère ses ${amt(lp, 'LP')} à ${A(w, P)}, adresse sans autre historique qu'un petit financement en gas. Vue de l'extérieur, cette adresse ne reçoit aucun ETH volé : seulement des parts de pool, dont la valeur provient pourtant du vol.`,
        },
        {
          id: 'o4', type: 'tx', points: 9,
          prompt: 'Quelle transaction retire la liquidité du pool ?',
          answer: [rem.tx.id],
          hint: 'Parmi les transactions de l\'adresse « propre », cherchez l\'appel removeLiquidityETH sur le routeur Uniswap : les parts LP partent vers l\'adresse nulle.',
          explanation: `Le ${d(rem.tx.time)}, ${rem.tx.hash.slice(0, 18)}… appelle removeLiquidityETH : ${amt(lp, 'LP')} sont détruites (envoi à l'adresse nulle, événement Burn du pool) et le pool verse les deux actifs. Elle est signée par l'adresse « propre », grâce au gas du tiers.`,
        },
        {
          id: 'o5', type: 'address', points: 10,
          prompt: 'Quelle adresse reçoit les actifs retirés du pool ?',
          answer: [Q],
          hint: 'Ne vous fiez pas au signataire : lisez l\'argument « to » de l\'appel, ou le destinataire des transferts sortant du pool.',
          explanation: `L'argument to = ${A(w, Q)}, une troisième adresse. Elle reçoit l'ETH et les USDC directement du pool Uniswap, comme le ferait n'importe quel fournisseur de liquidité qui se retire : sans lecture de l'appel et sans le suivi des parts LP, rien ne la relie au vol.`,
        },
        {
          id: 'o6', type: 'amount', points: 9, unit: 'ETH', tolerance: 0.01,
          prompt: 'Combien d\'ETH sont retirés du pool ?',
          answer: rem.amountA,
          hint: 'Dans la transaction de retrait, lisez le transfert d\'ETH sortant du pool.',
          explanation: `Le retrait verse ${amt(rem.amountA, 'ETH')}, contre ${amt(a, 'ETH')} déposés.`,
        },
        {
          id: 'o7', type: 'amount', points: 9, unit: 'USDC', tolerance: 0.01,
          prompt: 'Combien d\'USDC sont retirés du pool ?',
          answer: rem.amountB,
          hint: 'Même transaction : le transfert d\'USDC sortant du pool (événement Transfer).',
          explanation: `Le retrait verse ${amt(rem.amountB, 'USDC')}, contre ${amt(add.amountB, 'USDC')} déposés.`,
        },
        {
          id: 'o8', type: 'choice', points: 8,
          prompt: 'Pourquoi les montants retirés diffèrent-ils des montants déposés ?',
          hint: 'Comparez la valeur totale (en dollars) déposée et retirée, puis la répartition entre ETH et USDC.',
          ...choice(r,
            'Le prix du pool a évolué entre le dépôt et le retrait : la répartition entre ETH et USDC change, à valeur totale quasi constante',
            [
              'Uniswap prélève une commission de 50 % sur l\'actif le plus demandé',
              'Une partie des fonds a été bloquée par le pool à la suite du signalement',
              'L\'adresse « propre » a retiré la liquidité d\'un autre fournisseur',
            ]),
          explanation: `Valeur déposée ≈ ${Math.round(addUsd).toLocaleString('fr-FR')} $, valeur retirée ≈ ${Math.round(remUsd).toLocaleString('fr-FR')} $ : quasi identique. Mais la répartition a bougé : ${drift > 0 ? 'davantage d\'ETH et moins d\'USDC' : 'moins d\'ETH et davantage d\'USDC'} qu'au dépôt, parce que les échanges des autres utilisateurs ont déplacé le prix du pool. Chercher le montant exact déposé à la sortie du pool est donc vain : on suit les parts LP, puis la valeur.`,
        },
        {
          id: 'o9', type: 'entity', points: 9,
          prompt: 'Sur quel exchange l\'ETH retiré du pool est-il déposé ?',
          answer: [exKey],
          hint: 'Suivez la sortie d\'ETH de l\'adresse qui a reçu les actifs du pool : elle part vers une adresse de dépôt balayée vers un hot wallet étiqueté. Les USDC, eux, ne bougent pas vers l\'exchange.',
          explanation: `Seul l'ETH part vers une adresse de dépôt ${de(ex.entity.name)}, balayée vers son hot wallet ; les USDC, gelables, restent sur une adresse contrôlée (voir plus loin). ${procedureFor(ex.entity)}`,
        },
        {
          id: 'o10', type: 'address', points: 9,
          prompt: 'Quelle adresse de dépôt citer dans la réquisition à cet exchange ?',
          answer: [deposit],
          hint: 'C\'est l\'adresse qui reçoit l\'ETH, pas le hot wallet.',
          explanation: `${A(w, deposit)} reçoit ${amt(rem.amountA, 'ETH')} (${depEth.tx.hash.slice(0, 12)}…). La réquisition à ${ex.entity.name} vise l'identité du titulaire, les adresses IP de connexion, l'historique du compte et le gel du solde.`,
        },
        {
          id: 'o11', type: 'address', points: 10,
          prompt: 'Quelle adresse détient encore les USDC retirés du pool, et peut faire l\'objet d\'un gel ?',
          answer: [R],
          hint: 'Dans le retrait de liquidité, l\'ETH et les USDC vont d\'abord à la même adresse ; suivez ensuite uniquement les USDC. L\'ETH part sur l\'exchange, les USDC s\'arrêtent ailleurs.',
          explanation: `${A(w, R)} reçoit ${amt(rem.amountB, 'USDC')} le ${d(usdcHold.time)} (${usdcHold.hash.slice(0, 12)}…) et les y conserve : c'est le seul endroit où des fonds issus du vol restent immobilisés et gelables. Ne pas confondre avec l'adresse de dépôt de l'exchange, qui ne reçoit que l'ETH.`,
        },
        {
          id: 'o12', type: 'choice', points: 9,
          prompt: 'Quelle démarche permet de bloquer ces USDC encore détenus ?',
          hint: 'Qui a le pouvoir d\'agir sur un solde d\'USDC détenu par une adresse auto-hébergée ?',
          ...choice(r,
            `Une réquisition à ${circle.name}, émetteur de l'USDC, qui peut inscrire l'adresse sur la liste noire du contrat tant que les jetons s'y trouvent`,
            [
              'Une réquisition à Uniswap, qui peut annuler le retrait de liquidité',
              'Une réquisition à l\'exchange où l\'ETH a été déposé, qui bloque aussi les USDC',
              'Aucune : des USDC sur une adresse auto-hébergée ne peuvent jamais être gelés',
            ]),
          explanation: `L'USDC est un stablecoin centralisé : ${circle.name} peut, sur réquisition motivée, inscrire ${A(w, R).slice(0, 12)}… sur la liste noire du contrat et figer les ${amt(rem.amountB, 'USDC')} tant qu'ils y demeurent. Uniswap est un protocole sans opérateur ; l'exchange ne détient que l'ETH ; et un jeton centralisé reste gelable même sur une adresse auto-hébergée. D'où l'urgence : la demande doit partir avant que le voleur ne déplace les USDC.`,
        },
        {
          id: 'o13', type: 'entity', points: 8,
          prompt: 'De quelle plateforme proviennent les ETH du tiers qui a financé le gas de l\'adresse « propre » ?',
          answer: [exGKey],
          hint: 'Trouvez d\'abord l\'adresse qui a envoyé le gas, puis remontez son propre premier financement.',
          explanation: `L'adresse « propre » ${A(w, P).slice(0, 10)}… a reçu son gas de ${A(w, G)} (${amt(gas.transfers[0].value, 'ETH')}, le ${d(gas.time)}), lui-même approvisionné par un retrait de ${amt(gW.transfers[0].value, 'ETH')} depuis ${exG.entity.name} le ${d(gW.time)}. Ce tiers n'apparaît nulle part ailleurs dans le flux : complice ou prête-nom. Une seconde réquisition, à ${exG.entity.name}, peut révéler son identité. ${procedureFor(exG.entity)}`,
        },
      ],
      truth: {
        path: [theft.id, sw.tx.id, add.tx.id, gW.id, gas.id, lpMove.id, rem.tx.id, depEth.tx.id, ...(depEth.sweep ? [depEth.sweep.id] : []), usdcHold.id],
        addresses: [T, P, Q, deposit, G, R],
        debrief:
          `1. Avec la phrase de récupération saisie dans « ${appName} », le voleur transfère ${amt(S, 'ETH')} de ${A(w, V)} vers ${A(w, T)}.\n` +
          `2. Il convertit ${amt(sA, 'ETH')} en ${amt(sw.amountOut, 'USDC')} via 1inch (ETH → USDT → USDC, deux pools), puis dépose ${amt(a, 'ETH')} et ${amt(add.amountB, 'USDC')} dans le pool ETH/USDC d'Uniswap : ${amt(lp, 'LP')} parts sont créées à son profit.\n` +
          `3. Un tiers, ${A(w, G)}, approvisionné par ${exG.entity.name}, envoie du gas à l'adresse neuve ${A(w, P)}, qui reçoit ensuite les parts LP.\n` +
          `4. Cette adresse retire la liquidité vers ${A(w, Q)} : ${amt(rem.amountA, 'ETH')} et ${amt(rem.amountB, 'USDC')}, répartition déplacée par l'évolution du prix.\n` +
          `5. L'ETH est déposé sur ${ex.entity.name} (adresse ${A(w, deposit)}), mais les ${amt(rem.amountB, 'USDC')} restent sur ${A(w, R)} : encore gelables par ${circle.name} tant qu'ils y demeurent.\n\n` +
          `À retenir : une part LP est un jeton qui représente une créance sur un pool. On la suit comme n'importe quel jeton : création depuis l'adresse nulle au dépôt, transferts, destruction au retrait. Le retrait peut viser une autre adresse que le signataire (argument « to ») et ne rend pas les montants déposés. Une adresse « propre » doit payer son gas : son premier financement relie souvent l'opération à une personne identifiable. Enfin, tant que le voleur n'a pas déplacé les USDC, l'émetteur peut les figer : la demande de gel à ${circle.name} est une urgence, au même titre que la réquisition à l'exchange qui détient l'ETH. L'adresse de collecte mêle les fonds de plusieurs victimes et des dépenses personnelles : il faut trier.`,
      },
      hints: [
        'Partez de la transaction de la plainte, puis ouvrez les transactions du voleur : un appel unoswap, puis un addLiquidityETH.',
        'Les parts LP créées au profit du voleur sortent de l\'adresse nulle : suivez ensuite leur transfert.',
        'L\'adresse qui reçoit les parts a d\'abord reçu un peu d\'ETH : d\'où vient-il ? Remontez encore d\'un cran.',
        'Dans le retrait de liquidité, le signataire n\'est pas le destinataire : lisez l\'argument « to ».',
        'Comparez valeur déposée et valeur retirée : la répartition change, pas la valeur.',
      ],
    }
  },
}
