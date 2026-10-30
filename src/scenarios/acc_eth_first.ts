import { World } from '../engine/world'
import { exchange } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

export const accEthFirst: ScenarioTemplate = {
  id: 'eth-first',
  title: 'Du wallet à l\'exchange sur Ethereum',
  tagline: 'Premier traçage sur un modèle à comptes : ETH natif et USDT (ERC-20), sans adresse de rendu.',
  description:
    'Une victime a payé un faux service de « récupération de cryptos » en ETH puis en USDT. Suivez les deux actifs à travers les adresses de l\'escroc jusqu\'à l\'adresse de dépôt d\'un exchange, repérez une seconde victime, datez l\'encaissement et découvrez les spécificités du modèle à comptes (solde par actif, gas payé en ETH).',
  difficulty: 1,
  chains: ['eth'],
  skills: ['lecture_tx', 'evm', 'tokens', 'exchange_id', 'requisition'],
  estMinutes: 30,
  lessons: ['bases-blockchain', 'comptes-evm', 'tokens-erc20', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)

    const cv = exchange(w, 'coinhouse', 'eth')
    const destKey = r.pick(['binance', 'bitstamp', 'okx'] as const)
    const dest = exchange(w, destKey, 'eth')

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('eth', { entity: victimE })
    const suspect = w.customEntity({ name: '« Crypto Recovery Experts » (inconnu)', category: 'suspect' })

    // Historique antérieur de la victime (achats anciens sur Coinhouse)
    cv.withdraw(victim, roundAsset('ETH', r.float(0.05, 0.3)), w.at(-r.int(60, 200) * 24))
    cv.withdraw(victim, roundAsset('ETH', r.float(0.05, 0.2)), w.at(-r.int(20, 50) * 24))

    // Achat des fonds exigés par l'escroc
    const feeEth = roundAsset('ETH', r.float(0.35, 0.9))
    const usdtAmt = Math.round(r.float(4000, 14000) / 100) * 100
    cv.withdraw(victim, roundAsset('ETH', feeEth + r.float(0.01, 0.03)), w.at(-r.float(20, 30)), 'ETH')
    cv.withdraw(victim, usdtAmt + r.int(5, 30), w.at(r.float(18, 22)), 'USDT')

    // Paiements de la victime
    const s1 = w.addr('eth', { entity: suspect })
    const t1 = w.transfer({ time: w.at(0), from: victim, to: s1, value: feeEth, asset: 'ETH' })
    const t2 = w.transfer({ time: w.at(r.float(24, 30)), from: victim, to: s1, value: usdtAmt, asset: 'USDT' })

    // Une autre victime paie la même adresse (escroquerie en série)
    const other = w.addr('eth', { entity: w.customEntity({ name: 'Victime non identifiée', category: 'victim' }) })
    const otherUsdt = Math.round(r.float(1500, 6000) / 50) * 50
    w.fundAccount(other, roundAsset('ETH', r.float(0.02, 0.06)), 'ETH', w.at(-r.float(30, 60)))
    w.fundAccount(other, otherUsdt + r.int(0, 40), 'USDT', w.at(-r.float(10, 20)))
    const tOther = w.transfer({ time: w.at(r.float(-8, 18)), from: other, to: s1, value: otherUsdt, asset: 'USDT' })

    // Saut vers une seconde adresse : d'abord l'ETH (pour le gas), puis l'USDT
    const s2 = w.addr('eth', { entity: suspect })
    const hopT = w.at(r.float(32, 38))
    const ethFwd = roundAsset('ETH', w.balanceOf(s1, 'ETH') * r.float(0.9, 0.97))
    const t3 = w.transfer({ time: hopT, from: s1, to: s2, value: ethFwd, asset: 'ETH' })
    const t4 = w.transfer({ time: hopT + r.int(3, 15) * 60, from: s1, to: s2, value: w.balanceOf(s1, 'USDT'), asset: 'USDT' })

    // Dépôt sur l'exchange (même adresse de dépôt pour l'USDT et l'ETH)
    const depT = w.at(r.float(42, 60))
    const usdtDep = w.balanceOf(s2, 'USDT')
    const dep1 = dest.receive(s2, usdtDep, depT, { asset: 'USDT' })
    const deposit = dep1.deposit
    const ethDep = roundAsset('ETH', w.balanceOf(s2, 'ETH') * r.float(0.6, 0.85))
    const dep2 = dest.receive(s2, ethDep, depT + r.int(5, 40) * 60, { asset: 'ETH', depositAddr: deposit })
    const ethLeft = roundAsset('ETH', w.balanceOf(s2, 'ETH'))

    // Bruit de fond
    dest.noise(16, w.at(-3 * 24), w.at(5 * 24), 'ETH')
    dest.noise(12, w.at(-3 * 24), w.at(5 * 24), 'USDT')
    cv.noise(8, w.at(-4 * 24), w.at(3 * 24), 'ETH')
    cv.noise(6, w.at(-4 * 24), w.at(3 * 24), 'USDT')

    const emailT = w.at(-r.float(2, 6))
    // Délai entre la caution USDT de la victime et le dépôt des USDT sur l'exchange (heures, au dixième)
    const delayH = Math.round((dep1.tx.time - t2.time) / 360) / 10

    return {
      world: w,
      title: `Faux service de récupération — ${city}`,
      briefing:
        `Le ${fmtDate(w.at(4 * 24), false)}, ${victimName} (${city}) dépose plainte. Déjà victime d'une arnaque à l'investissement l'an passé, ${g('il a été contacté', 'elle a été contactée')} par « Crypto Recovery Experts », un prétendu cabinet capable de « récupérer » ses fonds perdus.\n\n` +
        `On lui a d'abord réclamé des « frais d'ouverture de dossier » en ETH, puis une « caution de déblocage » en USDT (réseau Ethereum). Bien sûr, rien n'a jamais été récupéré.\n\n` +
        `Ethereum fonctionne par comptes et non par UTXO : chaque transaction débite directement le solde de l'émetteur. Votre mission : suivre l'ETH et l'USDT jusqu'à la plateforme où ils ont été déposés, identifier l'adresse de dépôt et les transactions à citer dans la réquisition, et repérer les autres victimes éventuelles.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(4 * 24), author: victimName,
          body:
            `« J'ai trouvé ce cabinet après avoir laissé un commentaire sur un forum de victimes. Un certain "Maître Laurent" m'a écrit le jour même.\n\n` +
            `J'ai payé ${amt(feeEth, 'ETH')} de frais de dossier le ${fmtDate(t1.time)}, puis ${amt(usdtAmt, 'USDT')} de caution le ${fmtDate(t2.time)}, depuis mon portefeuille personnel alimenté par Coinhouse.\n\n` +
            `Mon adresse Ethereum : ${A(w, victim)}\n` +
            `Transaction de la caution USDT : ${t2.hash} »`,
        },
        {
          id: 'email', type: 'email', title: 'Courriel de « Crypto Recovery Experts »', date: emailT, author: 'dossiers@crypto-recovery-experts.example',
          body:
            `${g('Monsieur', 'Madame')},\n\nNotre cellule blockchain a localisé vos fonds. Pour ouvrir votre dossier de récupération, merci de régler les frais de traitement (${amt(feeEth, 'ETH')}) sur notre portefeuille sécurisé :\n\n${A(w, s1)}\n\n` +
            `Une caution remboursable vous sera ensuite demandée en USDT (ERC-20 uniquement) sur cette même adresse.\n\nCordialement,\nMaître Laurent — Département Recouvrement`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture — application portefeuille de la victime', date: t2.time,
          body: `Envoyé · USDT (ERC-20)\n-${amt(usdtAmt, 'USDT')}\nÀ : ${A(w, s1)}\nFrais réseau : ${amt(t2.fee, 'ETH')}\nStatut : Confirmé`,
        },
      ],
      seeds: [victim],
      objectives: [
        {
          id: 'o6', type: 'address', points: 8,
          prompt: 'Une autre personne a versé des USDT sur l\'adresse de l\'escroc. Quelle est son adresse ?',
          answer: [other],
          hint: 'Dépliez les flux entrants de l\'adresse indiquée dans le courriel : un expéditeur non attribué, autre que la victime, lui envoie des USDT.',
          explanation: `${A(w, other)} envoie ${amt(otherUsdt, 'USDT')} (montant rond) à l'adresse de l'escroc le ${fmtDate(tOther.time)}. Même mode opératoire : c'est très probablement une autre victime de « Crypto Recovery Experts », à identifier et à rapprocher d'éventuelles plaintes déposées ailleurs. Son versement explique aussi pourquoi le montant déposé sur l'exchange dépasse la caution de ${victimName}.`,
        },
        {
          id: 'o5', type: 'address', points: 10,
          prompt: 'Vers quelle seconde adresse l\'escroc fait-il transiter l\'ETH et l\'USDT ?',
          answer: [s2],
          hint: 'Dépliez les flux sortants de l\'adresse de l\'escroc : deux transferts (un en ETH, un en USDT) partent vers la même adresse, à quelques minutes d\'intervalle.',
          explanation: `${A(w, s2)} reçoit ${amt(ethFwd, 'ETH')} puis, quelques minutes plus tard, tout l'USDT de ${A(w, s1)}. C'est une adresse de transit de l'escroc, non attribuée : elle éloigne les fonds de l'adresse communiquée aux victimes avant le dépôt sur la plateforme.`,
        },
        {
          id: 'o7', type: 'amount', points: 8, unit: 'ETH', tolerance: 0.01,
          prompt: 'Combien d\'ETH l\'escroc envoie-t-il vers cette seconde adresse ?',
          answer: ethFwd,
          hint: 'Sur la flèche entre les deux adresses de l\'escroc, ou dans l\'Historique, repérez le transfert en ETH (pas celui en USDT).',
          explanation: `${amt(ethFwd, 'ETH')}, soit l'essentiel de l'ETH reçu de ${victimName} : l'escroc n'en garde qu'un peu sur sa première adresse, pour les frais du transfert d'USDT qui suit. Sur un modèle à comptes, chaque actif circule par ses propres transferts : on les lit séparément.`,
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
          explanation: `Sur Ethereum, tout transfert, y compris d'un jeton, consomme du « gas » payé en ETH par l'adresse émettrice. Une adresse qui ne détient que des USDT ne peut rien en faire : l'escroc doit d'abord l'approvisionner en ETH. Ce schéma (petit ETH, puis jetons) est un marqueur fréquent d'adresses contrôlées par la même personne. Il n'y a ni conversion ni rendu ici : juste deux transferts d'actifs différents.`,
        },
        {
          id: 'o1', type: 'entity', points: 10,
          prompt: 'Sur quelle plateforme les USDT ont-ils été déposés ?',
          answer: [destKey],
          hint: 'Suivez les transferts sortants de l\'adresse de l\'escroc, actif par actif. Une adresse étiquetée « Adresse de dépôt », ou qui reverse tout à un hot wallet étiqueté, appartient à un exchange.',
          explanation: `Les fonds passent de ${A(w, s1)} à une seconde adresse ${A(w, s2)}, qui les dépose sur ${dest.entity.name}. L'adresse de dépôt est ensuite balayée (sweep) vers le hot wallet de la plateforme.`,
        },
        {
          id: 'o2', type: 'address', points: 12,
          prompt: 'Quelle est l\'adresse de dépôt à mentionner dans la réquisition ?',
          answer: [deposit],
          hint: 'Ce n\'est pas le hot wallet : c\'est l\'adresse qui reçoit les fonds de l\'escroc puis les reverse intégralement au hot wallet.',
          explanation: `Sur Ethereum aussi, l'exchange attribue à chaque client une adresse de dépôt propre. La même adresse sert pour l'ETH et pour tous les jetons ERC-20 : ici elle reçoit ${amt(usdtDep, 'USDT')} puis ${amt(ethDep, 'ETH')}.`,
        },
        {
          id: 'o9', type: 'tx', points: 10,
          prompt: 'Quelle transaction de dépôt des USDT faut-il citer dans la réquisition ?',
          answer: [dep1.tx.id],
          hint: 'Dans l\'Historique de l\'adresse de dépôt, deux lignes entrantes viennent de l\'escroc : prenez celle en USDT.',
          explanation: `La transaction ${dep1.tx.hash.slice(0, 16)}… du ${fmtDate(dep1.tx.time)} transfère ${amt(usdtDep, 'USDT')} de ${A(w, s2).slice(0, 12)}… vers l'adresse de dépôt. On la cite avec son hash, sa date et son montant, ainsi que le dépôt d'ETH qui suit (${dep2.tx.hash.slice(0, 12)}…) : la plateforme retrouve ainsi les deux crédits sur le compte de son client.`,
        },
        {
          id: 'o3', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.01,
          prompt: 'Quel montant d\'USDT a été déposé sur cette adresse ?',
          answer: usdtDep,
          hint: 'Ouvrez la transaction de dépôt : le transfert de jeton est indiqué avec son actif (USDT) et son montant.',
          explanation: `${amt(usdtDep, 'USDT')} : c'est plus que la caution versée par ${victimName} (${amt(usdtAmt, 'USDT')}), car l'adresse de l'escroc a aussi reçu ${amt(otherUsdt, 'USDT')} d'une autre victime. Le montant déposé ne correspond pas toujours au préjudice d'une seule victime.`,
        },
        {
          id: 'o8', type: 'amount', points: 8, unit: 'ETH', tolerance: 0.01,
          prompt: 'Combien d\'ETH l\'escroc a-t-il déposés sur la même adresse de dépôt ?',
          answer: ethDep,
          hint: 'Même adresse de dépôt, seconde ligne entrante : cette fois en ETH.',
          explanation: `${amt(ethDep, 'ETH')}, quelques minutes après les USDT et sur la même adresse de dépôt : sur Ethereum, une adresse de dépôt d'exchange reçoit tous les actifs du client (ETH et jetons ERC-20). L'escroc garde ${amt(ethLeft, 'ETH')} sur sa seconde adresse, de quoi payer de futurs frais.`,
        },
        {
          id: 'o10', type: 'number', points: 8, unit: 'heures', tolerance: 1.5,
          prompt: 'Combien d\'heures se sont écoulées entre le versement de la caution USDT par la victime et le dépôt des USDT sur l\'exchange ?',
          answer: delayH,
          hint: 'La date de la caution figure dans la plainte et dans le panneau de sa transaction ; comparez-la à la « Date (Paris) » de la transaction de dépôt.',
          explanation: `Caution le ${fmtDate(t2.time)}, dépôt le ${fmtDate(dep1.tx.time)} : environ ${delayH.toLocaleString('fr-FR')} heures. L'escroc encaisse vite, après un seul saut : la réquisition, assortie d'une demande de blocage, doit partir sans délai. Cette fenêtre indique aussi à la plateforme sur quelle période rechercher les connexions (adresses IP) du titulaire.`,
        },
        {
          id: 'o4', type: 'choice', points: 10,
          prompt: 'Contrairement à Bitcoin, aucune « adresse de rendu » n\'apparaît dans ces transactions. Pourquoi ?',
          ...choice(r,
            'Modèle à comptes : le solde de l\'émetteur est débité, le reste demeure sur la même adresse',
            [
              'Le portefeuille de l\'escroc renvoie automatiquement le rendu vers une adresse cachée',
              'Les transferts d\'USDT ne coûtent pas de frais de réseau, donc pas de rendu',
              'L\'escroc est passé par un mixeur, qui supprime les rendus de ses transactions',
            ]),
          hint: 'Sur Ethereum, une adresse fonctionne comme un compte bancaire.',
          explanation: `Dans le modèle à comptes, il n'y a ni entrées ni sorties à consommer : chaque adresse a un solde par actif. Après le dépôt, ${amt(ethLeft, 'ETH')} restent simplement sur ${A(w, s2)}. Les jetons (USDT) sont des transferts gérés par un smart contract, distincts des transferts d'ETH natif, mais leurs frais se paient toujours en ETH : c'est pourquoi l'escroc envoie d'abord de l'ETH sur sa seconde adresse.`,
        },
      ],
      truth: {
        path: [t1.id, t2.id, tOther.id, t3.id, t4.id, dep1.tx.id, ...(dep1.sweep ? [dep1.sweep.id] : []), dep2.tx.id, ...(dep2.sweep ? [dep2.sweep.id] : [])],
        addresses: [s1, s2, deposit, other],
        debrief:
          `1. La victime paie ${amt(feeEth, 'ETH')} (ETH natif) puis ${amt(usdtAmt, 'USDT')} (jeton ERC-20) à ${A(w, s1)}, l'adresse fournie par courriel. Une autre victime (${A(w, other)}) y verse ${amt(otherUsdt, 'USDT')}.\n` +
          `2. L'escroc envoie d'abord ${amt(ethFwd, 'ETH')} vers ${A(w, s2)} (de quoi payer le gas), puis la totalité de l'USDT.\n` +
          `3. Depuis ${A(w, s2)}, environ ${delayH.toLocaleString('fr-FR')} heures après la caution, il dépose ${amt(usdtDep, 'USDT')} (transaction ${dep1.tx.hash.slice(0, 12)}…) puis ${amt(ethDep, 'ETH')} sur la même adresse de dépôt ${dest.entity.name} ${A(w, deposit)}, aussitôt balayée vers le hot wallet.\n` +
          `4. Il reste ${amt(ethLeft, 'ETH')} sur ${A(w, s2)} : pas de rendu, le solde reste sur le compte.\n\n` +
          `À retenir : sur un modèle à comptes, on suit chaque actif séparément (ETH natif, USDT…) et le solde reste sur l'adresse. Un petit envoi d'ETH juste avant un mouvement de jetons trahit l'approvisionnement en gas d'une adresse du même propriétaire. Une adresse de dépôt d'exchange sert pour tous les actifs du client : c'est elle qu'on réquisitionne (identité, KYC, IP, retraits, RIB), en citant les transactions de dépôt, avec une demande de gel. ${procedureFor(dest.entity)} Ne pas oublier non plus l'émetteur de l'USDT, capable de geler des jetons encore présents sur une adresse, ni l'autre victime, à identifier.`,
      },
      hints: [
        'Dépliez les flux sortants de l\'adresse de la victime : chaque arête indique l\'actif transféré (ETH ou USDT).',
        'L\'adresse de l\'escroc a reçu des fonds de plusieurs sources : suivez ses sorties, pas seulement le paiement de la victime.',
        'Une adresse qui reçoit des fonds puis les reverse intégralement, en quelques heures, vers un « Hot Wallet » étiqueté est une adresse de dépôt d\'exchange.',
        `Les frais d'un transfert d'USDT se paient en ETH : regardez ce que l'escroc envoie juste avant de déplacer ses jetons.`,
      ],
    }
  },
}
