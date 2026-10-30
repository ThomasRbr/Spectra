import { World, type Tx } from '../engine/world'
import { dex, exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

// Portefeuille vidé après la saisie de la phrase de récupération sur un faux
// site ; le voleur reverse une commission à l'opérateur du kit de phishing,
// échange le reste des ETH contre des USDT sur un DEX (deux jambes dans une
// même transaction), puis dépose les USDT sur un exchange.

const eth = (v: number) => roundAsset('ETH', v)
const h1 = (sec: number) => Math.round((sec / 3600) * 10) / 10

export const debPremierSwap: ScenarioTemplate = {
  id: 'deb-premier-swap',
  title: 'Mon premier swap',
  tagline: 'Des ETH entrent dans un pool, des USDT en ressortent : le flux continue.',
  description:
    'Le portefeuille d\'une victime a été vidé de ses ETH. Le voleur a reversé une commission à un tiers, puis échangé le reste contre des USDT sur un exchange décentralisé avant de les déposer sur une plateforme. Apprenez à reconnaître un swap (deux mouvements dans une même transaction), à en lire les montants et à poursuivre le traçage dans le nouvel actif jusqu\'à l\'adresse de dépôt.',
  difficulty: 1,
  chains: ['eth'],
  skills: ['lecture_tx', 'evm', 'tokens', 'dex', 'exchange_id'],
  estMinutes: 30,
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
    const kitE = w.customEntity({ name: 'Opérateur du kit de phishing (inconnu)', category: 'suspect', description: 'Fournisseur du faux site, rémunéré par une part de chaque vol.' })
    const victim = w.addr('eth', { entity: victimE })
    const s1 = w.addr('eth', { entity: suspect })
    const kitOp = w.addr('eth', { entity: kitE })
    const path: Tx[] = []

    // ── Épargne de la victime (achats sur Coinhouse) ────────────────────────
    const buys = r.int(2, 3)
    for (let i = 0; i < buys; i++) cv.withdraw(victim, eth(r.float(0.4, 2.2)), w.at(-r.int(20, 400) * 24), 'ETH')

    // ── Vol : tout le solde part vers l'adresse du voleur ───────────────────
    const T0 = w.at(0)
    const stolen = eth(w.balanceOf(victim, 'ETH'))
    const theft = w.transfer({ time: T0, from: victim, to: s1, value: stolen, asset: 'ETH' })
    path.push(theft)

    // ── Commission à l'opérateur du kit de phishing ─────────────────────────
    const commission = eth(stolen * r.float(0.15, 0.25))
    const commTx = w.transfer({ time: T0 + r.int(5, 20) * 60, from: s1, to: kitOp, value: commission, asset: 'ETH' })
    path.push(commTx)

    // ── Swap ETH → USDT sur le DEX ──────────────────────────────────────────
    uni.noise(10, T0 - 6 * HOUR, T0 + 30 * HOUR)
    const swapIn = eth(stolen - commission - r.float(0.02, 0.06))
    const swapT = commTx.time + Math.round(r.float(0.2, 2.5) * HOUR)
    const { tx: swapTx, amountOut } = uni.swap({ trader: s1, assetIn: 'ETH', amountIn: swapIn, assetOut: 'USDT', time: swapT })
    path.push(swapTx)

    // ── Dépôt des USDT sur l'exchange ───────────────────────────────────────
    const depT = swapT + Math.round(r.float(1, 8) * HOUR)
    const d = dest.receive(s1, amountOut, depT, { asset: 'USDT' })
    path.push(d.tx, ...(d.sweep ? [d.sweep] : []))
    const ethLeft = eth(w.balanceOf(s1, 'ETH'))
    const delayH = h1(d.tx.time - theft.time)

    // ── Bruit de fond ────────────────────────────────────────────────────────
    dest.noise(14, w.at(-3 * 24), w.at(5 * 24), 'USDT')
    dest.noise(8, w.at(-3 * 24), w.at(5 * 24), 'ETH')
    cv.noise(8, w.at(-4 * 24), w.at(3 * 24), 'ETH')

    const destName = dest.entity.name
    const pool = uni.pool('ETH', 'USDT')
    const commPct = Math.round((commission / stolen) * 100)

    return {
      world: w,
      title: `Portefeuille vidé — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte. En cherchant à mettre à jour son portefeuille Ethereum, ${g('il', 'elle')} a cliqué sur un lien sponsorisé et saisi sa phrase de récupération sur un faux site. Le ${fmtDate(T0, false)}, tous ses ETH ont disparu.\n\n` +
        `Les voleurs convertissent souvent leur butin avant de l'encaisser : sur un exchange décentralisé (DEX), un smart contract échange instantanément un actif contre un autre, sans compte ni vérification d'identité. Dans la transaction, on voit l'actif partir vers un pool de liquidité et un autre actif revenir.\n\n` +
        `Votre mission : identifier l'adresse du voleur et tous les bénéficiaires du vol, reconnaître l'opération d'échange et en lire les montants, puis suivre les fonds jusqu'à l'adresse de dépôt de la plateforme d'encaissement.`,
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
        {
          id: 'osint', type: 'osint', title: 'Recherche en sources ouvertes — le faux site', date: depT + 2 * DAY, author: 'Cellule d\'appui',
          body:
            `Le faux site imitant l'application de la victime est servi par un « kit de phishing » proposé en location sur une messagerie chiffrée.\n` +
            `Selon les annonces observées, l'opérateur du kit fournit le site et la publicité sponsorisée ; en échange, chaque « client » lui reverse une part de ce qu'il dérobe, en général peu après le vol.\n\n` +
            `Conséquence pour le traçage : un même vol peut avoir plusieurs bénéficiaires.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Vers quelle adresse les ETH de la victime ont-ils été transférés ?',
          answer: [s1],
          hint: 'Dépliez les sorties du portefeuille de la victime : la transaction du jour des faits vide tout le solde.',
          explanation: `Le ${fmtDate(theft.time)}, ${amt(stolen, 'ETH')} partent vers ${A(w, s1)}. La transaction est signée avec la clé de la victime (le voleur connaît sa phrase de récupération), mais le destinataire est le compte du voleur.`,
        },
        {
          id: 'o7', type: 'address', points: 10,
          prompt: 'Peu après le vol, le voleur reverse une part des ETH à un tiers. Quelle est l\'adresse de ce bénéficiaire ?',
          answer: [kitOp],
          hint: 'Dépliez les sorties du voleur et classez-les par date : la première est un simple transfert d\'ETH vers une adresse non étiquetée, qui n\'est ni un contrat ni une adresse de dépôt.',
          explanation: `Quelques minutes après le vol, ${amt(commission, 'ETH')} (environ ${commPct} % du butin) partent vers ${A(w, kitOp)}. Ce reversement rapide, proportionnel au vol, correspond au modèle décrit par la recherche en sources ouvertes : la part de l'opérateur du kit de phishing. C'est un second suspect, souvent plus intéressant que le voleur lui-même (il sert de nombreux « clients ») : son adresse est à surveiller et à rapprocher d'autres plaintes.`,
        },
        {
          id: 'o2', type: 'entity', points: 9,
          prompt: 'Sur quel exchange décentralisé (DEX) le voleur a-t-il échangé les ETH ?',
          answer: ['uniswap'],
          hint: 'Ouvrez la transaction suivante du voleur : les ETH partent vers un contrat « Router » puis un « Pool », tous deux étiquetés.',
          explanation: `La transaction appelle le routeur du DEX (méthode swapExactETHForTokens) : les ETH passent par le routeur vers le pool ETH/USDT ${A(w, pool)}, qui renvoie des USDT au voleur. Le DEX est un protocole automatisé : il n'a ni compte client, ni données d'identité, et ne détient pas les fonds du voleur après l'échange.`,
        },
        {
          id: 'o6', type: 'tx', points: 9,
          prompt: 'Quelle transaction réalise l\'échange (le swap) ?',
          answer: [swapTx.id],
          hint: 'Cherchez, parmi les transactions du voleur, celle qui comporte plusieurs mouvements : des ETH qui partent vers un contrat et un jeton qui revient vers le voleur.',
          explanation: `${swapTx.hash.slice(0, 16)}… (${fmtDate(swapTx.time)}) : une seule transaction, plusieurs transferts internes. ETH du voleur vers le routeur, du routeur vers le pool, puis USDT du pool vers le voleur. C'est la signature d'un swap. Ce hash se cite tel quel dans le rapport : il prouve la conversion et sa contre-valeur.`,
        },
        {
          id: 'o8', type: 'amount', points: 9, unit: 'ETH', tolerance: 0.01,
          prompt: 'Combien d\'ETH le voleur a-t-il échangés ?',
          answer: swapIn,
          hint: 'Dans la transaction d\'échange, lisez le transfert d\'ETH qui part de l\'adresse du voleur.',
          explanation: `${amt(swapIn, 'ETH')} : le butin (${amt(stolen, 'ETH')}) moins la commission versée (${amt(commission, 'ETH')}) et une petite réserve gardée pour payer le gas (${amt(ethLeft, 'ETH')} restent sur l'adresse). Rapprocher ainsi entrées et sorties permet de vérifier qu'aucune branche n'a été oubliée.`,
        },
        {
          id: 'o3', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT le voleur a-t-il obtenus en échange de ses ETH ?',
          answer: amountOut,
          hint: 'Dans la transaction d\'échange, cherchez le transfert de jeton qui revient vers l\'adresse du voleur.',
          explanation: `${amt(swapIn, 'ETH')} contre ${amt(amountOut, 'USDT')}. Le prix tient compte du cours, des frais du pool (0,3 %) et d'un léger glissement.`,
        },
        {
          id: 'o4', type: 'entity', points: 9,
          prompt: 'Sur quelle plateforme centralisée les USDT ont-ils été déposés ?',
          answer: [destKey],
          hint: 'Après l\'échange, suivez les USDT (et non plus les ETH) : ils partent vers une adresse qui reverse tout à un hot wallet étiqueté.',
          explanation: `Les ${amt(amountOut, 'USDT')} partent vers une adresse de dépôt, balayée vers le hot wallet de ${destName}. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o9', type: 'address', points: 9,
          prompt: 'Quelle adresse de dépôt faut-il citer dans la réquisition à cette plateforme ?',
          answer: [d.deposit],
          hint: 'C\'est l\'adresse qui reçoit les USDT du voleur, pas le hot wallet vers lequel elle les reverse.',
          explanation: `${A(w, d.deposit)} : sur Ethereum, chaque client d'un exchange dispose de sa propre adresse de dépôt, que la plateforme rattache à son compte. Elle reçoit les USDT du voleur puis les reverse au hot wallet, qui mélange les fonds de tous les clients. La réquisition cite cette adresse, le hash du dépôt, sa date et son montant, et demande identité, IP, retraits et gel du compte.`,
        },
        {
          id: 'o10', type: 'number', points: 8, tolerance: 1, unit: 'heures',
          prompt: 'Combien d\'heures se sont écoulées entre le vol et le dépôt des USDT sur la plateforme ?',
          answer: delayH,
          hint: 'Comparez l\'horodatage de la transaction de vol et celui du transfert d\'USDT vers l\'adresse de dépôt.',
          explanation: `Environ ${delayH} h (${fmtDate(theft.time)} → ${fmtDate(d.tx.time)}) : vol, commission, échange et dépôt s'enchaînent dans la journée. La victime ne s'en aperçoit souvent qu'après coup : seule une demande de gel adressée sans délai à la plateforme peut encore préserver les fonds.`,
        },
        {
          id: 'o5', type: 'choice', points: 8,
          prompt: 'Qu\'est-ce que ce swap change pour l\'enquête ?',
          hint: 'Après l\'échange, qui détient les USDT obtenus ?',
          ...choice(r,
            'L\'actif change (ETH devenu USDT), mais le flux continue : on suit les USDT reçus par le voleur',
            [
              'Le swap rompt la traçabilité : les ETH sont mélangés dans le pool, le suivi s\'arrête',
              'Le DEX détient désormais les fonds et doit être requis pour obtenir l\'identité du voleur',
              'Les USDT obtenus appartiennent au pool : ils ne peuvent plus être reliés au voleur',
            ]),
          explanation: `Un swap est une conversion, pas un mélange : dans la même transaction, l'actif entrant (ETH) part vers le pool et l'actif sortant (USDT) revient à la même adresse. On note la contre-valeur et on poursuit avec le nouvel actif. Bonus pour l'enquêteur : l'USDT a un émetteur (Tether) capable de geler des jetons encore présents sur une adresse. Le DEX, protocole non custodial, n'a ni KYC ni fonds à restituer.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'La transaction de vol est signée par la clé de la victime. Qu\'en conclure ?',
          hint: 'Que connaît le voleur, d\'après la plainte et la note de l\'analyste ?',
          ...choice(r,
            'La signature prouve l\'usage de la clé, pas l\'identité de la personne qui l\'a utilisée',
            [
              'La victime a elle-même envoyé les fonds : il n\'y a pas d\'infraction',
              'La signature contient l\'adresse IP de l\'expéditeur, qu\'il suffit de lire dans l\'explorateur',
              'La transaction n\'ayant pas été voulue par la victime, elle peut être annulée sur demande',
            ]),
          explanation: `Quiconque détient la phrase de récupération peut signer au nom de la victime : la blockchain atteste qu'une clé a été utilisée, pas qui tenait le clavier. La plainte (saisie des 12 mots sur un faux site), le destinataire inconnu et l'enchaînement commission-échange-dépôt établissent le vol. Une signature ne contient aucune adresse IP, et une transaction confirmée ne s'annule pas : on suit les fonds et on demande des gels.`,
        },
      ],
      truth: {
        path: path.map((t) => t.id),
        addresses: [s1, kitOp, d.deposit, pool],
        debrief:
          `1. Avec la phrase de récupération dérobée, le voleur transfère tout le solde de la victime (${amt(stolen, 'ETH')}) vers ${A(w, s1)}.\n` +
          `2. Quelques minutes plus tard, il reverse ${amt(commission, 'ETH')} (environ ${commPct} %) à ${A(w, kitOp)}, très probablement l'opérateur du kit de phishing.\n` +
          `3. Il échange ${amt(swapIn, 'ETH')} sur Uniswap (${swapTx.hash.slice(0, 10)}…) : dans une seule transaction, les ETH passent par le routeur vers le pool ETH/USDT, et ${amt(amountOut, 'USDT')} reviennent à son adresse. Il garde ${amt(ethLeft, 'ETH')} pour payer le gas.\n` +
          `4. Environ ${delayH} h après le vol, il dépose les ${amt(amountOut, 'USDT')} sur l'adresse de dépôt ${destName} ${A(w, d.deposit)}, aussitôt balayée vers le hot wallet.\n\n` +
          `À retenir : reconnaître un swap = repérer, dans une même transaction, un actif qui part vers un contrat de pool et un autre actif qui revient. La valeur change de forme, pas de propriétaire : on continue à suivre l'adresse du voleur, dans le nouvel actif. Et l'on examine toutes ses sorties : un vol peut avoir plusieurs bénéficiaires.\n\n` +
          `Réflexes de l'enquêteur : requérir ${destName} sur l'adresse de dépôt (identité, IP, retraits) avec demande de gel ; surveiller l'adresse de l'opérateur du kit et la rapprocher d'autres vols ; demander à Tether le gel d'USDT éventuellement encore présents sur une adresse identifiée ; conserver l'adresse du faux site (nom de domaine, hébergeur) pour l'enquête OSINT.`,
      },
      hints: [
        'Partez du portefeuille de la victime : sa dernière transaction sortante vide tout le solde.',
        'Le voleur n\'envoie pas tout au même endroit : examinez chacune de ses sorties, dans l\'ordre chronologique.',
        'Une transaction qui envoie des ETH vers des contrats étiquetés « Router » et « Pool » et fait revenir un jeton est un swap.',
        'Après le swap, suivez l\'actif obtenu : il part vers une adresse de dépôt d\'exchange.',
      ],
    }
  },
}
