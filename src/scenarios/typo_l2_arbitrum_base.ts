import { World, type Tx } from '../engine/world'
import { dex, exchange, l2Bridge, HOUR, DAY } from '../engine/patterns'
import { roundAsset, usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

// Vol d'ETH puis fuite par les bridges canoniques de deux rollups optimistes
// (Arbitrum One, Base). La même adresse 0x est réutilisée sur les trois
// chaînes. Un retrait Arbitrum → Ethereum a été exécuté après la période de
// contestation ; un retrait Base → Ethereum est encore en attente, vers une
// adresse de dépôt d'exchange déjà connue : fenêtre de gel. Avant le vol,
// l'adresse du voleur a reçu son ETH de gaz par un retrait d'exchange.

const COMPANIES = [
  { name: 'Lumibox', activity: 'une start-up de jeux vidéo' },
  { name: 'Ferrovia Studio', activity: 'un studio de création numérique' },
  { name: 'Agrinova', activity: 'une jeune entreprise d\'agritech' },
  { name: 'Kaléo Paiements', activity: 'une fintech en phase d\'amorçage' },
  { name: 'Orbis Events', activity: 'une société d\'événementiel Web3' },
] as const

const eth = (v: number) => roundAsset('ETH', v)
const usd0 = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} $`

export const l2ArbitrumBase: ScenarioTemplate = {
  id: 'l2-arbitrum-base',
  title: 'Fuite par les rollups : Arbitrum et Base',
  tagline: 'Une même adresse 0x sur trois chaînes, sept jours de contestation, un retrait encore en vol.',
  description:
    'La trésorerie en ETH d\'une jeune entreprise est vidée. Le voleur passe par les bridges officiels d\'Arbitrum et de Base, échange une partie de son butin sur un DEX, puis rapatrie des fonds sur Ethereum pour les déposer sur un exchange. Un dernier retrait est encore bloqué dans la période de contestation : identifiez-le et la destination où le gel est possible.',
  difficulty: 3,
  chains: ['eth', 'arb', 'base'],
  skills: ['evm', 'bridge', 'crosschain', 'dex', 'exchange_id', 'requisition', 'gel'],
  estMinutes: 60,
  lessons: ['layer2-rollups', 'bridges', 'comptes-evm', 'dex-defi', 'gel-saisie', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const boss = fakePerson(r)
    const company = r.pick(COMPANIES)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const destKey = r.pick(['kraken', 'coinbase', 'binance', 'bitstamp', 'okx'] as const)
    const dest = exchange(w, destKey, 'eth')
    const cv = exchange(w, 'coinhouse', 'eth')
    const arb = l2Bridge(w, 'arb')
    const base = l2Bridge(w, 'base')
    const uniArb = dex(w, 'uniswap', 'arb')
    const uniBase = dex(w, 'uniswap', 'base')

    const victimE = w.customEntity({ name: `${company.name} (trésorerie)`, category: 'victim' })
    const thiefE = w.customEntity({ name: 'Voleur (inconnu)', category: 'suspect' })
    const victim = w.addr('eth', { entity: victimE })
    const thief = w.addr('eth', { entity: thiefE })
    // Préparation : l'adresse du voleur reçoit son ETH de gaz par un retrait d'exchange
    const gasKey = r.pick((['kraken', 'coinbase', 'binance', 'bitstamp', 'okx'] as const).filter((k) => k !== destKey))
    const gasEx = exchange(w, gasKey, 'eth')

    // Historique de la trésorerie : achats d'ETH chez Coinhouse
    const S = eth(Math.round(r.float(32, 85) * 100) / 100)
    const tTheft = w.at(0)
    const histTx: Tx[] = []
    let funded = 0
    for (let i = 0; i < 3; i++) {
      const v = eth(i < 2 ? S * r.float(0.3, 0.45) : S - funded + r.float(0.4, 2.5))
      funded += v
      histTx.push(cv.withdraw(victim, v, tTheft - Math.round(r.float(20, 160) * DAY) + i * DAY, 'ETH'))
    }

    const gasTx = gasEx.withdraw(thief, eth(r.float(0.015, 0.05)), tTheft - Math.round(r.float(1, 5) * DAY) - Math.round(r.float(1, 20) * HOUR), 'ETH')

    // 1. Vol : la clé privée exfiltrée sert à vider la trésorerie
    const theft = w.transfer({ time: tTheft, from: victim, to: thief, value: S, asset: 'ETH' })

    // 2. Dépôts sur les deux rollups (même adresse 0x de l'autre côté)
    const dA = eth(Math.round(S * r.float(0.52, 0.64) * 100) / 100)
    const keepL1 = eth(r.float(0.04, 0.12))
    const dB = eth(S - dA - keepL1)
    const t1 = tTheft + Math.round(r.float(25, 70) * 60)
    const depA = arb.deposit({ from: thief, value: dA, time: t1 })
    const t2 = t1 + Math.round(r.float(40, 120) * 60)
    const depB = base.deposit({ from: thief, value: dB, time: t2 })
    const xa = depA.recipient
    const xb = depB.recipient

    // 3. Swaps ETH → USDC sur les DEX des rollups (USDC conservés)
    const swA = uniArb.swap({ trader: xa, assetIn: 'ETH', amountIn: eth(dA * r.float(0.28, 0.42)), assetOut: 'USDC', time: depA.l2Tx.time + Math.round(r.float(1, 4) * HOUR) })
    const swB = uniBase.swap({ trader: xb, assetIn: 'ETH', amountIn: eth(dB * r.float(0.18, 0.32)), assetOut: 'USDC', time: depB.l2Tx.time + Math.round(r.float(2, 6) * HOUR) })

    // 4. Retrait Arbitrum → Ethereum (exécuté après la période de contestation)
    const wA = eth(Math.round((w.balanceOf(xa, 'ETH') - r.float(0.01, 0.04)) * 1000) / 1000)
    const wdA = arb.withdraw({ from: xa, value: wA, time: swA.tx.time + Math.round(r.float(5, 26) * HOUR) })

    // 5. Dépôt sur l'exchange depuis l'adresse Ethereum d'origine
    const dep = dest.newDeposit()
    const depValue = eth(Math.floor((wA + keepL1 * 0.5) * 1000) / 1000)
    const dEx = dest.receive(thief, depValue, wdA.finalizeTx.time + Math.round(r.float(1, 6) * HOUR), { asset: 'ETH', depositAddr: dep, sweepDelayH: r.float(0.3, 2) })

    // 6. Retrait Base → Ethereum vers la même adresse de dépôt : encore en attente
    const wB = eth(Math.round((w.balanceOf(xb, 'ETH') - r.float(0.01, 0.04)) * 1000) / 1000)
    const tPend = dEx.tx.time + Math.round(r.float(18, 40) * HOUR)
    const pending = w.transfer({ time: tPend, from: xb, to: base.l2Gateway, value: wB, asset: 'ETH', method: 'withdraw', tags: ['bridge', 'l2-withdraw-init'] })
    pending.bridge = { direction: 'out', otherChain: 'eth', nonce: r.int(900001, 999999), recipient: dep }
    const today = tPend + Math.round(r.float(1.5, 3) * DAY)
    const finalizable = tPend + 7 * DAY

    // ── Bruit : autres utilisateurs des bridges, des DEX et de l'exchange ───
    const tLo = tTheft - 3 * DAY
    const tHi = today - 2 * HOUR
    for (const kit of [arb, base]) {
      for (let i = 0; i < r.int(5, 8); i++) {
        const u = w.addr('eth')
        const v = eth(r.float(0.05, 1.2) * (r.chance(0.3) ? S * 0.6 : 1))
        const t = Math.round(r.float(tLo, tHi))
        const d = kit.deposit({ from: u, value: v, time: t })
        if (r.chance(0.5)) {
          const tw = t + Math.round(r.float(2, 30) * HOUR)
          const wv = eth(v * r.float(0.3, 0.9))
          if (tw + 9 * DAY < tHi) kit.withdraw({ from: d.recipient, value: wv, time: tw })
          else {
            // Retrait d'un tiers lui aussi en attente
            const p = w.transfer({ time: Math.max(d.l2Tx.time + 600, Math.min(tw, tHi)), from: d.recipient, to: kit.l2Gateway, value: wv, asset: 'ETH', method: kit.l2 === 'arb' ? 'withdrawEth' : 'withdraw', tags: ['bridge', 'l2-withdraw-init'] })
            p.bridge = { direction: 'out', otherChain: 'eth', nonce: r.int(900001, 999999), recipient: w.addrSameEoa(d.recipient, 'eth') }
          }
        }
      }
    }
    uniArb.noise(18, tLo, tHi, [['ETH', 'USDC'], ['ETH', 'USDT']])
    uniBase.noise(14, tLo, tHi, [['ETH', 'USDC']])
    dest.noise(16, tLo, tHi, 'ETH')
    cv.noise(6, tLo, tHi, 'ETH')
    gasEx.noise(10, tLo - 4 * DAY, tHi, 'ETH')

    // ── Synthèse ─────────────────────────────────────────────────────────────
    const destName = dest.entity.name
    const usdcHeld = swA.amountOut + swB.amountOut
    const leftArb = eth(w.balanceOf(xa, 'ETH'))
    const leftBase = eth(w.balanceOf(xb, 'ETH'))
    const daysLeft = Math.round(((finalizable - today) / DAY) * 10) / 10
    const gasName = gasEx.entity.name

    return {
      world: w,
      title: `Trésorerie ${company.name} — ${city}`,
      briefing:
        `${boss.name}, ${boss.g('président', 'présidente')} de ${company.name}, ${company.activity} installée à ${city}, dépose plainte : la trésorerie de la société, ${amt(S, 'ETH')} (≈ ${usd0(usd('ETH', S))}), a été vidée en une seule transaction depuis le portefeuille de l'entreprise.\n\n` +
        `Le voleur a ensuite utilisé les bridges officiels de deux rollups optimistes d'Ethereum, Arbitrum One et Base. Sur ces réseaux, l'adresse 0x reste la même que sur Ethereum : une même clé contrôle le même compte sur toutes les chaînes compatibles EVM. Les retraits vers Ethereum ne sont exécutables qu'après une période de contestation d'environ sept jours.\n\n` +
        `Nous sommes le ${fmtDate(today, false)}. Objectifs : identifier les adresses du voleur sur les rollups, mesurer ce qui est revenu sur Ethereum et où, repérer le retrait encore en attente pour préparer un gel à son arrivée, remonter la préparation de l'adresse du voleur et recenser ce qui reste atteignable sur les rollups.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: tTheft + DAY, author: boss.name,
          body:
            `« Notre trésorerie était conservée sur un portefeuille logiciel utilisé par notre directeur financier : ${A(w, victim)}.\n\n` +
            `Le ${fmtDate(tTheft)}, la totalité du solde, ${amt(S, 'ETH')}, est partie vers une adresse inconnue. Transaction : ${theft.hash}\n\n` +
            `Nous n'avons signé aucune opération. Le poste du directeur financier est confié à un prestataire pour analyse. »`,
        },
        {
          id: 'rapport', type: 'rapport', title: 'Synthèse du prestataire de réponse à incident', date: tTheft + 3 * DAY, author: 'Prestataire de réponse à incident',
          body:
            `Une extension de navigateur se présentant comme un « convertisseur de PDF » a été installée sur le poste du directeur financier ${r.int(4, 15)} jours avant les faits. Son code exfiltrait le contenu du stockage local du portefeuille, dont la clé privée chiffrée, et le mot de passe saisi au clavier.\n` +
            `Aucune transaction n'a été signée depuis le poste : le voleur a utilisé la clé depuis sa propre infrastructure. Recommandation : considérer comme compromises toutes les adresses dérivées de la même phrase de récupération.`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste : rollups et bridges canoniques', date: today - DAY, author: 'Cellule d\'appui',
          body:
            `• Arbitrum One et Base sont des rollups optimistes : ils exécutent les transactions hors d'Ethereum et y publient leurs données. On y paie le gaz en ETH et les adresses sont au même format 0x.\n` +
            `• Une clé privée donne la même adresse sur toutes les chaînes EVM. Quand un bridge canonique ne précise pas d'autre destinataire, les fonds arrivent sur la même adresse 0x de l'autre côté.\n` +
            `• Dépôt Ethereum → rollup : crédité en quelques minutes. Retrait rollup → Ethereum : initié sur le rollup, exécutable sur Ethereum seulement après la période de contestation (environ 7 jours), par une transaction de finalisation.\n` +
            `• Dans le détail d'une transaction de bridge, le champ « Destinataire » indique où les fonds arriveront. Un retrait sans transaction liée sur Ethereum est encore en attente.`,
        },
        {
          id: 'pv', type: 'pv', title: `Point de situation du ${fmtDate(today, false)}`, date: today, author: 'Section de recherches',
          body:
            `Les fonds ont quitté l'adresse de réception initiale quelques minutes après le vol, vers les bridges officiels d'Arbitrum et de Base. Aucune réquisition n'a encore été adressée.\n` +
            `Priorité : déterminer si une partie du butin est encore en transit vers Ethereum et, le cas échéant, sa date d'arrivée possible et le prestataire qui la recevra.\n` +
            `Rappel : une demande de gel ne porte que sur ce qu'un prestataire détient ou recevra ; elle doit lui parvenir avant que les fonds ne repartent.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'addresses', points: 12,
          prompt: 'Quelles adresses le voleur utilise-t-il sur Arbitrum One et sur Base ?',
          answer: [xa, xb],
          hint: 'Ouvrez les deux transactions de l\'adresse du voleur vers les contrats de bridge, puis « Ouvrir la transaction liée » : comparez le destinataire côté rollup avec l\'adresse de départ.',
          explanation: `Les dépôts vers le bridge d'Arbitrum (${amt(dA, 'ETH')}) et vers celui de Base (${amt(dB, 'ETH')}) sont crédités sur ${A(w, xa)}, la même adresse 0x que le voleur sur Ethereum, réutilisée sur les deux rollups. La réutilisation d'une même clé sur plusieurs chaînes EVM est un pivot très fort : une adresse identifiée sur une chaîne doit être vérifiée sur toutes les autres.`,
        },
        {
          id: 'o11', type: 'entity', points: 10,
          prompt: 'Avant le vol, d\'où provient l\'ETH dont disposait déjà l\'adresse du voleur ?',
          answer: [gasKey],
          hint: 'Remontez l\'historique de l\'adresse du voleur sur Ethereum avant la transaction de vol : sa toute première entrée.',
          explanation: `Le ${fmtDate(gasTx.time)}, soit avant les faits, ${A(w, thief)} reçoit ${amt(gasTx.transfers[0].value, 'ETH')} par un retrait du hot wallet de ${gasName}. Il fallait du gaz pour signer les dépôts vers les bridges : le voleur l'a pris sur un compte d'exchange. Ce retrait désigne un compte client (identité déclarée, IP de connexion, moyens de paiement), même si l'identité peut être empruntée : à confirmer par les autres éléments. ${procedureFor(gasEx.entity)}`,
        },
        {
          id: 'o2', type: 'entity', points: 8,
          prompt: 'Par quel bridge passe le retrait déjà exécuté vers Ethereum ?',
          answer: ['arbitrum_bridge'],
          hint: 'Sur chaque rollup, cherchez une transaction de l\'adresse du voleur vers le contrat de bridge côté L2, et vérifiez si elle a une transaction liée sur Ethereum.',
          explanation: `Le ${fmtDate(wdA.initTx.time)}, ${A(w, xa)} initie sur Arbitrum un retrait de ${amt(wA, 'ETH')} (${wdA.initTx.method}). Il est exécuté sur Ethereum le ${fmtDate(wdA.finalizeTx.time)} (${wdA.finalizeTx.method}), soit plus de sept jours plus tard : c'est la période de contestation du rollup optimiste.`,
        },
        {
          id: 'o3', type: 'amount', points: 10, unit: 'ETH', tolerance: 0.005,
          prompt: 'Combien d\'ETH sont déjà revenus sur Ethereum par ce retrait ?',
          answer: wA,
          hint: 'C\'est le montant versé par le contrat L1 du bridge à l\'adresse du voleur dans la transaction de finalisation.',
          explanation: `La finalisation verse ${amt(wA, 'ETH')} (≈ ${usd0(usd('ETH', wA))}) à ${A(w, thief)}. Quelques heures plus tard, ${amt(depValue, 'ETH')} partent vers une adresse de dépôt de ${destName}.`,
        },
        {
          id: 'o5', type: 'entity', points: 10,
          prompt: 'Sur quel exchange les ETH revenus sur Ethereum ont-ils été déposés ?',
          answer: [destKey],
          hint: 'Après la finalisation du retrait, suivez les sorties de l\'adresse du voleur sur Ethereum.',
          explanation: `Le ${fmtDate(dEx.tx.time)}, ${A(w, thief)} envoie ${amt(depValue, 'ETH')} à ${A(w, dep)}, adresse de dépôt de ${destName}, balayée ensuite vers le hot wallet de la plateforme. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o9', type: 'tx', points: 10,
          prompt: 'Quelle transaction constitue le premier dépôt du voleur sur cet exchange (à citer dans la réquisition) ?',
          answer: [dEx.tx.id],
          hint: 'Sur Ethereum, après la finalisation du retrait d\'Arbitrum, la sortie de l\'adresse du voleur vers une adresse de dépôt étiquetée.',
          explanation: `Transaction ${dEx.tx.hash.slice(0, 18)}…, le ${fmtDate(dEx.tx.time)} : ${amt(depValue, 'ETH')} de ${A(w, thief).slice(0, 12)}… vers ${A(w, dep).slice(0, 12)}…, ${Math.round((dEx.tx.time - wdA.finalizeTx.time) / HOUR)} h après la finalisation. Le hash, l'adresse de dépôt et l'horodatage permettent à ${destName} de retrouver sans ambiguïté le compte crédité ; c'est aussi la pièce qui rattache ce compte au vol, en continuité avec la finalisation du bridge.`,
        },
        {
          id: 'o4', type: 'tx', points: 10,
          prompt: 'Quelle transaction correspond au retrait encore en attente (période de contestation non écoulée) ?',
          answer: [pending.id],
          hint: 'Regardez l\'historique de l\'adresse du voleur sur Base : une transaction vers le contrat de bridge côté L2 n\'a pas de transaction liée sur Ethereum.',
          explanation: `Le ${fmtDate(tPend)}, ${A(w, xb)} initie sur Base un retrait de ${amt(wB, 'ETH')} (≈ ${usd0(usd('ETH', wB))}). Au ${fmtDate(today, false)}, aucune finalisation n'existe sur Ethereum : elle ne sera possible qu'à partir du ${fmtDate(finalizable)} environ. D'autres utilisateurs du bridge ont aussi des retraits en attente : seul celui-ci part de l'adresse du voleur.`,
        },
        {
          id: 'o6', type: 'address', points: 10,
          prompt: 'Quelle adresse recevra les ETH du retrait en attente ?',
          answer: [dep],
          hint: 'Le champ « Destinataire » de la transaction de retrait en attente désigne une adresse Ethereum que vous avez déjà rencontrée.',
          explanation: `Le retrait en attente désigne comme destinataire ${A(w, dep)} : la même adresse de dépôt ${destName} que le premier encaissement. Le voleur l'a choisie pour ne pas repasser par sa propre adresse. Résultat : les ${amt(wB, 'ETH')} arriveront directement sur un compte client identifiable, chez un prestataire qui peut bloquer le crédit s'il est prévenu à temps.`,
        },
        {
          id: 'o10', type: 'number', points: 10, tolerance: 1, unit: 'jours',
          prompt: 'Combien de jours restent, à la date du point de situation, avant que le retrait en attente puisse être finalisé sur Ethereum ?',
          answer: daysLeft,
          hint: 'Date d\'initiation du retrait sur Base + environ 7 jours de période de contestation, comparée à la date du jour indiquée dans le briefing.',
          explanation: `Le retrait a été initié le ${fmtDate(tPend)} ; avec une période de contestation d'environ 7 jours, il devient exécutable vers le ${fmtDate(finalizable)}. Au ${fmtDate(today, false)}, il reste donc environ ${daysLeft.toLocaleString('fr-FR')} jours. C'est le délai utile pour que la réquisition et la demande de gel parviennent à ${destName} avant l'arrivée des fonds ; la finalisation peut être faite par n'importe qui, à tout moment après l'échéance.`,
        },
        {
          id: 'o7', type: 'choice', points: 10,
          prompt: 'Que signifie la période de contestation pour l\'enquêteur ?',
          ...choice(r,
            'Les fonds restent dans le bridge jusqu\'à la finalisation : le temps de requérir l\'exchange destinataire pour un gel à l\'arrivée',
            [
              'Le bridge peut annuler le retrait sur simple réquisition judiciaire, tant que la période de contestation de sept jours n\'est pas écoulée',
              'N\'importe qui peut contester le retrait pendant sept jours : il suffit de signaler l\'adresse pour qu\'il soit rejeté',
              'Les fonds sont déjà crédités sur l\'exchange ; la période de contestation ne concerne que l\'écriture comptable du rollup',
            ]),
          explanation: `Les bridges canoniques sont des contrats sans opérateur qui puisse annuler un retrait à la demande d'un enquêteur, et la contestation vise les états frauduleux du rollup, pas les retraits légitimement signés. En revanche, le délai laisse le temps d'agir sur la destination : requérir ${destName} avant le ${fmtDate(finalizable, false)}, en citant le hash du retrait initié (${pending.hash.slice(0, 14)}…), l'adresse de dépôt ${A(w, dep)} et le premier dépôt déjà reçu (${dEx.tx.hash.slice(0, 14)}…), avec demande de gel du compte et des fonds à venir. Les USDC conservés sur les rollups (≈ ${usd0(usdcHeld)}) peuvent en outre être signalés à leur émetteur, qui sait geler des adresses.`,
        },
        {
          id: 'o8', type: 'amount', points: 10, unit: 'USDC', tolerance: 0.01,
          prompt: 'Quel montant total d\'USDC le voleur conserve-t-il sur les deux rollups ?',
          answer: usdcHeld,
          hint: 'Sur chaque rollup, l\'adresse du voleur échange une partie de ses ETH contre des USDC sur Uniswap et ne les dépense pas : additionnez les deux swaps.',
          explanation: `${amt(swA.amountOut, 'USDC')} sur Arbitrum et ${amt(swB.amountOut, 'USDC')} sur Base, soit ${amt(usdcHeld, 'USDC')}, toujours sur la même adresse 0x. Contrairement à l'ETH, l'USDC est un jeton émis par une société qui peut geler les fonds d'une adresse : ce montant est donc lui aussi atteignable, sans attendre aucun mouvement.`,
        },
        {
          id: 'o12', type: 'choice', points: 10,
          prompt: 'Quelle démarche permet de préserver les USDC encore détenus par le voleur sur les rollups ?',
          hint: 'Qui, dans cette chaîne d\'acteurs, a techniquement le pouvoir de geler un jeton ?',
          ...choice(r,
            'Saisir l\'émetteur de l\'USDC (Circle), par la voie appropriée, d\'une demande de gel des adresses concernées sur chaque rollup',
            [
              'Requérir Uniswap pour qu\'il annule les swaps et restitue l\'ETH à la victime',
              'Demander au bridge d\'Arbitrum de bloquer les jetons de l\'adresse, puisqu\'ils ont transité par lui',
              'Aucune : des jetons conservés sur un rollup sont hors de portée de toute mesure conservatoire',
            ]),
          explanation: `Uniswap est un protocole sans opérateur capable d'annuler un swap, et le bridge n'a jamais détenu les USDC (ils ont été obtenus sur le rollup). En revanche, l'émetteur d'un stablecoin centralisé peut inscrire une adresse sur liste noire, chaîne par chaîne : la demande doit viser l'adresse sur Arbitrum et sur Base, en citant les swaps et le contexte du vol (${amt(usdcHeld, 'USDC')}). Cette démarche se mène en parallèle de la réquisition à ${destName}, sur le fondement procédural approprié.`,
        },
      ],
      truth: {
        path: [gasTx.id, theft.id, depA.l1Tx.id, depA.l2Tx.id, depB.l1Tx.id, depB.l2Tx.id, swA.tx.id, swB.tx.id, wdA.initTx.id, wdA.finalizeTx.id, dEx.tx.id, ...(dEx.sweep ? [dEx.sweep.id] : []), pending.id],
        addresses: [thief, xa, xb, dep],
        debrief:
          `1. Le ${fmtDate(tTheft)}, la clé privée exfiltrée sert à vider la trésorerie : ${amt(S, 'ETH')} vers ${A(w, thief)}, une adresse préparée quelques jours plus tôt avec ${amt(gasTx.transfers[0].value, 'ETH')} de gaz retirés de ${gasName}.\n` +
          `2. Dans les heures qui suivent, le voleur dépose ${amt(dA, 'ETH')} sur le bridge d'Arbitrum et ${amt(dB, 'ETH')} sur celui de Base. Les deux dépôts arrivent sur la même adresse 0x, réutilisée sur les deux rollups.\n` +
          `3. Sur chaque rollup, il échange une partie de ses ETH contre des USDC sur Uniswap (${amt(swA.amountOut, 'USDC')} sur Arbitrum, ${amt(swB.amountOut, 'USDC')} sur Base), qu'il conserve.\n` +
          `4. Le ${fmtDate(wdA.initTx.time, false)}, il initie un retrait de ${amt(wA, 'ETH')} d'Arbitrum ; exécuté le ${fmtDate(wdA.finalizeTx.time, false)} après la période de contestation, il est déposé (${amt(depValue, 'ETH')}) sur ${A(w, dep)}, adresse de dépôt de ${destName}.\n` +
          `5. Le ${fmtDate(tPend, false)}, il initie un retrait de ${amt(wB, 'ETH')} de Base directement vers cette même adresse de dépôt. Au ${fmtDate(today, false)}, il est encore en attente : finalisation possible à partir du ${fmtDate(finalizable, false)}.\n` +
          `Restent sur les rollups : ${amt(leftArb, 'ETH')} et ${amt(swA.amountOut, 'USDC')} sur Arbitrum, ${amt(leftBase, 'ETH')} et ${amt(swB.amountOut, 'USDC')} sur Base.\n\n` +
          `À retenir : une adresse EVM se vérifie sur toutes les chaînes compatibles. Les bridges canoniques des rollups optimistes relient chaque dépôt et chaque retrait à sa transaction de l'autre côté ; le délai de sept jours des retraits ne permet pas d'annuler quoi que ce soit, mais il annonce où et quand les fonds arriveront. Ici, la destination est un compte d'exchange déjà identifié : une réquisition rapide, assortie d'une demande de gel, peut bloquer ${amt(wB, 'ETH')} dès leur arrivée.`,
      },
      hints: [
        'Depuis la transaction de vol, ouvrez l\'adresse du voleur et ses sorties : deux transactions partent vers des contrats de bridge.',
        'Le bouton « Ouvrir la transaction liée » mène de la transaction Ethereum à son arrivée sur le rollup : regardez le destinataire.',
        'Sur chaque rollup, suivez l\'adresse du voleur jusqu\'à une transaction vers le contrat de bridge L2. L\'une a une transaction liée sur Ethereum, l\'autre non.',
        'Comparez le « Destinataire » du retrait sans finalisation avec les adresses Ethereum que vous avez déjà rencontrées.',
        'Remontez aussi l\'historique de l\'adresse du voleur avant le vol : elle n\'était pas vide.',
        'Les USDC obtenus sur les rollups ne bougent plus : leur émetteur peut les geler.',
      ],
    }
  },
}
