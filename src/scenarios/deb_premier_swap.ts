import { World, type Tx } from '../engine/world'
import { dex, exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Portefeuille vidé après la saisie de la phrase de récupération sur un faux
// site. Le voleur n'en est pas à son coup d'essai : la même adresse a déjà
// vidé d'autres portefeuilles, et chaque vol suit la même routine (commission
// à l'opérateur du kit de phishing, swap ETH → USDT sur Uniswap, dépôt des
// USDT sur son compte joueur d'un casino en ligne). L'enquêteur doit isoler,
// dans cette routine répétée, la commission, le swap et le dépôt qui
// correspondent au vol de la victime. Fin d'affaire : un casino, pas un exchange.

const eth = (v: number) => roundAsset('ETH', v)
const usdt = (v: number) => roundAsset('USDT', v)

// ── Heures et délais calculés (heure de Paris) ──────────────────────────────
const parisHM = (ts: number): [number, number] => {
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts * 1000))
  return [Number(p.find((x) => x.type === 'hour')!.value), Number(p.find((x) => x.type === 'minute')!.value)]
}
/** Même jour (heure de Paris) que `ts`, à h:m. */
const sameDayAt = (ts: number, h: number, m = 0) => {
  const [hh, mm] = parisHM(ts)
  return ts - (hh * 60 + mm) * 60 - (ts % 60) + (h * 60 + m) * 60
}
/** Avance `ts` dans les heures de bureau (9 h – 18 h) si besoin. */
const office = (ts: number) => {
  const [h] = parisHM(ts)
  const m = 5 + (Math.floor(ts / 60) % 50)
  return h < 9 ? sameDayAt(ts, 9, m) : h >= 18 ? sameDayAt(ts + DAY, 9, m) : ts
}

export const debPremierSwap: ScenarioTemplate = {
  id: 'deb-premier-swap',
  title: 'Mon premier swap',
  tagline: 'Des ETH entrent dans un pool, des USDT en ressortent… et finissent au casino.',
  description:
    'Le portefeuille d\'une victime a été vidé de ses ETH par un voleur qui répète la même routine à chaque vol : commission au fournisseur du faux site, échange des ETH contre des USDT sur un exchange décentralisé, dépôt sur un casino en ligne. Apprenez à reconnaître un swap (plusieurs mouvements dans une même transaction), à en lire les montants, et à isoler dans un historique répétitif les opérations qui correspondent à votre victime.',
  difficulty: 1,
  chains: ['eth'],
  skills: ['lecture_tx', 'evm', 'tokens', 'dex', 'typologies'],
  estMinutes: 35,
  lessons: ['comptes-evm', 'tokens-erc20', 'dex-defi', 'suivre-flux', 'typologies'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const pct = r.pick([15, 20, 25])
    const otherVictimP = fakePerson(r)
    const forumHandle = fakeHandle(r)

    const cv = exchange(w, 'coinhouse', 'eth')
    const uni = dex(w, 'uniswap', 'eth')
    const casinoE = w.customEntity({
      name: 'LuckyNova Casino (fictif)', category: 'gambling', risk: 'medium', known: true, country: 'Curaçao',
      description: 'Casino en ligne (fictif) acceptant les crypto-actifs : chaque compte joueur reçoit une adresse de dépôt personnelle, balayée vers le portefeuille du casino. Licence de Curaçao ; vérification d\'identité exigée seulement pour les retraits au-delà d\'un seuil.',
      compliance: { contact: 'Service conformité de LuckyNova', cooperation: 'voluntary', responseDays: [15, 60], canFreeze: true, kyc: 'faible', notes: 'Peut bloquer un compte joueur et communiquer : e-mail, pseudonyme, adresses IP de connexion, historique des dépôts, mises et retraits (avec les adresses de retrait). Pièce d\'identité seulement si un retrait a dépassé le seuil de vérification.' },
    })
    const casino = exchange(w, casinoE.id, 'eth')

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const suspect = w.customEntity({ name: 'Voleur (inconnu)', category: 'suspect' })
    const kitE = w.customEntity({ name: 'Opérateur du kit de phishing (inconnu)', category: 'suspect', description: 'Fournisseur du faux site, rémunéré par une part de chaque vol.' })
    const victim = w.addr('eth', { entity: victimE })
    const s1 = w.addr('eth', { entity: suspect })
    const kitOp = w.addr('eth', { entity: kitE })
    const player = casino.newDeposit()
    const path: Tx[] = []
    const T0 = w.at(0)

    // ── Vols antérieurs : la même routine, déjà rodée ───────────────────────
    interface Theft { victim: string; tx: Tx; comm: Tx; swap?: Tx; dep?: Tx; value: number }
    const routine = (t: number, value: number, full: boolean): Theft => {
      const pv = w.addr('eth')
      w.fundAccount(pv, value, 'ETH', t - Math.round(r.float(20, 300) * DAY))
      const tx = w.transfer({ time: t, from: pv, to: s1, value, asset: 'ETH' })
      const comm = w.transfer({ time: t + r.int(4, 25) * 60, from: s1, to: kitOp, value: eth((value * pct) / 100), asset: 'ETH' })
      if (!full) return { victim: pv, tx, comm, value }
      const sIn = eth(value - (value * pct) / 100 - r.float(0.01, 0.04))
      const { tx: swap, amountOut } = uni.swap({ trader: s1, assetIn: 'ETH', amountIn: sIn, assetOut: 'USDT', time: comm.time + Math.round(r.float(0.3, 3) * HOUR) })
      const dv = usdt(Math.round((amountOut * r.float(0.6, 0.9)) / 10) * 10)
      const dep = casino.receive(s1, dv, swap.time + Math.round(r.float(2, 9) * HOUR), { asset: 'USDT', depositAddr: player }).tx
      return { victim: pv, tx, comm, swap, dep, value }
    }
    const prev = [
      routine(T0 - Math.round(r.float(15, 21) * DAY), eth(r.float(0.6, 3.5)), true),
      routine(T0 - Math.round(r.float(5, 9) * DAY), eth(r.float(0.6, 3.5)), true),
    ]

    // ── Épargne de la victime (achats sur Coinhouse) ────────────────────────
    const buys = r.int(2, 3)
    for (let i = 0; i < buys; i++) cv.withdraw(victim, eth(r.float(0.4, 2.2)), w.at(-r.int(20, 400) * 24), 'ETH')

    // ── Vol : tout le solde part vers l'adresse du voleur ───────────────────
    const stolen = eth(w.balanceOf(victim, 'ETH'))
    const theft = w.transfer({ time: T0, from: victim, to: s1, value: stolen, asset: 'ETH' })
    path.push(theft)

    // ── Commission à l'opérateur du kit de phishing ─────────────────────────
    const commission = eth((stolen * pct) / 100)
    const commTx = w.transfer({ time: T0 + r.int(5, 20) * 60, from: s1, to: kitOp, value: commission, asset: 'ETH' })
    path.push(commTx)

    // ── Swap ETH → USDT sur le DEX ──────────────────────────────────────────
    uni.noise(14, T0 - 20 * DAY, T0 + 3 * DAY)
    const swapIn = eth(stolen - commission - r.float(0.02, 0.06))
    const swapT = commTx.time + Math.round(r.float(0.2, 2.5) * HOUR)
    const { tx: swapTx, amountOut } = uni.swap({ trader: s1, assetIn: 'ETH', amountIn: swapIn, assetOut: 'USDT', time: swapT })
    path.push(swapTx)

    // ── Dépôt des USDT sur le compte joueur du casino ───────────────────────
    const depT = swapT + Math.round(r.float(1, 8) * HOUR)
    const d = casino.receive(s1, amountOut, depT, { asset: 'USDT', depositAddr: player })
    path.push(d.tx, ...(d.sweep ? [d.sweep] : []))

    // ── Un vol de plus, le lendemain (ETH pas encore converti) ──────────────
    const next = routine(T0 + Math.round(r.float(20, 40) * HOUR), eth(r.float(0.4, 2.5)), false)

    // ── L'opérateur du kit encaisse les commissions d'autres « clients » ────
    const nClients = r.int(4, 6)
    for (let i = 0; i < nClients; i++) w.fundAccount(kitOp, eth(r.float(0.05, 0.8)), 'ETH', T0 + Math.round(r.float(-12, 4) * DAY))
    w.transfer({ time: T0 + Math.round(r.float(4.5, 6) * DAY), from: kitOp, to: w.addr('eth'), value: eth(w.balanceOf(kitOp, 'ETH') * r.float(0.85, 0.95)), asset: 'ETH' })

    // ── Bruit de fond ────────────────────────────────────────────────────────
    casino.noise(14, w.at(-20 * 24), w.at(4 * 24), 'USDT')
    cv.noise(8, w.at(-4 * 24), w.at(3 * 24), 'ETH')

    const casinoName = casinoE.name
    const pool = uni.pool('ETH', 'USDT')
    const ethLeft = eth(w.balanceOf(s1, 'ETH'))
    // Reliquats d'USDT des vols précédents, jamais déposés (gelables par l'émetteur)
    const usdtLeft = usdt(w.balanceOf(s1, 'USDT'))
    const nOtherThefts = prev.length + 1
    const nDeposits = prev.length + 1
    const prevSwapDates = prev.map((p) => fmtDate(p.swap!.time, false)).join(' et ')
    const docT = office(depT + DAY)
    // Message du forum : le lendemain du vol suivant, en journée ; la réponse vient de la victime du premier vol
    const forumT = sameDayAt(next.tx.time + DAY, r.int(9, 21), r.int(0, 59))
    const nextHour = parisHM(next.tx.time)[0]
    const replyWeeks = Math.round((forumT - prev[0].tx.time) / (7 * DAY))

    return {
      world: w,
      title: `Portefeuille vidé — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte. En cherchant à mettre à jour son portefeuille Ethereum, ${g('il', 'elle')} a cliqué sur un lien sponsorisé et saisi sa phrase de récupération sur un faux site. Le ${fmtDate(T0, false)}, tous ses ETH ont disparu.\n\n` +
        `Les voleurs convertissent souvent leur butin avant de l'encaisser : sur un exchange décentralisé (DEX), un smart contract échange instantanément un actif contre un autre, sans compte ni vérification d'identité. Dans la transaction, on voit l'actif partir vers un pool de liquidité et un autre actif revenir.\n\n` +
        `Le voleur n'en est pas à son premier vol : son adresse répète la même routine. Votre mission : identifier l'adresse du voleur et tous les bénéficiaires du vol, isoler les opérations qui correspondent à votre victime (commission, échange, dépôt), en lire les montants, et suivre les fonds jusqu'au service où ils ont été déposés.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: docT, author: victimName,
          body:
            `« Le site ressemblait exactement à celui de mon application. Il demandait les 12 mots "pour resynchroniser". Une heure plus tard, mon solde était à zéro. Je n'ai rien envoyé moi-même.\n\n` +
            `J'avais environ ${amt(eth(Math.round(stolen * 10) / 10), 'ETH')}, achetés sur Coinhouse en plusieurs fois.\n\n` +
            `Mon adresse Ethereum : ${A(w, victim)} »`,
        },
        {
          id: 'note', type: 'note', title: 'Note de l\'analyste', date: docT + HOUR, author: 'Cellule d\'appui',
          body:
            `Le voleur détient la phrase de récupération : la transaction de vol est donc signée par la clé de la victime. C'est l'adresse destinataire qui nous intéresse.\n` +
            `Penser à vérifier si les fonds ont changé d'actif en cours de route, et ne pas confondre les opérations de notre victime avec celles d'autres vols : se caler sur l'horodatage du vol et sur les montants.`,
        },
        {
          id: 'osint', type: 'osint', title: 'Recherche en sources ouvertes — le kit de phishing', date: office(docT + DAY), author: 'Cellule d\'appui',
          body:
            `Le faux site imitant l'application de la victime est servi par un « kit de phishing » proposé en location sur une messagerie chiffrée.\n` +
            `Selon les annonces observées, l'opérateur du kit fournit le site et la publicité sponsorisée ; en échange, chaque « client » lui reverse ${pct} % de ce qu'il dérobe, peu après chaque vol.\n\n` +
            `Conséquence pour le traçage : un même vol a au moins deux bénéficiaires.`,
        },
        {
          id: 'forum', type: 'forum', title: 'Fil d\'un forum d\'entraide crypto (capture)', date: forumT, author: `@${forumHandle}`,
          body:
            `« Wallet vidé hier vers ${nextHour} h après avoir tapé ma seed sur un faux site de mise à jour 😡 Tous mes ETH partis vers ${A(w, s1).slice(0, 6)}…${A(w, s1).slice(-4)}. Quelqu'un d'autre ? »\n\n` +
            `Réponse de @${otherVictimP.name.split(' ')[0].toLowerCase()}${r.int(10, 99)} : « Même adresse pour moi, il y a environ ${replyWeeks} semaines. J'ai regardé : il change tout en USDT et l'envoie sur un casino. »`,
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
          id: 'o12', type: 'number', points: 9, tolerance: 0, unit: 'portefeuilles',
          prompt: 'Combien d\'autres portefeuilles (hors celui de la victime) ont été vidés vers la même adresse ?',
          answer: nOtherThefts,
          hint: 'Listez les transferts entrants d\'ETH de l\'adresse du voleur. Chaque vol est suivi, quelques minutes plus tard, d\'une commission vers la même adresse.',
          explanation: `${nOtherThefts} : deux avant les faits (${fmtDate(prev[0].tx.time, false)}, ${fmtDate(prev[1].tx.time, false)}) et un dans les deux jours qui suivent (${fmtDate(next.tx.time, false)}, ${amt(next.value, 'ETH')}), ce dernier signalé sur le forum. Chacun est le vidage complet d'un portefeuille, suivi d'une commission de ${pct} % : ce sont d'autres victimes du même voleur, à identifier et à rapprocher d'éventuelles plaintes.`,
        },
        {
          id: 'o7', type: 'address', points: 9,
          prompt: 'Après chaque vol, le voleur reverse une part des ETH à un tiers. Quelle est l\'adresse de ce bénéficiaire ?',
          answer: [kitOp],
          hint: 'Dépliez les sorties du voleur : un simple transfert d\'ETH vers une même adresse non étiquetée revient après chaque vol, à quelques minutes d\'intervalle.',
          explanation: `${A(w, kitOp)} reçoit, après chaque vol, environ ${pct} % du butin, exactement la part décrite dans les annonces du kit : c'est l'opérateur du kit de phishing. Il reçoit aussi les commissions de ${nClients} autres expéditeurs (d'autres « clients » du kit). C'est un second suspect, souvent plus intéressant que le voleur lui-même : son adresse est à surveiller et à rapprocher d'autres plaintes.`,
        },
        {
          id: 'o13', type: 'tx', points: 9,
          prompt: 'Laquelle de ces commissions correspond au vol de la victime ?',
          answer: [commTx.id],
          hint: 'Prenez la commission qui suit immédiatement le vol de la victime, et vérifiez qu\'elle en représente la bonne proportion.',
          explanation: `${commTx.hash.slice(0, 16)}… (${fmtDate(commTx.time)}) : ${amt(commission, 'ETH')}, soit ${pct} % des ${amt(stolen, 'ETH')} volés, quelques minutes après le vol. Les autres commissions correspondent aux autres vols : elles les suivent de quelques minutes et en représentent chacune ${pct} %, sur des montants différents.`,
        },
        {
          id: 'o2', type: 'entity', points: 8,
          prompt: 'Sur quel exchange décentralisé (DEX) le voleur a-t-il échangé les ETH ?',
          answer: ['uniswap'],
          hint: 'Ouvrez la transaction suivante du voleur : les ETH partent vers un contrat « Router » puis un « Pool », tous deux étiquetés.',
          explanation: `La transaction appelle le routeur du DEX (méthode swapExactETHForTokens) : les ETH passent par le routeur vers le pool ETH/USDT ${A(w, pool)}, qui renvoie des USDT au voleur. Le DEX est un protocole automatisé : il n'a ni compte client, ni données d'identité, et ne détient pas les fonds du voleur après l'échange.`,
        },
        {
          id: 'o6', type: 'tx', points: 10,
          prompt: 'Quelle transaction réalise l\'échange (le swap) des ETH de la victime ?',
          answer: [swapTx.id],
          hint: 'L\'adresse a fait plusieurs swaps. Retenez celui qui suit le vol et la commission de la victime, et dont le montant d\'ETH correspond au butin moins la commission.',
          explanation: `${swapTx.hash.slice(0, 16)}… (${fmtDate(swapTx.time)}) : une seule transaction, plusieurs transferts internes (ETH du voleur vers le routeur, du routeur vers le pool, puis USDT du pool vers le voleur). C'est la signature d'un swap. Les swaps du ${prevSwapDates} sont identiques dans leur forme, mais antérieurs : ils convertissent les vols précédents. Ce hash se cite tel quel dans le rapport : il prouve la conversion et sa contre-valeur.`,
        },
        {
          id: 'o8', type: 'amount', points: 9, unit: 'ETH', tolerance: 0.01,
          prompt: 'Combien d\'ETH le voleur a-t-il échangés dans ce swap ?',
          answer: swapIn,
          hint: 'Dans la transaction d\'échange, lisez le transfert d\'ETH qui part de l\'adresse du voleur.',
          explanation: `${amt(swapIn, 'ETH')} : le butin (${amt(stolen, 'ETH')}) moins la commission (${amt(commission, 'ETH')}) et une petite réserve gardée pour payer le gas. Rapprocher ainsi entrées et sorties permet de vérifier qu'aucune branche n'a été oubliée. Il reste aujourd'hui ${amt(ethLeft, 'ETH')} sur l'adresse, surtout le dernier vol, pas encore converti.`,
        },
        {
          id: 'o3', type: 'amount', points: 9, unit: 'USDT', tolerance: 0.01,
          prompt: 'Combien d\'USDT le voleur a-t-il obtenus en échange de ces ETH ?',
          answer: amountOut,
          hint: 'Dans la transaction d\'échange, cherchez le transfert de jeton qui revient vers l\'adresse du voleur.',
          explanation: `${amt(swapIn, 'ETH')} contre ${amt(amountOut, 'USDT')}. Le prix tient compte du cours, des frais du pool (0,3 %) et d'un léger glissement.`,
        },
        {
          id: 'o4', type: 'entity', points: 9,
          prompt: 'Sur quel service les USDT ont-ils été déposés ?',
          answer: [casinoE.id],
          hint: 'Après l\'échange, suivez les USDT (et non plus les ETH) : ils partent vers une adresse qui reverse tout à un portefeuille étiqueté.',
          explanation: `Les ${amt(amountOut, 'USDT')} partent vers une adresse de dépôt, balayée vers le portefeuille de ${casinoName}, un casino en ligne. Ce n'est pas un exchange régulé : le voleur mise ou fait transiter l'argent volé, puis retire des « gains » qui paraissent propres. Le casino connaît pourtant le compte joueur : e-mail, IP, historique des dépôts et des retraits. ${procedureFor(casinoE)}`,
        },
        {
          id: 'o9', type: 'address', points: 9,
          prompt: 'Quelle adresse de dépôt du casino faut-il citer dans la demande ?',
          answer: [player],
          hint: 'C\'est l\'adresse qui reçoit les USDT du voleur, pas le portefeuille du casino vers lequel elle les reverse.',
          explanation: `${A(w, player)} : comme un exchange, le casino attribue à chaque compte joueur sa propre adresse de dépôt, puis la balaie vers son portefeuille, qui mélange les fonds de tous les joueurs. La demande cite cette adresse, le hash du dépôt (${d.tx.hash.slice(0, 12)}…), sa date et son montant, et demande le gel du compte joueur.`,
        },
        {
          id: 'o14', type: 'number', points: 8, tolerance: 0, unit: 'dépôts',
          prompt: 'Combien de dépôts cette adresse de dépôt a-t-elle reçus de l\'adresse du voleur ?',
          answer: nDeposits,
          hint: 'Ouvrez l\'historique de l\'adresse de dépôt et comptez les transferts entrants qui viennent de l\'adresse du voleur (les sorties sont les balayages du casino).',
          explanation: `${nDeposits} dépôts : un après chacun des deux vols précédents, et celui des USDT de la victime. La même adresse de dépôt sert à chaque fois : c'est un seul compte joueur, alimenté vol après vol. La demande au casino porte donc sur l'ensemble de ces dépôts, et le compte peut concerner d'autres victimes.`,
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
          explanation: `Quiconque détient la phrase de récupération peut signer au nom de la victime : la blockchain atteste qu'une clé a été utilisée, pas qui tenait le clavier. La plainte (saisie des 12 mots sur un faux site), le destinataire inconnu et la routine commission-échange-dépôt, identique à celle d'autres vols, établissent le vol. Une signature ne contient aucune adresse IP, et une transaction confirmée ne s'annule pas : on suit les fonds et on demande des gels.`,
        },
      ],
      truth: {
        path: path.map((t) => t.id),
        addresses: [s1, kitOp, player, pool],
        debrief:
          `1. Avec la phrase de récupération dérobée, le voleur transfère tout le solde de la victime (${amt(stolen, 'ETH')}) vers ${A(w, s1)}.\n` +
          `2. Quelques minutes plus tard, il reverse ${amt(commission, 'ETH')} (${pct} %) à ${A(w, kitOp)}, l'opérateur du kit de phishing.\n` +
          `3. Il échange ${amt(swapIn, 'ETH')} sur Uniswap (${swapTx.hash.slice(0, 10)}…) : dans une seule transaction, les ETH passent par le routeur vers le pool ETH/USDT, et ${amt(amountOut, 'USDT')} reviennent à son adresse.\n` +
          `4. Il dépose les ${amt(amountOut, 'USDT')} sur son adresse de dépôt ${casinoName} ${A(w, player)}, balayée vers le portefeuille du casino.\n` +
          `5. Fausses pistes : la même adresse a vidé deux autres portefeuilles avant les faits et un dans les deux jours qui suivent. Chaque vol a sa commission, les deux précédents leur swap et leur dépôt au casino, sur la même adresse de dépôt. Seules les opérations qui suivent le vol de la victime, aux bons montants, sont les siennes.\n\n` +
          `À retenir : reconnaître un swap = repérer, dans une même transaction, un actif qui part vers un contrat de pool et un autre actif qui revient. La valeur change de forme, pas de propriétaire : on continue à suivre l'adresse du voleur, dans le nouvel actif. Sur une adresse qui répète la même routine, on se cale sur l'horodatage et les montants pour isoler les opérations de sa victime. Et un flux ne finit pas toujours chez un exchange : ici, un casino en ligne.\n\n` +
          `Réflexes de l'enquêteur : saisir ${casinoName} (compte joueur, IP, retraits) avec demande de blocage ; surveiller l'adresse de l'opérateur du kit et la rapprocher d'autres vols ; rapprocher les autres victimes (forum, plaintes) ; demander à Tether le gel des ${amt(usdtLeft, 'USDT')} restés sur l'adresse du voleur (reliquats des vols précédents, non déposés au casino) ; conserver l'adresse du faux site (nom de domaine, hébergeur) pour l'enquête OSINT.`,
      },
      hints: [
        'Partez du portefeuille de la victime : sa dernière transaction sortante vide tout le solde.',
        'L\'adresse du voleur répète la même routine : classez ses transactions par date et ne gardez que celles qui suivent le vol de la victime.',
        'Une transaction qui envoie des ETH vers des contrats étiquetés « Router » et « Pool » et fait revenir un jeton est un swap.',
        'Après le swap, suivez l\'actif obtenu : il part vers une adresse de dépôt d\'un service en ligne.',
      ],
    }
  },
}
