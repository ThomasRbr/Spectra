import { World, type Tx } from '../engine/world'
import { dex, exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

// Portefeuille vidé après la saisie de la phrase de récupération sur un faux
// site ; l'escroc échange les ETH volés contre des USDT sur un DEX (deux
// jambes dans une même transaction), puis dépose les USDT sur un exchange.

const eth = (v: number) => roundAsset('ETH', v)

export const debPremierSwap: ScenarioTemplate = {
  id: 'deb-premier-swap',
  title: 'Mon premier swap',
  tagline: 'Des ETH entrent dans un pool, des USDT en ressortent : le flux continue.',
  description:
    'Le portefeuille d\'une victime a été vidé de ses ETH. Le voleur les a échangés contre des USDT sur un exchange décentralisé avant de les déposer sur une plateforme. Apprenez à reconnaître un swap (deux mouvements dans une même transaction) et à poursuivre le traçage dans le nouvel actif.',
  difficulty: 1,
  chains: ['eth'],
  skills: ['lecture_tx', 'evm', 'tokens', 'dex', 'exchange_id'],
  estMinutes: 15,
  lessons: ['comptes-evm', 'tokens-erc20', 'dex-defi', 'exchanges', 'suivre-flux'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)

    const cv = exchange(w, 'coinhouse', 'eth')
    const destKey = r.pick(['binance', 'kraken', 'coinbase', 'okx'] as const)
    const dest = exchange(w, destKey, 'eth')
    const uni = dex(w, 'uniswap', 'eth')

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const suspect = w.customEntity({ name: 'Voleur (inconnu)', category: 'suspect' })
    const victim = w.addr('eth', { entity: victimE })
    const s1 = w.addr('eth', { entity: suspect })
    const path: Tx[] = []

    // ── Épargne de la victime (achats sur Coinhouse) ────────────────────────
    const buys = r.int(2, 3)
    for (let i = 0; i < buys; i++) cv.withdraw(victim, eth(r.float(0.4, 2.2)), w.at(-r.int(20, 400) * 24), 'ETH')

    // ── Vol : tout le solde part vers l'adresse du voleur ───────────────────
    const T0 = w.at(0)
    const stolen = eth(w.balanceOf(victim, 'ETH'))
    const theft = w.transfer({ time: T0, from: victim, to: s1, value: stolen, asset: 'ETH' })
    path.push(theft)

    // ── Swap ETH → USDT sur le DEX ──────────────────────────────────────────
    uni.noise(10, T0 - 6 * HOUR, T0 + 30 * HOUR)
    const swapIn = eth(stolen - r.float(0.02, 0.06))
    const swapT = T0 + Math.round(r.float(0.3, 3) * HOUR)
    const { tx: swapTx, amountOut } = uni.swap({ trader: s1, assetIn: 'ETH', amountIn: swapIn, assetOut: 'USDT', time: swapT })
    path.push(swapTx)

    // ── Dépôt des USDT sur l'exchange ───────────────────────────────────────
    const depT = swapT + Math.round(r.float(1, 8) * HOUR)
    const d = dest.receive(s1, amountOut, depT, { asset: 'USDT' })
    path.push(d.tx, ...(d.sweep ? [d.sweep] : []))
    const ethLeft = eth(w.balanceOf(s1, 'ETH'))

    // ── Bruit de fond ────────────────────────────────────────────────────────
    dest.noise(14, w.at(-3 * 24), w.at(5 * 24), 'USDT')
    dest.noise(8, w.at(-3 * 24), w.at(5 * 24), 'ETH')
    cv.noise(8, w.at(-4 * 24), w.at(3 * 24), 'ETH')

    const destName = dest.entity.name
    const pool = uni.pool('ETH', 'USDT')

    return {
      world: w,
      title: `Portefeuille vidé — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte. En cherchant à mettre à jour son portefeuille Ethereum, ${g('il', 'elle')} a cliqué sur un lien sponsorisé et saisi sa phrase de récupération sur un faux site. Le ${fmtDate(T0, false)}, tous ses ETH ont disparu.\n\n` +
        `Les voleurs convertissent souvent leur butin avant de l'encaisser : sur un exchange décentralisé (DEX), un smart contract échange instantanément un actif contre un autre, sans compte ni vérification d'identité. Dans la transaction, on voit l'actif partir vers un pool de liquidité et un autre actif revenir.\n\n` +
        `Votre mission : identifier l'adresse du voleur, reconnaître l'opération d'échange et suivre les fonds jusqu'à la plateforme d'encaissement.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: depT + DAY, author: victimName,
          body:
            `« Le site ressemblait exactement à celui de mon application. Il demandait les 12 mots "pour resynchroniser". Une heure plus tard, mon solde était à zéro. Je n'ai rien envoyé moi-même.\n\n` +
            `J'avais environ ${amt(eth(Math.round(stolen * 10) / 10), 'ETH')}, achetés sur Coinhouse en plusieurs fois.\n\n` +
            `Mon adresse Ethereum : ${A(w, victim)} »`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste', date: depT + DAY, author: 'Cellule d\'appui',
          body:
            `Le voleur détient la phrase de récupération : la transaction de vol est donc signée par la clé de la victime. C'est l'adresse destinataire qui nous intéresse.\n` +
            `Penser à vérifier si les fonds ont changé d'actif en cours de route.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 20,
          prompt: 'Vers quelle adresse les ETH de la victime ont-ils été transférés ?',
          answer: [s1],
          hint: 'Dépliez les sorties du portefeuille de la victime : la transaction du jour des faits vide tout le solde.',
          explanation: `Le ${fmtDate(theft.time)}, ${amt(stolen, 'ETH')} partent vers ${A(w, s1)}. La transaction est signée avec la clé de la victime (le voleur connaît sa phrase de récupération), mais le destinataire est le compte du voleur.`,
        },
        {
          id: 'o2', type: 'entity', points: 20,
          prompt: 'Sur quel exchange décentralisé (DEX) le voleur a-t-il échangé les ETH ?',
          answer: ['uniswap'],
          hint: 'Ouvrez la transaction suivante du voleur : les ETH partent vers un contrat « Router » puis un « Pool », tous deux étiquetés.',
          explanation: `La transaction appelle le routeur du DEX (méthode swapExactETHForTokens) : les ETH passent par le routeur vers le pool ETH/USDT ${A(w, pool)}, qui renvoie des USDT au voleur. Le DEX est un protocole automatisé : il n'a ni compte client, ni données d'identité, et ne détient pas les fonds du voleur après l'échange.`,
        },
        {
          id: 'o3', type: 'amount', points: 20, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT le voleur a-t-il obtenus en échange de ses ETH ?',
          answer: amountOut,
          hint: 'Dans la transaction d\'échange, cherchez le transfert de jeton qui revient vers l\'adresse du voleur.',
          explanation: `${amt(swapIn, 'ETH')} contre ${amt(amountOut, 'USDT')}. Le prix tient compte du cours, des frais du pool (0,3 %) et d'un léger glissement.`,
        },
        {
          id: 'o4', type: 'entity', points: 20,
          prompt: 'Sur quelle plateforme centralisée les USDT ont-ils été déposés ?',
          answer: [destKey],
          hint: 'Après l\'échange, suivez les USDT (et non plus les ETH) : ils partent vers une adresse qui reverse tout à un hot wallet étiqueté.',
          explanation: `Les ${amt(amountOut, 'USDT')} partent vers l'adresse de dépôt ${A(w, d.deposit)}, balayée vers le hot wallet de ${destName}. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o5', type: 'choice', points: 20,
          prompt: 'Qu\'est-ce que ce swap change pour l\'enquête ?',
          ...choice(r,
            'L\'actif change (ETH devenu USDT), mais le flux continue : on suit les USDT reçus par le voleur',
            [
              'Le swap rompt la traçabilité : les ETH sont mélangés dans le pool, le suivi s\'arrête',
              'Le DEX détient désormais les fonds et doit être requis pour obtenir l\'identité du voleur',
              'Les USDT obtenus appartiennent au pool : ils ne peuvent plus être reliés au voleur',
            ]),
          explanation: `Un swap est une conversion, pas un mélange : dans la même transaction, l'actif entrant (ETH) part vers le pool et l'actif sortant (USDT) revient à la même adresse. On note la contre-valeur et on poursuit avec le nouvel actif. Bonus pour l'enquêteur : l'USDT a un émetteur (Tether) capable de geler des jetons encore présents sur une adresse. Le DEX, protocole non custodial, n'a ni KYC ni fonds à restituer.`,
        },
      ],
      truth: {
        path: path.map((t) => t.id),
        addresses: [s1, d.deposit, pool],
        debrief:
          `1. Avec la phrase de récupération dérobée, le voleur transfère tout le solde de la victime (${amt(stolen, 'ETH')}) vers ${A(w, s1)}.\n` +
          `2. Il échange ${amt(swapIn, 'ETH')} sur Uniswap : dans une seule transaction, les ETH passent par le routeur vers le pool ETH/USDT, et ${amt(amountOut, 'USDT')} reviennent à son adresse. Il garde ${amt(ethLeft, 'ETH')} pour payer le gas.\n` +
          `3. Il dépose les ${amt(amountOut, 'USDT')} sur l'adresse de dépôt ${destName} ${A(w, d.deposit)}, aussitôt balayée vers le hot wallet.\n\n` +
          `À retenir : reconnaître un swap = repérer, dans une même transaction, un actif qui part vers un contrat de pool et un autre actif qui revient. La valeur change de forme, pas de propriétaire : on continue à suivre l'adresse du voleur, dans le nouvel actif.\n\n` +
          `Réflexes de l'enquêteur : requérir ${destName} sur l'adresse de dépôt (identité, IP, retraits) avec demande de gel ; demander à Tether le gel d'USDT éventuellement encore présents sur une adresse identifiée ; conserver l'adresse du faux site (nom de domaine, hébergeur) pour l'enquête OSINT.`,
      },
      hints: [
        'Partez du portefeuille de la victime : sa dernière transaction sortante vide tout le solde.',
        'Une transaction qui envoie des ETH vers des contrats étiquetés « Router » et « Pool » et fait revenir un jeton est un swap.',
        'Après le swap, suivez l\'actif obtenu : il part vers une adresse de dépôt d\'exchange.',
      ],
    }
  },
}
