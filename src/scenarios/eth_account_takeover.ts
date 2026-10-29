import { World } from '../engine/world'
import { dex, exchange, HOUR, DAY } from '../engine/patterns'
import { lookalike } from '../engine/addressgen'
import { fmtUsd, roundAsset, usd, type AssetId } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fakePhone, fmtDate, procedureFor } from './util'

const MIN = 60

/** « de » élidé devant voyelle : « d'Émilie », « de Marc ». */
function de(name: string): string {
  return /^[AEÉÈIOUYH]/i.test(name) ? `d'${name}` : `de ${name}`
}

function dollars(v: number): string {
  return `${Math.round(v).toLocaleString('fr-FR')} $`
}

function heure(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
}

export const ethAccountTakeover: ScenarioTemplate = {
  id: 'eth-account-takeover',
  title: 'SIM swap : un compte Coinbase vidé',
  tagline: 'Une ligne détournée, un compte réinitialisé, des USDC convertis en ETH puis en Monero… et une erreur de l\'attaquant.',
  description:
    'Un particulier perd soudain le réseau sur son téléphone : sa ligne a été transférée sur une autre carte SIM. Dans la foulée, son compte Coinbase est réinitialisé et vidé vers une adresse neuve. Suivez l\'ETH et les USDC à travers Uniswap jusqu\'au mur Monero, identifiez la commande à réquisitionner chez l\'échangeur et trouvez l\'erreur d\'hygiène opérationnelle qui relie l\'attaquant à un compte identifié.',
  difficulty: 3,
  chains: ['eth', 'xmr'],
  skills: ['evm', 'tokens', 'dex', 'privacy', 'requisition', 'osint'],
  estMinutes: 30,
  lessons: ['comptes-evm', 'dex-defi', 'monero', 'requisitions', 'analyse-comportementale'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victim = fakePerson(r)
    const g = victim.g
    const city = fakeCity(r)
    const phone = fakePhone(r)
    const operator = r.pick(['Telvia Mobile', 'Ondéo Télécom', 'Axéa Mobile'])
    const shopCity = r.pick(['Paris (10e)', 'Saint-Denis', 'Marseille (3e)', 'Créteil', 'Villeurbanne'])
    const leakSite = r.pick(['ModaLine', 'CasaDéco', 'SportiZone', 'TechnoMarché'])

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const cb = exchange(w, 'coinbase', 'eth')
    const uni = dex(w, 'uniswap', 'eth')
    const exKey = r.pick(['binance', 'kraken'] as const)
    const ex = exchange(w, exKey, 'eth')
    const other = exchange(w, exKey === 'binance' ? 'kraken' : 'binance', 'eth')
    const cnE = w.entity('changenow')
    const cnHot = w.addr('eth', { entity: cnE, label: 'ChangeNOW — Hot Wallet ETH', tags: ['liquid', 'hot'] })
    const cnDeposit = () => w.addr('eth', { entity: cnE, label: 'ChangeNOW — Adresse de dépôt', tags: ['deposit'] })
    /** Commande ETH → XMR : dépôt puis rapatriement vers le hot wallet ; le paiement en XMR n'est pas observable. */
    const xmrOrder = (from: string, value: number, time: number, asset: AssetId = 'ETH') => {
      const deposit = cnDeposit()
      const depositTx = w.transfer({ time, from, to: deposit, value, asset })
      const sweepTx = w.transfer({ time: time + r.int(3, 25) * MIN, from: deposit, to: cnHot, value, asset, method: 'sweep', tags: ['sweep'] })
      return { deposit, depositTx, sweepTx }
    }

    const atkE = w.customEntity({ name: 'Auteur du SIM swap (inconnu)', category: 'suspect' })
    const A1 = w.addr('eth', { entity: atkE }) // adresse neuve ajoutée au compte Coinbase
    const A2 = w.addr('eth', { entity: atkE }) // part mise de côté
    const Z = w.addr('eth', { entity: atkE }) // portefeuille personnel de l'attaquant (erreur opsec)

    // ── Historique du portefeuille personnel Z (avant les faits) ─────────────
    const zW1 = ex.withdraw(Z, roundAsset('ETH', r.float(0.4, 1.5)), w.at(-r.int(45, 80) * 24))
    const zSwap = uni.swap({ trader: Z, assetIn: 'ETH', amountIn: roundAsset('ETH', r.float(0.05, 0.15)), assetOut: 'USDT', time: w.at(-r.int(25, 40) * 24) })
    const zW2 = ex.withdraw(Z, roundAsset('ETH', r.float(0.3, 1)), w.at(-r.int(6, 14) * 24))

    // ── L'attaque ────────────────────────────────────────────────────────────
    // En soirée (≈ 22 h – 23 h, heure de Paris)
    const simT = Math.floor(w.t0 / DAY) * DAY + Math.round(r.float(20.2, 21.2) * HOUR)
    const resetT = simT + r.int(8, 15) * MIN
    const loginT = resetT + r.int(2, 5) * MIN
    const addT = loginT + r.int(3, 8) * MIN
    const usdcW = roundAsset('USDC', r.float(15000, 80000))
    const ethW = roundAsset('ETH', r.float(6, 22))
    const lossUsd = usd('ETH', ethW) + usdcW

    const wdUsdc = cb.withdraw(A1, usdcW, addT + r.int(4, 10) * MIN, 'USDC')
    const gasV = roundAsset('ETH', r.float(0.03, 0.08))
    const gasTx = w.transfer({ time: wdUsdc.time + r.int(4, 12) * MIN, from: Z, to: A1, value: gasV, asset: 'ETH' })
    const sw = uni.swap({ trader: A1, assetIn: 'USDC', amountIn: usdcW, assetOut: 'ETH', time: gasTx.time + r.int(3, 10) * MIN })
    const wdEth = cb.withdraw(A1, ethW, sw.tx.time + r.int(8, 25) * MIN, 'ETH')

    // Découpage de l'ETH
    const splitT = wdEth.time + Math.round(r.float(1.5, 3) * HOUR)
    const total = w.balanceOf(A1, 'ETH')
    const cnV = roundAsset('ETH', total * r.float(0.68, 0.76))
    const order = xmrOrder(A1, cnV, splitT)
    const a2V = roundAsset('ETH', total * r.float(0.12, 0.18))
    const a2Tx = w.transfer({ time: splitT + r.int(5, 20) * MIN, from: A1, to: A2, value: a2V, asset: 'ETH' })
    const zV = roundAsset('ETH', total * r.float(0.04, 0.07))
    const zTx = w.transfer({ time: a2Tx.time + r.int(10, 40) * MIN, from: A1, to: Z, value: zV, asset: 'ETH' })
    const left = roundAsset('ETH', w.balanceOf(A1, 'ETH'))

    // Fausse piste : adresse sosie de Z (address poisoning automatisé)
    const poison = w.addr('eth', { addr: lookalike(r, 'eth', A(w, Z), 4, 4) })
    w.fundAccount(poison, 0.004, 'ETH', zTx.time - r.int(2, 8) * DAY)
    w.fundAccount(poison, 1, 'USDC', zTx.time - r.int(2, 8) * DAY)
    const poisonTx = w.transfer({ time: zTx.time + r.int(2, 15) * MIN, from: poison, to: A1, value: 0.01, asset: 'USDC' })

    // Z encaisse sa part chez l'exchange où il a un compte
    const exT = zTx.time + Math.round(r.float(18, 40) * HOUR)
    const exV = roundAsset('ETH', w.balanceOf(Z, 'ETH') * r.float(0.9, 0.97))
    const exDep = ex.receive(Z, exV, exT)

    // ── Bruit de fond ────────────────────────────────────────────────────────
    cb.noise(20, w.at(-3 * 24), w.at(3 * 24), 'ETH')
    cb.noise(12, w.at(-3 * 24), w.at(3 * 24), 'USDC')
    uni.noise(35, w.at(-2 * 24), w.at(2 * 24), [['ETH', 'USDC'], ['ETH', 'USDT'], ['ETH', 'DAI']])
    ex.noise(14, w.at(-3 * 24), w.at(4 * 24), 'ETH')
    other.noise(10, w.at(-3 * 24), w.at(4 * 24), 'ETH')
    // Autres clients de ChangeNOW (dont un dépôt de montant voisin) et paiements ETH du hot wallet
    for (let i = 0; i < r.int(7, 10); i++) {
      const c = w.addr('eth')
      const close = i === 0
      const v = close ? roundAsset('ETH', cnV * r.float(0.9, 1.1)) : roundAsset('ETH', r.float(0.2, 12))
      const t = close ? splitT + r.int(-90, 90) * MIN : splitT + Math.round(r.float(-30, 30) * HOUR)
      w.fundAccount(c, roundAsset('ETH', v + r.float(0.01, 0.05)), 'ETH', t - r.int(2, 72) * HOUR)
      xmrOrder(c, v, t)
    }
    for (let i = 0; i < r.int(8, 12); i++) {
      w.transfer({ time: splitT + Math.round(r.float(-24, 24) * HOUR), from: cnHot, to: w.addr('eth'), value: roundAsset('ETH', r.float(0.1, 9)), asset: 'ETH', method: 'payout' })
    }

    const lossNoticeT = simT + Math.round(r.float(8.5, 10.5) * HOUR)
    const plainteT = simT + Math.round(r.float(1.2, 2.5) * DAY)
    const cbRespT = plainteT + Math.round(r.float(5, 9) * DAY)
    const opRespT = plainteT + Math.round(r.float(3, 6) * DAY)
    const osintT = cbRespT + Math.round(r.float(1, 2) * DAY)
    const ip = `203.0.113.${r.int(10, 250)}`
    const imei = `35${r.int(1000, 9999)}${r.int(1000, 9999)}${r.int(1000, 9999)}${r.int(0, 9)}`
    const zAgeDays = Math.round((simT - zW1.time) / DAY)
    const swapToEth = sw.amountOut

    return {
      world: w,
      title: `SIM swap — compte Coinbase vidé (${city})`,
      briefing:
        `Le ${fmtDate(simT, false)} vers ${heure(simT)}, le téléphone ${de(victim.name)} (${city}) affiche soudain « Aucun service ». ${g('Il', 'Elle')} pense à une panne et se couche. Le lendemain matin, sa messagerie contient des alertes de Coinbase : nouvel appareil, nouvelle adresse de retrait, deux retraits. Son compte, sur lequel ${g('il', 'elle')} détenait ${amt(ethW, 'ETH')} et ${amt(usdcW, 'USDC')}, est vide.\n\n` +
        `L'opérateur ${operator} (nom fictif) confirme que la ligne a été transférée sur une nouvelle carte SIM le soir même : c'est un SIM swap. Avec le numéro, l'attaquant a reçu les codes SMS de réinitialisation et de double authentification du compte de la victime ; Coinbase n'a pas été piraté.\n\n` +
        `Les réponses de Coinbase et de l'opérateur sont arrivées. Suivez les fonds depuis l'adresse de retrait, mesurez ce que l'on peut obtenir au-delà du passage en Monero, et cherchez l'erreur de l'attaquant qui permettrait de l'identifier.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteT, author: victim.name,
          body:
            `« Le soir du ${fmtDate(simT, false)}, mon téléphone (${phone}) n'avait plus de réseau. Je n'ai reçu aucun appel ni SMS suspect, je n'ai donné aucun code à personne. Le lendemain vers ${heure(lossNoticeT)}, j'ai vu les courriels de Coinbase et de ma messagerie : changement de mot de passe, connexion depuis un appareil Android inconnu, ajout d'une adresse de retrait, puis deux retraits.\n\n` +
            `J'avais sur mon compte ${amt(ethW, 'ETH')} et ${amt(usdcW, 'USDC')}, accumulés depuis plusieurs années. La double authentification de mon compte se faisait par SMS. »`,
        },
        {
          id: 'coinbase', type: 'note', title: 'Réponse de Coinbase (portail forces de l\'ordre)', date: cbRespT, author: 'Coinbase — Équipe des demandes des forces de l\'ordre',
          body:
            `Compte : ${victim.name}, ${g('client', 'cliente')} depuis ${new Date((simT - r.int(3, 6) * 365 * DAY) * 1000).getUTCFullYear()}, KYC vérifié. Double authentification : SMS au ${phone}.\n\n` +
            `Journal des événements (heure de Paris) :\n` +
            `• ${fmtDate(resetT)} — réinitialisation du mot de passe, code envoyé par SMS au numéro du compte\n` +
            `• ${fmtDate(loginT)} — connexion depuis un nouvel appareil (Android), IP ${ip} (sortie d'un service VPN commercial d'après nos fournisseurs de données)\n` +
            `• ${fmtDate(addT)} — ajout de l'adresse de retrait ${A(w, A1)}\n` +
            `• ${fmtDate(wdUsdc.time)} — retrait de ${amt(usdcW, 'USDC')} (ERC-20), transaction ${wdUsdc.hash}\n` +
            `• ${fmtDate(wdEth.time)} — retrait de ${amt(ethW, 'ETH')} après contrôle automatique, transaction ${wdEth.hash}\n\n` +
            `Le compte a été verrouillé à la demande du client le ${fmtDate(lossNoticeT + r.int(20, 90) * MIN)}. Les fonds ayant quitté la plateforme vers une adresse externe, aucun gel n'est possible de notre côté.`,
        },
        {
          id: 'operateur', type: 'email', title: `Courriel ${de(operator)} — réponse à réquisition`, date: opRespT, author: `${operator} — Service des obligations légales`,
          body:
            `Objet : ligne ${phone} — changement de carte SIM\n\n` +
            `Le ${fmtDate(simT)}, une nouvelle carte SIM a été activée sur la ligne ${de(victim.name)}, à la suite d'une demande en boutique à ${shopCity}. Le demandeur a présenté une carte d'identité au nom du titulaire ; la copie conservée présente des incohérences (photographie, police de caractères) et paraît falsifiée.\n\n` +
            `La nouvelle SIM a fonctionné dans un terminal Android (IMEI ${imei}) jusqu'au lendemain ${heure(lossNoticeT + 40 * MIN)}, heure de la suspension à la demande du client. Ce même terminal a été associé dans les 30 jours précédents à deux autres lignes, elles aussi concernées par un changement de SIM contesté. Les images de vidéoprotection de la boutique sont conservées 30 jours.`,
        },
        {
          id: 'osint', type: 'osint', title: 'Note OSINT — exposition de la victime et adresses de l\'attaquant', date: osintT, author: 'Cellule d\'appui — analyse numérique',
          body:
            `1. L'adresse e-mail et le numéro ${de(victim.name)} figurent dans la fuite de données du site marchand ${leakSite} (fictif), diffusée sur un forum quelques mois avant les faits. ${g('Il', 'Elle')} a publié sur un réseau social plusieurs messages évoquant son « stack ETH ».\n` +
            `2. Une chaîne Telegram francophone propose des « services opérateur » (changement de SIM sur commande) payables en crypto-actifs.\n` +
            `3. L'adresse de retrait ${A(w, A1)} n'a aucune étiquette et aucun historique avant les faits : c'est une adresse jetable. Aucune autre adresse du dossier n'apparaît dans les bases publiques ou sur les réseaux sociaux.\n\n` +
            `Rappel méthodologique : une adresse jetable n'a pas de passé, un portefeuille personnel en a un (retraits réguliers d'un même exchange, petits swaps, ancienneté). Toute adresse qui « aide » l'adresse jetable mérite qu'on regarde son histoire.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle adresse de retrait l\'attaquant a-t-il ajoutée au compte Coinbase de la victime ?',
          answer: [A1],
          hint: 'Elle figure dans le journal des événements transmis par Coinbase.',
          explanation: `${A(w, A1)}, ajoutée le ${fmtDate(addT)}, ${Math.round((addT - simT) / MIN)} minutes après l'activation de la nouvelle SIM. Elle n'a aucun historique avant les retraits : adresse créée pour l'occasion. Ses seules entrées sont les deux retraits Coinbase, un peu d'ETH venu d'une autre adresse, le swap Uniswap et une poussière d'USDC.`,
        },
        {
          id: 'o2', type: 'amount', points: 15, unit: 'USD', tolerance: 0.02,
          prompt: 'Quel est le montant total détourné, en dollars (au cours de l\'outil) ?',
          answer: lossUsd,
          hint: 'Additionnez la valeur des deux retraits : l\'ETH au cours affiché par l\'outil, l\'USDC à 1 $.',
          explanation: `${amt(ethW, 'ETH')} × 3 185 $ ≈ ${dollars(usd('ETH', ethW))}, plus ${amt(usdcW, 'USDC')} ≈ ${dollars(usdcW)} : environ ${dollars(lossUsd)} au total. Dans le rapport, préciser le cours retenu et sa date : le préjudice en euros dépend du cours au jour des faits.`,
        },
        {
          id: 'o3', type: 'entity', points: 10,
          prompt: 'Sur quel DEX l\'attaquant a-t-il converti les USDC ?',
          answer: ['uniswap'],
          hint: 'Ouvrez la transaction qui fait sortir les USDC de l\'adresse de retrait : vers quel contrat partent-ils ?',
          explanation: `Le ${fmtDate(sw.tx.time)}, ${A(w, A1)} échange ${amt(usdcW, 'USDC')} contre ${amt(swapToEth, 'ETH')} sur Uniswap : les USDC partent vers le pool ETH/USDC, qui renvoie l'ETH via le routeur. Pourquoi si vite ? L'USDC est un jeton centralisé que son émetteur peut geler ; l'ETH natif, lui, ne se gèle pas. Le swap ne rompt pas la piste : la même adresse envoie et reçoit.`,
        },
        {
          id: 'o4', type: 'tx', points: 20,
          prompt: 'L\'essentiel de l\'ETH part vers un échangeur instantané contre du Monero. Quelle transaction de dépôt faut-il citer dans la réquisition à ce service ?',
          answer: [order.depositTx.id],
          hint: 'Suivez la plus grosse sortie d\'ETH de l\'adresse de retrait : une adresse de dépôt aussitôt reversée à un hot wallet étiqueté.',
          explanation:
            `Le ${fmtDate(splitT)}, ${amt(cnV, 'ETH')} (≈ ${fmtUsd(usd('ETH', cnV))}) partent sur ${A(w, order.deposit)}, adresse de dépôt ChangeNOW, balayée ensuite vers son hot wallet. Aucun paiement ChangeNOW en ETH ne correspond : la contrepartie est payée en XMR, invisible. Le mur Monero arrête le suivi, pas l'enquête : avec le hash ${order.depositTx.hash}, l'échangeur peut retrouver la commande (adresse XMR de destination, horodatages, IP, éventuel e-mail). ${procedureFor(cnE)} Attention au leurre : un autre client dépose un montant voisin à la même période, depuis une adresse sans lien avec l'affaire.`,
        },
        {
          id: 'o5', type: 'address', points: 20,
          prompt: 'Quelle adresse trahit l\'attaquant (erreur d\'hygiène opérationnelle) ?',
          answer: [Z],
          hint: 'Avant le swap, l\'adresse de retrait n\'a pas d\'ETH pour payer le gas. Qui lui en envoie, et quelle est l\'histoire de cette adresse ?',
          explanation:
            `Pour payer le gas du swap, il fallait de l'ETH sur ${A(w, A1)}, qui n'en avait pas encore : ${A(w, Z)} lui envoie ${amt(gasV, 'ETH')} le ${fmtDate(gasTx.time)}, ${Math.round((sw.tx.time - gasTx.time) / MIN)} minutes avant le swap. Cette adresse n'a rien de jetable : active depuis ${zAgeDays} jours, alimentée par des retraits ${ex.entity.name} (${amt(zW1.transfers[0].value, 'ETH')} puis ${amt(zW2.transfers[0].value, 'ETH')}), un petit swap ETH → USDT, bref le profil d'un portefeuille personnel. ` +
            `Elle reçoit ensuite ${amt(zV, 'ETH')} du butin et en dépose ${amt(exV, 'ETH')} (sa part et son propre solde) chez ${ex.entity.name}. Le leurre ${A(w, poison)}, qui imite ses premiers et derniers caractères, n'a envoyé que ${amt(0.01, 'USDC')} de poussière (address poisoning automatisé) : il n'a jamais financé l'attaquant.`,
        },
        {
          id: 'o6', type: 'entity', points: 10,
          prompt: 'Quelle plateforme peut identifier le titulaire de cette adresse ?',
          answer: [exKey],
          hint: 'Regardez d\'où viennent les premiers ETH de cette adresse, et où elle dépose sa part.',
          explanation: `${ex.entity.name} a effectué les retraits vers ${A(w, Z)} et reçu son dépôt de ${amt(exV, 'ETH')} sur ${A(w, exDep.deposit)} : son client est identifié (KYC), avec ses IP et appareils de connexion, à comparer avec l'IMEI et les données de l'opérateur. ${procedureFor(ex.entity)} Demander aussi le gel du compte. ${other.entity.name}, présent sur le graphe par ses seuls flux de fond, n'a aucun lien avec l'affaire.`,
        },
        {
          id: 'o7', type: 'choice', points: 15,
          prompt: 'Quelle conclusion porter au rapport ?',
          ...choice(r,
            `Le titulaire du compte ${ex.entity.name} relié à l'adresse qui a payé le gas est un suspect sérieux ; l'attribution reste à corroborer (KYC et IP ${ex.entity.name}, commande ChangeNOW, téléphonie, vidéoprotection)`,
            [
              'Coinbase a été piraté : la plateforme est responsable du détournement et doit être poursuivie',
              'Les fonds sont passés en Monero : plus rien ne peut être établi, le dossier doit être classé',
              `Le titulaire du compte ${ex.entity.name} est l'auteur du SIM swap avec certitude : la blockchain le prouve à elle seule`,
            ]),
          explanation:
            `Le lien on-chain est fort (gas fourni ${Math.round((sw.tx.time - gasTx.time) / MIN)} minutes avant le swap, part du butin reversée, dépôt chez ${ex.entity.name}), mais il désigne le titulaire d'un compte, pas forcément l'auteur des faits : prête-nom, portefeuille partagé ou revendu restent possibles. On le présente comme une hypothèse étayée, à confirmer par les réquisitions, la téléphonie (IMEI ${imei}, autres lignes détournées) et les images de la boutique. Coinbase n'est pas en cause : c'est le compte de la victime qui a été compromis par le détournement de sa ligne.`,
        },
      ],
      truth: {
        path: [zW1.id, zSwap.tx.id, zW2.id, wdUsdc.id, gasTx.id, sw.tx.id, wdEth.id, order.depositTx.id, order.sweepTx.id, a2Tx.id, zTx.id, exDep.tx.id, ...(exDep.sweep ? [exDep.sweep.id] : [])],
        addresses: [A1, Z, A2, order.deposit, exDep.deposit],
        debrief:
          `1. Le ${fmtDate(simT)}, un complice obtient en boutique, avec une fausse carte d'identité, une nouvelle SIM pour la ligne ${de(victim.name)}. La victime, exposée par une fuite de données et ses publications, perd le réseau.\n` +
          `2. Avec les codes SMS, l'attaquant réinitialise le mot de passe Coinbase de la victime, se connecte via un VPN, ajoute ${A(w, A1)} et retire ${amt(usdcW, 'USDC')} puis ${amt(ethW, 'ETH')} (≈ ${fmtUsd(lossUsd)}).\n` +
          `3. Erreur d'hygiène opérationnelle : faute d'ETH pour le gas, il envoie ${amt(gasV, 'ETH')} depuis ${A(w, Z)}, son portefeuille personnel alimenté par ${ex.entity.name}. Il convertit ensuite les USDC en ${amt(swapToEth, 'ETH')} sur Uniswap.\n` +
          `4. Découpage : ${amt(cnV, 'ETH')} chez ChangeNOW contre du XMR (fin du suivi on-chain), ${amt(a2V, 'ETH')} mis de côté sur ${A(w, A2)} (à placer sous surveillance), ${amt(zV, 'ETH')} renvoyés vers ${A(w, Z)}, qui en dépose ${amt(exV, 'ETH')} chez ${ex.entity.name}. Il reste ${amt(left, 'ETH')} sur l'adresse de retrait.\n\n` +
          `À retenir : derrière un mur Monero, on exploite les bords (hash de dépôt réquisitionnable chez l'échangeur) et surtout les erreurs : l'origine du gas d'une adresse jetable est l'un des pivots les plus productifs. Côté prévention, la double authentification par SMS est vulnérable au SIM swap ; une application d'authentification ou une clé de sécurité la remplace avantageusement.`,
      },
      hints: [
        'L\'adresse de retrait figure dans la réponse de Coinbase : ouvrez ses flux entrants. Avant le swap, une entrée d\'ETH ne vient pas de Coinbase.',
        'Un swap USDC → ETH se lit en jambes : USDC du trader vers le pool, ETH du pool vers le routeur puis vers le trader. Suivez ensuite les sorties d\'ETH une par une.',
        'Côté Monero, rien à suivre : le seul fil est le hash du dépôt chez l\'échangeur. Pour identifier l\'auteur, remontez l\'historique de l\'adresse qui a payé le gas.',
      ],
    }
  },
}
