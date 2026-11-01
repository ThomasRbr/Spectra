import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, de, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

// Faux cabinet de « récupération de cryptos » sur Ethereum. L'adresse donnée
// par courriel sert depuis plusieurs semaines : chaque « dossier » suit le même
// cycle (frais en ETH, caution en USDT, transfert vers une adresse de transit,
// dépôt des USDT sur la même adresse de dépôt d'exchange). L'enquêteur suit
// l'ETH et l'USDT, découvre le modèle à comptes (solde par actif, gas en ETH,
// pas de rendu), et doit isoler le cycle de sa victime parmi les précédents
// pour citer le bon dépôt dans la réquisition.

const ethR = (v: number) => roundAsset('ETH', v)

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

export const accEthFirst: ScenarioTemplate = {
  id: 'eth-first',
  title: 'Du wallet à l\'exchange sur Ethereum',
  tagline: 'Premier traçage sur un modèle à comptes : ETH natif et USDT (ERC-20), et un escroc qui recommence à chaque dossier.',
  description:
    'Une victime a payé un faux service de « récupération de cryptos » en ETH puis en USDT. Suivez les deux actifs à travers les adresses de l\'escroc jusqu\'à l\'adresse de dépôt d\'un exchange, découvrez les spécificités du modèle à comptes (solde par actif, gas payé en ETH, pas de rendu), puis isolez le cycle de votre victime parmi ceux des dossiers précédents pour citer le bon dépôt.',
  difficulty: 1,
  chains: ['eth'],
  skills: ['lecture_tx', 'evm', 'tokens', 'exchange_id', 'requisition'],
  estMinutes: 35,
  lessons: ['bases-blockchain', 'comptes-evm', 'tokens-erc20', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    // Autre brigade : une autre ville que celle de la victime
    let earlierCity = fakeCity(r)
    while (earlierCity === city) earlierCity = fakeCity(r)
    const earlierP = fakePerson(r)
    // Pseudonyme du faux avocat : un nom qui n'est porté par aucun autre personnage
    const lawyer = `Maître ${r.pick(['Vasseur', 'Delorme', 'Marchal', 'Fabre', 'Lacroix'])}`

    const cv = exchange(w, 'coinhouse', 'eth')
    const destKey = r.pick(['binance', 'bitstamp', 'okx'] as const)
    const dest = exchange(w, destKey, 'eth')

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('eth', { entity: victimE })
    const suspect = w.customEntity({ name: '« Crypto Recovery Experts » (inconnu)', category: 'suspect' })
    const s1 = w.addr('eth', { entity: suspect })
    const s2 = w.addr('eth', { entity: suspect })
    const deposit = dest.newDeposit()

    // ── Dossiers précédents : même cycle, même adresse de dépôt ─────────────
    interface Cycle { victim: string; fee: Tx; caution: Tx; ethHop: Tx; usdtHop: Tx; dep: Tx; usdt: number }
    const cycle = (start: number): Cycle => {
      const pv = w.addr('eth')
      const feeV = ethR(r.float(0.25, 0.8))
      const usdtV = Math.round(r.float(2000, 9000) / 100) * 100
      w.fundAccount(pv, ethR(feeV + r.float(0.01, 0.04)), 'ETH', start - Math.round(r.float(3, 30) * HOUR))
      const fee = w.transfer({ time: start, from: pv, to: s1, value: feeV, asset: 'ETH' })
      const cT = start + Math.round(r.float(20, 50) * HOUR)
      w.fundAccount(pv, usdtV + r.int(0, 30), 'USDT', cT - Math.round(r.float(2, 10) * HOUR))
      const caution = w.transfer({ time: cT, from: pv, to: s1, value: usdtV, asset: 'USDT' })
      const hT = cT + Math.round(r.float(4, 12) * HOUR)
      const ethHop = w.transfer({ time: hT, from: s1, to: s2, value: ethR(w.balanceOf(s1, 'ETH') * r.float(0.9, 0.97)), asset: 'ETH' })
      const usdtHop = w.transfer({ time: hT + r.int(3, 15) * 60, from: s1, to: s2, value: w.balanceOf(s1, 'USDT'), asset: 'USDT' })
      const dep = dest.receive(s2, w.balanceOf(s2, 'USDT'), usdtHop.time + Math.round(r.float(6, 20) * HOUR), { asset: 'USDT', depositAddr: deposit }).tx
      return { victim: pv, fee, caution, ethHop, usdtHop, dep, usdt: usdtV }
    }
    const prev = [cycle(w.at(-r.float(30, 38) * 24)), cycle(w.at(-r.float(12, 20) * 24))]

    // Historique antérieur de la victime (achats anciens sur Coinhouse)
    cv.withdraw(victim, ethR(r.float(0.05, 0.3)), w.at(-r.int(60, 200) * 24))
    cv.withdraw(victim, ethR(r.float(0.05, 0.2)), w.at(-r.int(20, 50) * 24))

    // Achat des fonds exigés par l'escroc
    const feeEth = ethR(r.float(0.35, 0.9))
    const usdtAmt = Math.round(r.float(4000, 14000) / 100) * 100
    cv.withdraw(victim, ethR(feeEth + r.float(0.01, 0.03)), w.at(-r.float(20, 30)), 'ETH')
    cv.withdraw(victim, usdtAmt + r.int(5, 30), w.at(r.float(18, 22)), 'USDT')

    // Paiements de la victime
    const t1 = w.transfer({ time: w.at(0), from: victim, to: s1, value: feeEth, asset: 'ETH' })
    const t2 = w.transfer({ time: w.at(r.float(24, 30)), from: victim, to: s1, value: usdtAmt, asset: 'USDT' })

    // Une autre victime paie la même adresse dans le même intervalle
    const other = w.addr('eth', { entity: w.customEntity({ name: 'Victime non identifiée', category: 'victim' }) })
    const otherUsdt = Math.round(r.float(1500, 6000) / 50) * 50
    w.fundAccount(other, ethR(r.float(0.02, 0.06)), 'ETH', w.at(-r.float(30, 60)))
    w.fundAccount(other, otherUsdt + r.int(0, 40), 'USDT', w.at(-r.float(10, 20)))
    const tOther = w.transfer({ time: w.at(r.float(-8, 18)), from: other, to: s1, value: otherUsdt, asset: 'USDT' })

    // Saut vers l'adresse de transit : d'abord l'ETH (pour le gas), puis l'USDT
    const hopT = w.at(r.float(32, 38))
    const ethFwd = ethR(w.balanceOf(s1, 'ETH') * r.float(0.9, 0.97))
    const t3 = w.transfer({ time: hopT, from: s1, to: s2, value: ethFwd, asset: 'ETH' })
    const usdtHopV = w.balanceOf(s1, 'USDT')
    const t4 = w.transfer({ time: hopT + r.int(3, 15) * 60, from: s1, to: s2, value: usdtHopV, asset: 'USDT' })

    // Dépôt sur l'exchange (même adresse de dépôt pour l'USDT et l'ETH)
    const depT = w.at(r.float(42, 60))
    const usdtDep = w.balanceOf(s2, 'USDT')
    const dep1 = dest.receive(s2, usdtDep, depT, { asset: 'USDT', depositAddr: deposit })
    const ethDep = ethR(w.balanceOf(s2, 'ETH') * r.float(0.6, 0.85))
    const dep2 = dest.receive(s2, ethDep, depT + r.int(5, 40) * 60, { asset: 'ETH', depositAddr: deposit })
    const ethLeft = ethR(w.balanceOf(s2, 'ETH'))

    // Bruit de fond
    dest.noise(16, w.at(-40 * 24), w.at(5 * 24), 'ETH')
    dest.noise(14, w.at(-40 * 24), w.at(5 * 24), 'USDT')
    cv.noise(8, w.at(-4 * 24), w.at(3 * 24), 'ETH')
    cv.noise(6, w.at(-4 * 24), w.at(3 * 24), 'USDT')

    // Courriel de la veille au soir ou du jour même (jamais au milieu de la nuit)
    const emailT0 = w.at(-r.float(2, 6))
    const emailT = parisHM(emailT0)[0] >= 8 ? emailT0 : sameDayAt(w.at(-24), r.int(18, 21), r.int(0, 59))
    // Délai entre la caution USDT de la victime et le dépôt des USDT sur l'exchange (heures, au dixième)
    const delayH = Math.round((dep1.tx.time - t2.time) / 360) / 10
    const nVictimsTotal = prev.length + 2
    const nUsdtDeposits = prev.length + 1
    const prevDeps = prev.map((c) => `le ${fmtDate(c.dep.time, false)} (${amt(c.usdt, 'USDT')})`).join(' et ')
    // Délais caution → dépôt des dossiers précédents (heures)
    const prevDelays = prev.map((c) => Math.round((c.dep.time - c.caution.time) / 3600))

    return {
      world: w,
      title: `Faux service de récupération — ${city}`,
      briefing:
        `Le ${fmtDate(w.at(4 * 24), false)}, ${victimName} (${city}) dépose plainte. Déjà victime d'une arnaque à l'investissement l'an passé, ${g('il a été contacté', 'elle a été contactée')} par « Crypto Recovery Experts », un prétendu cabinet capable de « récupérer » ses fonds perdus.\n\n` +
        `On lui a d'abord réclamé des « frais d'ouverture de dossier » en ETH, puis une « caution de déblocage » en USDT (réseau Ethereum). Bien sûr, rien n'a jamais été récupéré.\n\n` +
        `Ethereum fonctionne par comptes et non par UTXO : chaque transaction débite directement le solde de l'émetteur. Votre mission : suivre l'ETH et l'USDT jusqu'à la plateforme où ils ont été déposés, identifier l'adresse de dépôt et la transaction à citer dans la réquisition, et repérer les autres victimes. Attention : le « cabinet » n'en est pas à son premier dossier.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(4 * 24), author: victimName,
          body:
            `« J'ai trouvé ce cabinet après avoir laissé un commentaire sur un forum de victimes. Un certain "${lawyer}" m'a écrit le jour même.\n\n` +
            `J'ai payé ${amt(feeEth, 'ETH')} de frais de dossier le ${fmtDate(t1.time)}, puis ${amt(usdtAmt, 'USDT')} de caution le ${fmtDate(t2.time)}, depuis mon portefeuille personnel alimenté par Coinhouse.\n\n` +
            `Mon adresse Ethereum : ${A(w, victim)}\n` +
            `Transaction de la caution USDT : ${t2.hash} »`,
        },
        {
          id: 'email', type: 'email', title: 'Courriel de « Crypto Recovery Experts »', date: emailT, author: 'dossiers@crypto-recovery-experts.example',
          body:
            `${g('Monsieur', 'Madame')},\n\nNotre cellule blockchain a localisé vos fonds. Pour ouvrir votre dossier de récupération, merci de régler les frais de traitement (${amt(feeEth, 'ETH')}) sur notre portefeuille sécurisé :\n\n${A(w, s1)}\n\n` +
            `Une caution remboursable vous sera ensuite demandée en USDT (ERC-20 uniquement) sur cette même adresse.\n\nCordialement,\n${lawyer} — Département Recouvrement`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture — application portefeuille de la victime', date: t2.time,
          body: `Envoyé · USDT (ERC-20)\n-${amt(usdtAmt, 'USDT')}\nÀ : ${A(w, s1)}\nFrais réseau : ${amt(t2.fee, 'ETH')}\nStatut : Confirmé`,
        },
        {
          id: 'pv', type: 'pv', title: `Message de la brigade ${de(earlierCity)}`, date: w.at(5 * 24), author: `Brigade ${de(earlierCity)}`,
          body:
            `Suite à votre diffusion : nous avons reçu le ${fmtDate(prev[0].caution.time + 6 * DAY, false)} la plainte ${de(earlierP.name)}, démarché${earlierP.g('', 'e')} par le même « cabinet ». ${earlierP.g('Il', 'Elle')} a payé des frais en ETH puis une caution de ${amt(prev[0].usdt, 'USDT')} le ${fmtDate(prev[0].caution.time, false)}, sur l'adresse ${A(w, s1)}.\n\n` +
            `Nous n'avons pas encore exploité la piste blockchain. Merci de nous tenir informés si vos réquisitions couvrent aussi notre dossier.`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o12', type: 'number', points: 8, tolerance: 0, unit: 'victimes',
          prompt: 'Combien de portefeuilles de victimes distincts (celui de la plainte compris) ont payé l\'adresse du « cabinet » ?',
          answer: nVictimsTotal,
          hint: 'Dépliez les flux entrants de l\'adresse indiquée dans le courriel, sur toute sa durée de vie : chaque victime paie des frais en ETH puis une caution en USDT (ou seulement la caution).',
          explanation: `${nVictimsTotal} portefeuilles : ${victimName}, une autre victime dans les mêmes jours, et deux victimes de dossiers plus anciens (les ${fmtDate(prev[0].fee.time, false)} et ${fmtDate(prev[1].fee.time, false)}), dont ${earlierP.name}, qui a porté plainte à ${earlierCity}. On compte des adresses émettrices, pas des transactions : chaque dossier complet donne deux paiements (ETH puis USDT) depuis la même adresse.`,
        },
        {
          id: 'o6', type: 'address', points: 8,
          prompt: 'Le transfert d\'USDT qui suit la caution de la victime emporte aussi le versement d\'une autre personne, arrivé dans la même fenêtre. Quelle est son adresse ?',
          answer: [other],
          hint: 'Regardez les entrées d\'USDT de l\'adresse de l\'escroc entre son transfert précédent vers l\'adresse de transit et celui qui suit la caution de la victime.',
          explanation: `${A(w, other)} envoie ${amt(otherUsdt, 'USDT')} (montant rond) le ${fmtDate(tOther.time)}. Entre deux transferts vers l'adresse de transit, l'escroc n'a reçu que deux versements d'USDT : celui ${de(victimName)} et celui-ci. C'est donc lui qui explique que le transfert suivant (${amt(usdtHopV, 'USDT')}) dépasse la caution de la victime. Les victimes des dossiers antérieurs ont payé plus tôt, et leurs USDT sont partis lors de transferts précédents.`,
        },
        {
          id: 'o5', type: 'address', points: 9,
          prompt: 'Vers quelle seconde adresse l\'escroc fait-il transiter l\'ETH et l\'USDT ?',
          answer: [s2],
          hint: 'Dépliez les flux sortants de l\'adresse de l\'escroc : deux transferts (un en ETH, un en USDT) partent vers la même adresse, à quelques minutes d\'intervalle.',
          explanation: `${A(w, s2)} reçoit ${amt(ethFwd, 'ETH')} puis, quelques minutes plus tard, tout l'USDT de ${A(w, s1)}. Ce n'est pas une adresse jetable : elle a reçu le même couple de transferts après chaque dossier précédent. C'est l'adresse de transit de l'escroc, non attribuée, qui éloigne les fonds de l'adresse communiquée aux victimes.`,
        },
        {
          id: 'o7', type: 'amount', points: 8, unit: 'ETH', tolerance: 0.01,
          prompt: 'Juste avant de transférer l\'USDT de la victime, combien d\'ETH l\'escroc envoie-t-il vers l\'adresse de transit ?',
          answer: ethFwd,
          hint: 'Plusieurs transferts d\'ETH relient les deux adresses : prenez celui qui précède de quelques minutes le transfert d\'USDT postérieur à la caution de la victime.',
          explanation: `${amt(ethFwd, 'ETH')} le ${fmtDate(t3.time)}, soit l'essentiel de l'ETH présent sur ${A(w, s1).slice(0, 12)}… (les frais ${de(victimName)} et un reliquat des dossiers précédents). L'escroc n'en garde qu'un peu, pour les frais du transfert d'USDT qui suit. Les transferts d'ETH antérieurs entre les deux adresses accompagnent les dossiers précédents.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Pourquoi l\'escroc envoie-t-il de l\'ETH vers sa seconde adresse avant d\'y transférer l\'USDT ?',
          ...choice(r,
            'Les frais d\'un transfert de jeton ERC-20 se paient en ETH : sans ETH, la seconde adresse ne pourrait pas déplacer l\'USDT',
            [
              'Pour convertir l\'ETH en USDT directement sur sa seconde adresse, sans passer par une plateforme',
              'Parce que l\'exchange exige un dépôt d\'ETH avant d\'accepter un dépôt d\'USDT',
              'Pour créer une sortie de rendu, comme le ferait un portefeuille Bitcoin',
            ]),
          hint: 'En quel actif sont payés les frais d\'un transfert d\'USDT sur Ethereum ?',
          explanation: `Sur Ethereum, tout transfert, y compris d'un jeton, consomme du « gas » payé en ETH par l'adresse émettrice. Une adresse qui ne détient que des USDT ne peut rien en faire : l'escroc doit l'approvisionner en ETH. Ce schéma (petit ETH, puis jetons), répété à chaque dossier, est un marqueur d'adresses contrôlées par la même personne. Il n'y a ni conversion ni rendu ici : juste deux transferts d'actifs différents.`,
        },
        {
          id: 'o1', type: 'entity', points: 9,
          prompt: 'Sur quelle plateforme les USDT ont-ils été déposés ?',
          answer: [destKey],
          hint: 'Suivez les transferts sortants de l\'adresse de transit, actif par actif. Une adresse étiquetée « Adresse de dépôt », ou qui reverse tout à un hot wallet étiqueté, appartient à un exchange.',
          explanation: `Les fonds passent de ${A(w, s1)} à l'adresse de transit ${A(w, s2)}, qui les dépose sur ${dest.entity.name}. L'adresse de dépôt est ensuite balayée (sweep) vers le hot wallet de la plateforme. ${procedureFor(dest.entity)}`,
        },
        {
          id: 'o2', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse de dépôt à mentionner dans la réquisition ?',
          answer: [deposit],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse qui reçoit les fonds de l\'escroc puis les reverse intégralement au hot wallet.',
          explanation: `Sur Ethereum aussi, l'exchange attribue à chaque client une adresse de dépôt propre. La même adresse sert pour l'ETH et pour tous les jetons ERC-20, et pour tous les dépôts du client : ici elle reçoit ${amt(usdtDep, 'USDT')} puis ${amt(ethDep, 'ETH')}, après avoir reçu les USDT des dossiers précédents.`,
        },
        {
          id: 'o13', type: 'number', points: 8, tolerance: 0, unit: 'dépôts',
          prompt: 'Combien de dépôts d\'USDT cette adresse de dépôt a-t-elle reçus de l\'adresse de transit ?',
          answer: nUsdtDeposits,
          hint: 'Ouvrez l\'historique de l\'adresse de dépôt : ne comptez que les entrées en USDT venant de l\'adresse de transit (les sorties sont des balayages, et un dépôt est en ETH).',
          explanation: `${nUsdtDeposits} dépôts d'USDT : ${prevDeps}, puis celui qui contient la caution ${de(victimName)}. Un seul compte client, alimenté dossier après dossier : la réquisition doit viser l'ensemble de ces dépôts, qui concernent aussi d'autres victimes (dont celle ${de(earlierCity)}).`,
        },
        {
          id: 'o9', type: 'tx', points: 10,
          prompt: 'Quelle transaction de dépôt des USDT de la victime faut-il citer dans la réquisition ?',
          answer: [dep1.tx.id],
          hint: 'Parmi les dépôts d\'USDT, retenez celui qui suit le transfert de l\'USDT de la victime vers l\'adresse de transit, et dont le montant lui correspond.',
          explanation: `La transaction ${dep1.tx.hash.slice(0, 16)}… du ${fmtDate(dep1.tx.time)} transfère ${amt(usdtDep, 'USDT')} de ${A(w, s2).slice(0, 12)}… vers l'adresse de dépôt : exactement l'USDT arrivé sur l'adresse de transit après la caution. Les deux dépôts précédents, ${prevDeps}, sont antérieurs aux paiements de la victime : ils relèvent des dossiers précédents. On cite ce hash avec sa date et son montant, ainsi que le dépôt d'ETH qui suit (${dep2.tx.hash.slice(0, 12)}…).`,
        },
        {
          id: 'o3', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant d\'USDT ce dépôt a-t-il crédité ?',
          answer: usdtDep,
          hint: 'Ouvrez la transaction de dépôt : le transfert de jeton est indiqué avec son actif (USDT) et son montant.',
          explanation: `${amt(usdtDep, 'USDT')} : la caution ${de(victimName)} (${amt(usdtAmt, 'USDT')}) et les ${amt(otherUsdt, 'USDT')} de l'autre victime. Le montant déposé ne correspond pas toujours au préjudice d'une seule victime.`,
        },
        {
          id: 'o8', type: 'amount', points: 8, unit: 'ETH', tolerance: 0.01,
          prompt: 'Combien d\'ETH l\'escroc a-t-il déposés sur la même adresse de dépôt, juste après ?',
          answer: ethDep,
          hint: 'Même adresse de dépôt, quelques minutes après le dépôt d\'USDT : cette fois en ETH.',
          explanation: `${amt(ethDep, 'ETH')}, quelques minutes après les USDT et sur la même adresse de dépôt : une adresse de dépôt d'exchange reçoit tous les actifs du client (ETH et jetons ERC-20). L'escroc garde ${amt(ethLeft, 'ETH')} sur l'adresse de transit, de quoi payer les frais des prochains dossiers.`,
        },
        {
          id: 'o10', type: 'number', points: 8, unit: 'heures', tolerance: 1.5,
          prompt: 'Combien d\'heures se sont écoulées entre le versement de la caution USDT par la victime et le dépôt des USDT sur l\'exchange ?',
          answer: delayH,
          hint: 'La date de la caution figure dans la plainte et dans le panneau de sa transaction ; comparez-la à la « Date (Paris) » de la transaction de dépôt.',
          explanation: `Caution le ${fmtDate(t2.time)}, dépôt le ${fmtDate(dep1.tx.time)} : environ ${delayH.toLocaleString('fr-FR')} heures. L'escroc encaisse vite, après un seul saut, à un rythme comparable à celui des dossiers précédents (environ ${prevDelays[0]} h et ${prevDelays[1]} h entre caution et dépôt) : la réquisition, assortie d'une demande de blocage, doit partir sans délai. Cette fenêtre indique aussi à la plateforme sur quelle période rechercher les connexions (adresses IP) du titulaire.`,
        },
        {
          id: 'o4', type: 'choice', points: 9,
          prompt: 'Contrairement à Bitcoin, aucune « adresse de rendu » n\'apparaît dans ces transactions. Pourquoi ?',
          ...choice(r,
            'Modèle à comptes : le solde de l\'émetteur est débité, le reste demeure sur la même adresse',
            [
              'Le portefeuille de l\'escroc renvoie automatiquement le rendu vers une adresse cachée',
              'Les transferts d\'USDT ne coûtent pas de frais de réseau, donc pas de rendu',
              'L\'escroc est passé par un mixeur, qui supprime les rendus de ses transactions',
            ]),
          hint: 'Sur Ethereum, une adresse fonctionne comme un compte bancaire.',
          explanation: `Dans le modèle à comptes, il n'y a ni entrées ni sorties à consommer : chaque adresse a un solde par actif. Après le dépôt, ${amt(ethLeft, 'ETH')} restent simplement sur ${A(w, s2)}. Conséquence pratique : sur une adresse réutilisée, les fonds de plusieurs victimes s'additionnent dans un même solde, et c'est l'horodatage et les montants des transferts qui permettent d'isoler le cycle d'une victime.`,
        },
      ],
      truth: {
        path: [t1.id, t2.id, tOther.id, t3.id, t4.id, dep1.tx.id, ...(dep1.sweep ? [dep1.sweep.id] : []), dep2.tx.id, ...(dep2.sweep ? [dep2.sweep.id] : [])],
        addresses: [s1, s2, deposit, other],
        debrief:
          `1. La victime paie ${amt(feeEth, 'ETH')} (ETH natif) puis ${amt(usdtAmt, 'USDT')} (jeton ERC-20) à ${A(w, s1)}, l'adresse fournie par courriel. Une autre victime (${A(w, other)}) y verse ${amt(otherUsdt, 'USDT')} le ${fmtDate(tOther.time)}, avant le transfert suivant.\n` +
          `2. L'escroc envoie d'abord ${amt(ethFwd, 'ETH')} vers l'adresse de transit ${A(w, s2)} (de quoi payer le gas), puis ${amt(usdtHopV, 'USDT')}, tout l'USDT présent.\n` +
          `3. Depuis ${A(w, s2)}, environ ${delayH.toLocaleString('fr-FR')} heures après la caution, il dépose ${amt(usdtDep, 'USDT')} (transaction ${dep1.tx.hash.slice(0, 12)}…) puis ${amt(ethDep, 'ETH')} sur l'adresse de dépôt ${dest.entity.name} ${A(w, deposit)}, balayée ensuite vers le hot wallet.\n` +
          `4. Il reste ${amt(ethLeft, 'ETH')} sur ${A(w, s2)} : pas de rendu, le solde reste sur le compte.\n` +
          `5. Fausses pistes : deux dossiers antérieurs (dont celui ${de(earlierP.name)}, plainte à ${earlierCity}) ont suivi exactement le même cycle, avec leurs propres transferts vers l'adresse de transit et leurs propres dépôts sur la même adresse de dépôt, ${prevDeps}. Ils ne contiennent pas l'argent de la victime, mais renforcent le dossier.\n\n` +
          `À retenir : sur un modèle à comptes, on suit chaque actif séparément (ETH natif, USDT…) et le solde reste sur l'adresse. Un petit envoi d'ETH juste avant un mouvement de jetons trahit l'approvisionnement en gas d'une adresse du même propriétaire. Quand une adresse resert pour plusieurs victimes, on isole le cycle de la sienne par l'horodatage et les montants, et l'on cite précisément le bon dépôt. ${procedureFor(dest.entity)} Ne pas oublier non plus l'émetteur de l'USDT, capable de geler des jetons encore présents sur une adresse, ni les autres victimes, à identifier et à signaler aux services saisis.`,
      },
      hints: [
        'Dépliez les flux sortants de l\'adresse de la victime : chaque arête indique l\'actif transféré (ETH ou USDT).',
        'L\'adresse de l\'escroc sert depuis des semaines : classez ses transferts par date et repérez le cycle qui commence avec les paiements de la victime.',
        'Une adresse qui reçoit des fonds puis les reverse intégralement, en quelques heures, vers un « Hot Wallet » étiqueté est une adresse de dépôt d\'exchange.',
        `Les frais d'un transfert d'USDT se paient en ETH : regardez ce que l'escroc envoie juste avant de déplacer ses jetons.`,
      ],
    }
  },
}
