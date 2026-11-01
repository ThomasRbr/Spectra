import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import { dusting } from '../engine/realism'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

// Faux support technique sur le serveur Discord d'une application de
// portefeuille : la victime « vérifie » son portefeuille en envoyant ses SOL,
// puis ses USDC, à une « adresse de vérification ». L'escroc y encaisse
// plusieurs victimes et la vide par dépôts successifs sur UNE adresse de dépôt
// d'exchange, toujours la même : celle-ci reçoit aussi les dépôts d'une
// ancienne adresse de vérification, qui a d'ailleurs payé les frais de la
// nouvelle. Réutiliser une adresse de dépôt relie les campagnes au même compte.
// Habillage : victimes avant, pendant et après, dépôts antérieurs et
// postérieurs, alimentation en frais, poussière sosie.

const sol = (v: number) => roundAsset('SOL', v)
const usdc = (v: number) => roundAsset('USDC', v)

export const debSolanaSupport: ScenarioTemplate = {
  id: 'deb-solana-support',
  title: 'Solana : le faux support et l\'adresse de dépôt réutilisée',
  tagline: 'Signatures, SOL natif et jetons SPL, et une adresse de dépôt qui relie deux campagnes.',
  description:
    'Un faux « support technique » a convaincu une victime d\'envoyer ses SOL puis ses USDC pour « vérifier » son portefeuille. L\'adresse de l\'escroc a encaissé d\'autres victimes et se vide par dépôts successifs sur une même adresse de dépôt d\'exchange : retrouvez le dépôt qui emporte les fonds de la victime, puis exploitez la réutilisation de cette adresse de dépôt pour relier une campagne plus ancienne au même compte. Vous découvrirez aussi comment Solana présente ses comptes, ses signatures et ses jetons.',
  difficulty: 1,
  chains: ['sol'],
  skills: ['lecture_tx', 'evm', 'tokens', 'exchange_id', 'requisition'],
  estMinutes: 35,
  lessons: ['bases-blockchain', 'explorateur-blocs', 'solana', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const fakeAgent = fakeHandle(r)
    const app = r.pick(['Nebula Wallet', 'Orca Wallet', 'Lumen Wallet', 'Halo Wallet'])

    const destKey = r.pick(['binance', 'coinbase', 'kraken', 'okx'] as const)
    const fundKey = r.pick((['binance', 'coinbase', 'kraken', 'okx'] as const).filter((k) => k !== destKey))
    const dest = exchange(w, destKey, 'sol')
    const fund = exchange(w, fundKey, 'sol')

    const scamE = w.customEntity({ name: 'Faux support technique (inconnu)', category: 'scam', description: 'Escroc se faisant passer pour l\'assistance d\'une application de portefeuille.' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('sol', { entity: victimE })
    const S0 = w.addr('sol', { entity: scamE })
    const S1 = w.addr('sol', { entity: scamE })
    const D = dest.newDeposit()
    const T0 = w.at(0)

    /** Une victime du faux support paie une adresse de vérification. */
    const victims: { addr: string; value: number; tx: Tx; to: string }[] = []
    const prey = (to: string, t: number) => {
      const a = w.addr('sol')
      const value = sol(r.float(2.5, 18))
      w.fundAccount(a, sol(value + r.float(0.05, 0.8)), 'SOL', t - Math.round(r.float(5, 120) * DAY))
      const tx = w.transfer({ time: t, from: a, to, value, asset: 'SOL' })
      victims.push({ addr: a, value, tx, to })
      return tx
    }
    /** Dépôt de tout le solde SOL (moins une réserve de frais) sur l'adresse de dépôt réutilisée. */
    const deposits: { from: string; tx: Tx; asset: 'SOL' | 'USDC'; value: number }[] = []
    const depositAll = (from: string, t: number, asset: 'SOL' | 'USDC' = 'SOL') => {
      const value = asset === 'SOL' ? sol(w.balanceOf(from, 'SOL') - r.float(0.01, 0.04)) : usdc(w.balanceOf(from, 'USDC'))
      const d = dest.receive(from, value, t, { asset, depositAddr: D })
      deposits.push({ from, tx: d.tx, asset, value })
      return d
    }

    // ── Campagne précédente : ancienne adresse de vérification ──────────────
    prey(S0, T0 - Math.round(r.float(30, 34) * DAY))
    prey(S0, T0 - Math.round(r.float(26, 29) * DAY))
    depositAll(S0, T0 - Math.round(r.float(24, 25) * DAY))
    const lastPreyT = T0 - Math.round(r.float(19, 22) * DAY)
    prey(S0, lastPreyT)
    // L'ancienne adresse paie les frais de la nouvelle (réserve de compte + frais), puis se vide
    const gasV = sol(r.float(0.02, 0.08))
    const gasTx = w.transfer({ time: lastPreyT + Math.round(r.float(10, 30) * HOUR), from: S0, to: S1, value: gasV, asset: 'SOL' })
    depositAll(S0, gasTx.time + Math.round(r.float(2, 20) * HOUR))

    // ── Nouvelle campagne : victimes avant les faits, premier dépôt ─────────
    prey(S1, T0 - Math.round(r.float(70, 90) * HOUR))
    prey(S1, T0 - Math.round(r.float(30, 45) * HOUR))
    const depPrior = depositAll(S1, T0 - Math.round(r.float(16, 24) * HOUR))
    const sameDayTx = prey(S1, T0 - Math.round(r.float(1, 5) * HOUR))
    const sameDay = victims.find((x) => x.tx === sameDayTx)!

    // ── Avoirs de la victime (achats anciens) ────────────────────────────────
    const vSolHeld = sol(r.float(12, 45))
    const vUsdcHeld = usdc(r.int(8, 40) * 50)
    fund.withdraw(victim, sol(vSolHeld * 0.4), T0 - r.int(40, 200) * DAY, 'SOL')
    fund.withdraw(victim, sol(vSolHeld * 0.6), T0 - r.int(5, 30) * DAY, 'SOL')
    fund.withdraw(victim, vUsdcHeld, T0 - r.int(5, 60) * DAY, 'USDC')

    // ── « Vérification » : un petit test, puis presque tout, puis les USDC ──
    const v1 = sol(r.pick([0.5, 1, 1.5, 2]))
    const pay1 = w.transfer({ time: T0, from: victim, to: S1, value: v1, asset: 'SOL' })
    const v2 = sol(Math.floor((w.balanceOf(victim, 'SOL') - r.float(0.05, 0.3)) * 100) / 100)
    const pay2 = w.transfer({ time: T0 + r.int(6, 20) * 60, from: victim, to: S1, value: v2, asset: 'SOL' })
    const pay3 = w.transfer({ time: pay2.time + r.int(10, 40) * 60, from: victim, to: S1, value: vUsdcHeld, asset: 'USDC' })

    // ── Dépôts qui emportent les fonds de la victime (même adresse de dépôt)
    const depT = pay3.time + Math.round(r.float(0.5, 3) * HOUR)
    const d1 = depositAll(S1, depT, 'SOL')
    const solDep = d1.tx.transfers[0].value
    const d2 = depositAll(S1, depT + r.int(2, 15) * 60, 'USDC')
    const usdcDep = d2.tx.transfers[0].value
    const delayMin = Math.round((d1.tx.time - pay1.time) / 60)
    const afterLastMin = Math.round((d1.tx.time - pay3.time) / 60)

    // ── Après les faits : une victime de plus, un dépôt de plus ─────────────
    const laterTx = prey(S1, depT + Math.round(r.float(30, 60) * HOUR))
    const later = victims.find((x) => x.tx === laterTx)!
    const depLater = depositAll(S1, laterTx.time + Math.round(r.float(4, 12) * HOUR))

    // ── Poussière sosie sur l'adresse de vérification ───────────────────────
    // Après les dépôts de la victime : une poussière antérieure se glisserait entre les envois et brouillerait le tri
    const poison = dusting(w, S1, { time: depT + 24 * HOUR, n: 2, spreadH: 30, min: depT + 2 * HOUR })

    // ── Bruit de fond ────────────────────────────────────────────────────────
    dest.noise(16, T0 - 34 * DAY, T0 + 6 * DAY, 'SOL')
    dest.noise(10, T0 - 5 * DAY, T0 + 6 * DAY, 'USDC')
    fund.noise(8, T0 - 5 * DAY, T0 + 4 * DAY, 'SOL')

    // ── Réponses (monde final) ───────────────────────────────────────────────
    const s1Victims = victims.filter((x) => x.to === S1)
    const nVictims = s1Victims.length + 1
    const intoD = w.txsOf(D).flatMap((t) => t.transfers).filter((x) => x.to === D)
    const nDeposits = intoD.length
    const fromS0 = deposits.filter((x) => x.from === S0)
    const s0Total = sol(fromS0.reduce((s, x) => s + x.value, 0))
    const destName = dest.entity.name
    const totalSol = sol(v1 + v2)
    const laterP = fakePerson(r)
    const priorDepSol = depPrior.tx.transfers[0].value
    // Écart entre le dépôt et les envois qu'il emporte : réserve de frais gardée, reliquat du dépôt précédent
    const carried = sol(totalSol + sameDay.value)
    const gap = sol(solDep - carried)
    const s0Weeks = Math.round((T0 - fromS0[fromS0.length - 1].tx.time) / (7 * DAY))
    const plainteT = Math.floor((depT + DAY) / DAY) * DAY + r.int(8, 15) * HOUR + r.int(0, 59) * 60
    const noteT = plainteT + DAY + r.int(-3, 3) * HOUR

    return {
      world: w,
      title: `Faux support technique — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, dépose plainte pour escroquerie. Après avoir signalé un bug de l'application ${app} sur son serveur Discord officiel, ${g('il', 'elle')} a été ${g('contacté', 'contactée')} en message privé par un « agent du support ». Celui-ci lui a expliqué que son portefeuille devait être « vérifié » : un petit envoi test de SOL, puis le reste « pour synchronisation », enfin ses USDC. Rien n'est revenu.\n\n` +
        `Solana fonctionne par comptes, comme Ethereum : pas d'adresse de rendu, un solde par actif. Son actif natif est le SOL ; les autres jetons (dont l'USDC) suivent le standard SPL. Les explorateurs appellent « signature » l'identifiant d'une transaction.\n\n` +
        `Votre mission : identifier l'adresse de l'escroc et ses autres victimes, retrouver le dépôt qui emporte les fonds de la victime et la plateforme à requérir, puis exploiter l'adresse de dépôt pour relier d'autres opérations au même compte.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteT, author: victimName,
          body:
            `« L'agent s'appelait "${fakeAgent}". Il m'a fait envoyer ${amt(v1, 'SOL')} pour tester, puis ${amt(v2, 'SOL')} quelques minutes plus tard, puis mes ${amt(vUsdcHeld, 'USDC')}. Rien n'est revenu, et son compte Discord a disparu peu après.\n\n` +
            `Mon adresse Solana : ${A(w, victim)}\n` +
            `Signature de l'envoi de ${amt(v2, 'SOL')} (${fmtDate(pay2.time)}) :\n${pay2.hash} »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture de la conversation (message privé Discord)', author: fakeAgent, date: T0 - HOUR,
          body:
            `[${app} Support ✅] Bonjour, votre portefeuille présente une désynchronisation de validateur.\n` +
            `Pour éviter le gel de vos actifs, une vérification est nécessaire :\n` +
            `1) envoyez ${amt(v1, 'SOL')} à l'adresse de vérification (QR code ci-dessous)\n` +
            `2) puis le solde restant, qui vous sera recrédité sous 10 minutes\n` +
            `3) même procédure pour vos jetons (USDC)\n` +
            `[QR code — illisible sur la capture]\n` +
            `Ne communiquez avec personne d'autre, le support ne vous contactera jamais publiquement.`,
        },
        {
          id: 'discord', type: 'forum', title: `Salon #entraide du serveur Discord ${app} (capture)`, date: later.tx.time + DAY,
          body:
            `[${fmtDate(T0 - 3 * HOUR)}] ${victimName.split(' ')[0]} : Bonjour, mon solde ne s'affiche plus depuis la mise à jour, quelqu'un a une solution ?\n` +
            `[${fmtDate(T0 - 2 * HOUR)}] Modérateur : Attention, de faux agents contactent les membres en privé. Le support ne demande JAMAIS d'envoyer des fonds.\n` +
            `[${fmtDate(later.tx.time + 2 * HOUR)}] ${laterP.name.split(' ')[0]} : Un « agent » m'a fait faire une « vérification » aujourd'hui, j'ai envoyé ${amt(later.value, 'SOL')}, tout est parti…\n` +
            `[${fmtDate(later.tx.time + 3 * HOUR)}] Modérateur : Même mode opératoire qu'il y a quelques semaines. Merci de porter plainte.`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe', date: noteT, author: 'Chef de groupe',
          body:
            `L'adresse de l'escroc dépose plusieurs fois au même endroit : ne cite pas n'importe quel dépôt, prends celui qui suit les envois de la victime.\n\n` +
            `Sur Solana comme sur Ethereum, une plateforme attribue en principe une adresse de dépôt par client. Si d'autres adresses alimentent la même adresse de dépôt, regarde-les de près : le modérateur évoque une campagne identique « il y a quelques semaines ».`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o1', type: 'address', points: 9,
          prompt: 'Quelle est l\'adresse Solana de l\'escroc (l\'« adresse de vérification ») ?',
          answer: [S1],
          hint: 'La capture ne montre pas l\'adresse : ouvrez la signature citée dans la plainte, ou dépliez les sorties du portefeuille de la victime.',
          explanation: `Les trois envois de la victime (${amt(totalSol, 'SOL')} et ${amt(vUsdcHeld, 'USDC')}) vont vers ${A(w, S1)}. Une adresse Solana est une suite de 32 à 44 caractères en base 58, sans préfixe.`,
        },
        {
          id: 'o6', type: 'number', points: 9, tolerance: 0, unit: 'victimes',
          prompt: 'Combien de victimes (celle de la plainte comprise) ont envoyé des fonds à l\'adresse de vérification ?',
          answer: nVictims,
          hint: 'Listez les entrées de l\'adresse et comptez les portefeuilles émetteurs. Écartez la toute première entrée, quelques centièmes de SOL envoyés des semaines avant par une adresse qui n\'a rien d\'une victime, et les micro-montants de jetons venus d\'adresses ressemblantes.',
          explanation: `${nVictims} victimes : ${victimName} et ${s1Victims.length} autres portefeuilles, chacun ayant envoyé plusieurs SOL, avant ou après les faits (dont celui qui témoigne sur Discord). La première entrée, ${amt(gasV, 'SOL')} venus de ${A(w, S0).slice(0, 10)}…, n'est pas un paiement : c'est l'alimentation en frais de l'adresse, par l'escroc lui-même. Les ${poison.txs.length} micro-transferts de jetons depuis des adresses sosies sont de l'empoisonnement d'adresse.`,
        },
        {
          id: 'o14', type: 'address', points: 8,
          prompt: 'Le jour même, quelques heures avant la victime, une autre personne a envoyé des SOL à l\'escroc. Quelle est son adresse ?',
          answer: [sameDay.addr],
          hint: 'Classez les entrées de l\'adresse de vérification par date : prenez celle qui précède de peu le premier envoi de la victime.',
          explanation: `${A(w, sameDay.addr)} envoie ${amt(sameDay.value, 'SOL')} le ${fmtDate(sameDay.tx.time)}. Ses fonds partent dans le même dépôt que ceux de la victime : c'est la victime à identifier en priorité (via la plateforme où elle a acheté ses SOL) pour recueillir sa plainte. On parle de victime apparente tant que rien ne prouve le contraire.`,
        },
        {
          id: 'o4', type: 'choice', points: 7,
          prompt: 'Dans la plainte, la victime cite une « signature ». De quoi s\'agit-il ?',
          ...choice(r,
            'De l\'identifiant unique de la transaction, l\'équivalent d\'un hash',
            [
              'De la clé privée de la victime, qu\'il faut aussitôt saisir dans l\'outil',
              'D\'une preuve juridique du consentement de la victime au virement',
              'Du code de vérification envoyé par le faux support, sans valeur on-chain',
            ]),
          hint: 'Collez la chaîne citée dans la recherche : sur quoi tombez-vous ?',
          explanation: 'Sur Solana, une transaction est identifiée par sa première signature (une longue chaîne en base 58). C\'est elle que l\'on recherche dans un explorateur et que l\'on cite dans une réquisition, comme un hash de transaction sur Bitcoin ou Ethereum. Elle prouve que la transaction a été autorisée par la clé de l\'émetteur, mais ne révèle pas cette clé. Une clé privée ou une phrase de récupération ne doit jamais être saisie dans un outil d\'analyse.',
        },
        {
          id: 'o5', type: 'choice', points: 7,
          prompt: 'Les USDC de la victime ont-ils circulé comme ses SOL ?',
          ...choice(r,
            'Non : l\'USDC est un jeton SPL, suivi à part, mais ses frais se paient quand même en SOL',
            [
              'Oui : sur Solana, l\'USDC est converti en SOL dès qu\'il quitte le portefeuille',
              'Non : l\'USDC circule sur Ethereum, la victime a donc utilisé un bridge',
              'Oui : l\'USDC est une monnaie native de Solana, au même titre que le SOL',
            ]),
          hint: 'Comparez l\'actif indiqué sur les arêtes et la monnaie dans laquelle sont payés les frais.',
          explanation: 'Le SOL est l\'actif natif : il paie les frais (quelques fractions de centime) et la réserve des comptes. L\'USDC est un jeton émis par Circle au standard SPL, transféré par le programme de jetons ; chaque portefeuille le détient dans un « compte de jetons » rattaché à son adresse, que les explorateurs affichent sous le portefeuille propriétaire. On suit donc les deux actifs séparément : l\'escroc les dépose d\'ailleurs en deux transferts distincts.',
        },
        {
          id: 'o2', type: 'address', points: 9,
          prompt: 'Quelle est l\'adresse de dépôt de l\'exchange à mentionner dans la réquisition ?',
          answer: [D],
          hint: 'Suivez les gros montants qui sortent de l\'adresse de l\'escroc : l\'adresse qui les reçoit puis les reverse à un hot wallet étiqueté est l\'adresse de dépôt.',
          explanation: `${A(w, D)} est une adresse de dépôt ${destName} : tous les dépôts de l'escroc y arrivent, puis sont reversés au hot wallet de la plateforme. C'est elle qui permet à ${destName} de retrouver le compte client.`,
        },
        {
          id: 'o7', type: 'entity', points: 9,
          prompt: 'À quelle plateforme appartient cette adresse de dépôt ?',
          answer: [destKey],
          hint: 'Regardez l\'étiquette de l\'adresse vers laquelle l\'adresse de dépôt reverse les fonds.',
          explanation: `L'adresse de dépôt reverse tout au hot wallet étiqueté ${de(destName)} : c'est un compte client de cette plateforme. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o10', type: 'tx', points: 11,
          prompt: 'Quel transfert de SOL vers l\'adresse de dépôt emporte les SOL de la victime ?',
          answer: [d1.tx.id],
          hint: 'Classez les transferts de SOL de l\'adresse de vérification vers l\'adresse de dépôt par date, et placez les envois de la victime dans cette chronologie.',
          explanation: `Le ${fmtDate(d1.tx.time)}, ${amt(solDep, 'SOL')} partent vers l'adresse de dépôt (${d1.tx.hash.slice(0, 12)}…), ${afterLastMin} minutes après le dernier envoi de la victime : c'est le premier dépôt qui les suit, et il vide l'adresse (il n'y reste que de quoi payer les frais). Le dépôt du ${fmtDate(depPrior.tx.time)} (${amt(priorDepSol, 'SOL')}) précède les faits : il emporte l'argent des victimes antérieures. Celui du ${fmtDate(depLater.tx.time)} emporte le paiement d'une victime arrivée ensuite. Les USDC partent par un transfert distinct de ${amt(usdcDep, 'USDC')}, quelques minutes après (${d2.tx.hash.slice(0, 12)}…).`,
        },
        {
          id: 'o3', type: 'amount', points: 8, unit: 'SOL', tolerance: 0.001,
          prompt: 'Combien de SOL ce transfert dépose-t-il ?',
          answer: solDep,
          hint: 'Ouvrez le transfert identifié à la question précédente et lisez la valeur en SOL.',
          explanation: `${amt(solDep, 'SOL')} : les envois de la victime (${amt(totalSol, 'SOL')}) et celui de la victime du même jour (${amt(sameDay.value, 'SOL')}), soit ${amt(carried, 'SOL')}. L'écart (${gap < 0 ? '−' : '+'}${amt(Math.abs(gap), 'SOL')}) vient des réserves : à chaque dépôt, l'escroc laisse sur l'adresse une petite réserve de SOL pour les frais, et la réserve du dépôt précédent part avec le suivant. Il n'y a pas de rendu sur Solana : ce qui n'est pas envoyé reste simplement sur l'adresse.`,
        },
        {
          id: 'o11', type: 'address', points: 10,
          prompt: 'Des semaines plus tôt, une autre adresse non étiquetée alimentait déjà la même adresse de dépôt. Laquelle ?',
          answer: [S0],
          hint: 'Listez les entrées de l\'adresse de dépôt : toutes ne viennent pas de l\'adresse de vérification actuelle.',
          explanation: `${A(w, S0)} dépose ${fromS0.length} fois sur ${A(w, D).slice(0, 10)}… (${amt(s0Total, 'SOL')}), ${s0Weeks <= 1 ? 'quelques jours' : `environ ${s0Weeks} semaines`} avant les faits, après avoir reçu les SOL de plusieurs personnes : c'est l'adresse de vérification de la campagne précédente (celle qu'évoque le modérateur). Elle a même payé les frais de la nouvelle adresse (${amt(gasV, 'SOL')}, ${gasTx.hash.slice(0, 12)}…). Ses payeurs sont autant de victimes supplémentaires à identifier.`,
        },
        {
          id: 'o12', type: 'number', points: 8, tolerance: 0, unit: 'dépôts',
          prompt: 'Combien de dépôts (SOL et USDC confondus) l\'adresse de dépôt a-t-elle reçus au total ?',
          answer: nDeposits,
          hint: 'Comptez les transferts entrants de l\'adresse de dépôt, sans les reversements sortants vers le hot wallet.',
          explanation: `${nDeposits} dépôts, tous venus des deux adresses de vérification de l'escroc. La réquisition les liste tous (signatures, dates, montants) : la plateforme pourra rapprocher chaque crédit du même compte et en mesurer l'activité totale. Une adresse de dépôt ne reçoit normalement que les fonds de son titulaire : la réutiliser trahit la continuité entre les deux campagnes.`,
        },
        {
          id: 'o8', type: 'number', points: 7, tolerance: 3, unit: 'minutes',
          prompt: 'Combien de minutes se sont écoulées entre l\'envoi « test » de la victime et le dépôt de ses SOL sur l\'exchange ?',
          answer: delayMin,
          hint: 'Comparez l\'horodatage du premier envoi de la victime (le plus petit) et celui du transfert de SOL identifié plus haut.',
          explanation: `Environ ${delayMin} minutes (${fmtDate(pay1.time)} → ${fmtDate(d1.tx.time)}). Le faux support encaisse ${delayMin <= 90 ? 'presque immédiatement' : 'en quelques heures à peine'} : quand la victime comprend, les fonds sont déjà sur un compte d'exchange. Seule une demande de gel adressée sans délai à la plateforme peut encore préserver ce qui n'a pas été retiré.`,
        },
        {
          id: 'o13', type: 'choice', points: 7,
          prompt: 'Que déduire du fait que les deux adresses de vérification déposent sur la même adresse de dépôt ?',
          ...choice(r,
            'Les deux campagnes alimentent très probablement le même compte client : une seule réquisition les couvre, et les victimes de la première campagne rejoignent le dossier',
            [
              'Rien : une adresse de dépôt d\'exchange est partagée par tous les clients de la plateforme',
              'Que la plateforme est complice, puisqu\'elle accepte des fonds de plusieurs adresses',
              'Que l\'ancienne adresse appartient à une victime, qui a été remboursée par l\'exchange',
            ]),
          hint: 'Sur Solana, une adresse de dépôt d\'exchange est-elle propre à un client ou commune à tous ?',
          explanation: `Sur Solana, comme sur Ethereum ou Tron, une plateforme attribue en principe une adresse de dépôt par client (les adresses partagées avec mémo sont l'exception de XRP ou de TON). Deux portefeuilles qui déposent au même endroit renvoient donc, sauf preuve contraire, au même compte. Ce lien se confirme avec le transfert de frais de l'ancienne adresse vers la nouvelle. ${destName} n'est pas complice : elle reçoit les dépôts de son client, et c'est elle qui pourra l'identifier et geler le compte.`,
        },
      ],
      truth: {
        path: [pay1.id, pay2.id, pay3.id, d1.tx.id, ...(d1.sweep ? [d1.sweep.id] : []), d2.tx.id, ...(d2.sweep ? [d2.sweep.id] : [])],
        addresses: [S1, D, S0],
        debrief:
          `1. Sur les instructions du faux support, ${victimName} envoie ${amt(v1, 'SOL')} (« test »), puis ${amt(v2, 'SOL')}, puis ${amt(vUsdcHeld, 'USDC')} à ${A(w, S1)}.\n` +
          `2. Cette adresse de vérification a encaissé ${nVictims} victimes en tout, avant et après les faits ; elle avait reçu ses premiers frais (${amt(gasV, 'SOL')}) d'une ancienne adresse de l'escroc.\n` +
          `3. Elle se vide par dépôts successifs, toujours sur l'adresse de dépôt ${destName} ${A(w, D)}. Le dépôt du ${fmtDate(depPrior.tx.time, false)} concerne des victimes antérieures ; environ ${delayMin} minutes après l'envoi « test », celui de ${amt(solDep, 'SOL')} emporte les SOL de la victime, suivi de ${amt(usdcDep, 'USDC')} ; un dernier dépôt suit le paiement de la victime qui témoigne sur Discord.\n` +
          `4. La même adresse de dépôt avait reçu, ${s0Weeks <= 1 ? 'quelques jours' : `environ ${s0Weeks} semaines`} plus tôt, ${fromS0.length} dépôts de l'ancienne adresse de vérification ${A(w, S0)} : même compte, campagne précédente. ${nDeposits} dépôts au total.\n\n` +
          `À retenir : sur Solana, une transaction s'appelle par sa signature, les adresses n'ont pas de préfixe, et l'on distingue l'actif natif (SOL) des jetons SPL. Sans rendu, on raisonne sur les soldes et la chronologie : le dépôt qui suit le paiement est celui qui l'emporte. Une adresse de dépôt réutilisée est un fil précieux : elle relie des adresses que rien d'autre ne rattache entre elles.\n\n` +
          `Réflexes de l'enquêteur : demande de gel immédiate et réquisition à ${destName} sur l'adresse de dépôt, en listant tous les dépôts (identité, IP, retraits) ; identification des victimes des deux campagnes à partir de leurs adresses ; signalement du faux compte de support à Discord et à l'éditeur ${de(app)}. Un vrai support ne demande jamais d'envoyer des fonds ni la phrase de récupération.`,
      },
      hints: [
        'Dépliez les sorties du portefeuille de la victime : ses trois envois vont vers la même adresse.',
        'Les entrées de l\'adresse de l\'escroc ne viennent pas toutes de la victime : regardez qui d\'autre l\'a payée, et écartez son alimentation en frais.',
        'L\'adresse de l\'escroc dépose plusieurs fois sur la même adresse de dépôt : le bon dépôt est celui qui suit les envois de la victime.',
        'Dépliez les entrées de l\'adresse de dépôt : une autre adresse de l\'escroc y apparaît.',
      ],
    }
  },
}
