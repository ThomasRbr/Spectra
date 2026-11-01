import { World, type Tx } from '../engine/world'
import { exchange, HOUR, DAY } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import { lookalike } from '../engine/addressgen'
import type { Entity } from '../engine/entities'
import type { ScenarioTemplate } from './types'
import { A, de, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

/** Paiement en ETH vers une adresse étiquetée d'un commerçant connu. */
/** Premier instant ≥ `after` tombant en journée (entre 9 h et 19 h environ, heure de Paris). */
function daytime(w: World, after: number): number {
  let t = Math.floor(after / DAY) * DAY + w.rng.int(8 * 60, 17 * 60) * 60
  if (t < after) t += DAY
  return t
}

function ethPay(w: World, from: string, shop: Entity, label: string, value: number, time: number): Tx {
  const dst = w.addr('eth', { entity: shop, label: `${shop.name} — ${label}` })
  return w.transfer({ time, from, to: dst, value: roundAsset('ETH', value), asset: 'ETH', autoFund: false })
}

/**
 * Tutoriel 2 : modèle à comptes (Ethereum), USDT ERC-20, adresse de dépôt
 * d'exchange et réquisition. Habillage : empoisonnement d'adresse chez la
 * victime, portefeuille de gas de l'escroc qui a une vie propre (autres
 * campagnes, hébergement du faux site, achat de fichiers de prospects).
 */
export const guideExchange: ScenarioTemplate = {
  id: 'guide-exchange',
  guided: true,
  title: 'Tutoriel 2 : reconnaître un exchange et réquisitionner',
  tagline: 'Pas à pas sur Ethereum : ETH ou USDT, adresse sosie, adresse de dépôt ou hot wallet, et la réquisition qui en découle.',
  description:
    'Mission guidée. Une victime a « investi » des USDT sur une fausse plateforme de placement. Le guide vous fait découvrir le modèle à comptes d\'Ethereum (pas de rendu), la différence entre l\'ETH natif et un jeton ERC-20, le piège de l\'adresse sosie (empoisonnement), les entrées d\'une adresse (autre victime, portefeuille de « gas »), la mécanique dépôt / balayage d\'un exchange, la fiche Entité, la rédaction d\'une réquisition, le gel des USDT restants, et le tri des dépenses du portefeuille personnel de l\'escroc.',
  difficulty: 1,
  chains: ['eth'],
  skills: ['evm', 'tokens', 'exchange_id', 'requisition', 'poisoning'],
  estMinutes: 50,
  lessons: ['comptes-evm', 'tokens-erc20', 'stablecoins', 'exchanges', 'requisitions', 'suivre-flux'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const brand = r.pick(['NovaYield', 'PrimeVest Capital', 'Eurobit Placements', 'Helios Gestion'])
    const advisor = r.pick(['« Thomas, conseiller senior »', '« Victoria, chargée de clientèle »', '« M. Keller, gestionnaire de patrimoine »'])

    const cv = exchange(w, 'coinhouse', 'eth')
    const destKey = r.pick(['binance', 'kraken', 'coinbase'] as const)
    const dest = exchange(w, destKey, 'eth')
    const exName = dest.entity.name
    // Fournisseurs de l'escroc (fictifs) : l'hébergeur du faux site et un revendeur de fichiers de prospects
    const host = w.customEntity({
      name: 'Hostiva', category: 'merchant', known: true,
      description: 'Hébergeur web « offshore » (fictif) payable en crypto, réputé ignorer les signalements d\'abus.',
    })
    const leads = w.customEntity({
      name: 'LeadSphere', category: 'merchant', known: true,
      description: 'Revendeur (fictif) de fichiers de prospects : coordonnées de particuliers « intéressés par les placements », payables en crypto.',
    })

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('eth', { entity: victimE })
    const scamE = w.customEntity({ name: `« ${brand} » (fausse plateforme)`, category: 'suspect' })

    // ── Flux réel ──
    // Historique de la victime : un ancien achat d'ETH (pour les frais), puis l'achat des USDT
    const ethFund = cv.withdraw(victim, roundAsset('ETH', r.float(0.04, 0.12)), w.at(-r.int(40, 120) * 24), 'ETH')
    const usdtAmt = Math.round(r.float(3500, 12000) / 100) * 100
    const usdtBuy = cv.withdraw(victim, usdtAmt + r.int(5, 40), w.at(-r.float(3, 20)), 'USDT')

    // Le versement de la victime vers l'adresse « de dépôt » donnée par la fausse plateforme
    const s1 = w.addr('eth', { entity: scamE })
    const pay = w.transfer({ time: w.at(0), from: victim, to: s1, value: usdtAmt, asset: 'USDT' })

    // Une autre victime (non identifiée) a payé la même adresse quelques jours plus tôt
    const other = w.addr('eth', { entity: w.customEntity({ name: 'Victime non identifiée', category: 'victim' }) })
    const otherUsdt = Math.round(r.float(1500, 5000) / 50) * 50
    w.fundAccount(other, roundAsset('ETH', r.float(0.02, 0.05)), 'ETH', w.at(-r.float(150, 250)))
    w.fundAccount(other, otherUsdt + r.int(0, 30), 'USDT', w.at(-r.float(100, 140)))
    const tOther = w.transfer({ time: w.at(-r.float(48, 90)), from: other, to: s1, value: otherUsdt, asset: 'USDT' })

    // Portefeuille de « gas » de l'escroc : de l'ETH pour payer les frais des transferts d'USDT.
    // Alimenté par un retrait depuis un compte de l'escroc sur une seconde plateforme.
    const gasKey = r.pick((['bitstamp', 'okx', 'kraken', 'coinbase'] as const).filter((k) => k !== destKey))
    const gasEx = exchange(w, gasKey, 'eth')
    const gasExName = gasEx.entity.name
    const gasW = w.addr('eth', { entity: scamE })
    const gasFund = gasEx.withdraw(gasW, roundAsset('ETH', r.float(0.45, 1.2)), w.at(-r.float(25, 35) * 24), 'ETH')
    const gasTx = w.transfer({ time: w.at(r.float(2, 5)), from: gasW, to: s1, value: roundAsset('ETH', r.float(0.008, 0.02)), asset: 'ETH' })

    // Dépôt d'un montant rond sur l'exchange, le reste demeure sur l'adresse (pas de rendu)
    const held = usdtAmt + otherUsdt
    const depAmt = Math.floor((held * r.float(0.75, 0.9)) / 100) * 100
    const depT = w.at(r.float(8, 20))
    const dep = dest.receive(s1, depAmt, depT, { asset: 'USDT', sweepDelayH: r.float(1, 5) })
    const deposit = dep.deposit
    const sweep = dep.sweep!

    // ── Habillage ──
    // 1. Empoisonnement d'adresse : un robot crée un sosie de l'adresse de l'escroc (mêmes premiers
    //    et derniers caractères) et envoie 0,01 USDT à la victime, espérant qu'elle recopie ce sosie
    //    depuis son historique lors d'un prochain versement.
    const fakeS1 = w.addr('eth', { addr: lookalike(r, 'eth', A(w, s1)) })
    const poison = w.transfer({ time: pay.time + r.int(4, 40) * 60, from: fakeS1, to: victim, value: 0.01, asset: 'USDT', tags: ['dust', 'poisoning'], autoFund: false })

    // 2. Vie du portefeuille de gas : il prépare d'autres adresses de collecte (autres campagnes),
    //    paie l'hébergement du faux site et un fichier de prospects, et se fait réalimenter par la même plateforme.
    const campaigns: { addr: string; gas: Tx; usdt: Tx }[] = []
    for (const daysBefore of [r.float(19, 22), r.float(7, 9)]) {
      const c = w.addr('eth', { entity: scamE })
      const gt = w.transfer({ time: w.at(-daysBefore * 24), from: gasW, to: c, value: roundAsset('ETH', r.float(0.008, 0.02)), asset: 'ETH', autoFund: false })
      const v = Math.round(r.float(900, 4500) / 50) * 50
      const sender = w.addr('eth')
      w.fundAccount(sender, v + r.int(0, 25), 'USDT', gt.time + r.float(6, 40) * HOUR)
      const ut = w.transfer({ time: gt.time + r.float(2, 4) * DAY, from: sender, to: c, value: v, asset: 'USDT' })
      campaigns.push({ addr: c, gas: gt, usdt: ut })
    }
    ethPay(w, gasW, host, 'Paiement', r.float(0.03, 0.07), w.at(-r.float(14, 16) * 24))
    ethPay(w, gasW, leads, 'Paiement', r.float(0.05, 0.12), w.at(-r.float(4, 5) * 24))
    const refill = gasEx.withdraw(gasW, roundAsset('ETH', r.float(0.2, 0.5)), dep.tx.time + r.float(10, 20) * HOUR, 'ETH')
    ethPay(w, gasW, host, 'Paiement', r.float(0.03, 0.07), refill.time + r.float(4, 20) * HOUR)

    // Bruit de fond (clients ordinaires des plateformes)
    dest.noise(8, w.at(-3 * 24), w.at(4 * 24), 'USDT')
    dest.noise(6, w.at(-3 * 24), w.at(4 * 24), 'ETH')
    cv.noise(5, w.at(-4 * 24), w.at(3 * 24), 'USDT')
    gasEx.noise(6, w.at(-36 * 24), w.at(2 * 24), 'ETH')

    // ── Réponses, calculées sur le monde final ──
    const received = w.summary(s1).received.USDT ?? 0
    const left = roundAsset('USDT', w.balanceOf(s1, 'USDT'))
    const campaignsHeld = campaigns.reduce((s, c) => s + w.balanceOf(c.addr, 'USDT'), 0)
    const gasOutCount = w.txsOf(gasW).filter((t) => w.flowOut(t, gasW).length).length
    // Délais réels (en heures) : ETH de gas → dépôt, dépôt → second retrait
    const gasGapH = Math.round((dep.tx.time - gasTx.time) / 3600)
    const refillH = Math.round((refill.time - dep.tx.time) / 3600)
    const plainteT = daytime(w, w.at(60))

    return {
      world: w,
      title: `Faux placement « ${brand} » — ${city}`,
      briefing:
        `${victimName} (${city}) a cliqué sur une publicité pour « ${brand} », une plateforme de placement promettant 4 % de rendement mensuel. Un « conseiller », ${advisor}, l'a ${g('guidé', 'guidée')} par téléphone : acheter des USDT sur Coinhouse, puis les envoyer, sur le réseau Ethereum, à « son adresse de dépôt personnelle ». Le tableau de bord affichait des gains… jusqu'au jour où ${g('il', 'elle')} a voulu retirer.\n\n` +
        `Le ${fmtDate(pay.time, false)}, ${g('il', 'elle')} a envoyé ${amt(usdtAmt, 'USDT')}. Votre mission : suivre ces USDT jusqu'à la plateforme réelle où l'escroc les a déposés, identifier l'adresse à réquisitionner, préparer la réquisition et repérer ce qui peut encore être gelé.\n\n` +
        `C'est une **mission guidée** : le guide pas à pas flotte en haut à gauche du graphe. Les étapes se valident d'elles-mêmes ; « Je bloque » donne le chemin exact. Les indices sont gratuits.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteT, author: victimName,
          body:
            `« J'ai acheté des USDT sur Coinhouse et je les ai retirés vers mon portefeuille, celui que j'utilise depuis un moment pour un peu d'ether. Le conseiller m'a fait vérifier trois fois que je choisissais bien le réseau "ERC-20".\n\n` +
            `Le ${fmtDate(pay.time)}, j'ai envoyé ${amt(usdtAmt, 'USDT')} vers l'adresse de dépôt affichée sur le site.\n\n` +
            `Depuis, j'ai remarqué dans mon portefeuille une petite somme reçue d'une adresse qui ressemble à celle du site. Je n'y ai pas touché.\n\n` +
            `Mon adresse Ethereum : ${A(w, victim)} »`,
        },
        {
          id: 'capture', type: 'capture', title: `Capture — page « Dépôt » ${de(brand)}`, date: pay.time - Math.round(r.float(0.5, 2.5) * HOUR),
          body: `${brand} · Alimenter mon compte\nActif : USDT · Réseau : Ethereum (ERC-20)\nVotre adresse de dépôt :\n${A(w, s1)}\nLes fonds sont crédités après 12 confirmations.`,
        },
        {
          id: 'mail', type: 'email', title: `Courriel ${de(brand)} — « Votre retrait est en attente »`, date: plainteT - Math.round(r.float(16, 30) * HOUR), author: `support@${brand.toLowerCase().replace(/[^a-z]/g, '')}.example`,
          body:
            `Cher client,\n\nVotre demande de retrait a bien été enregistrée. Conformément à nos conditions, des frais de déblocage de 15 % doivent être réglés avant le traitement.\n\nMerci d'effectuer ce règlement sur votre adresse de dépôt habituelle, en USDT (ERC-20) uniquement.\n\nService clients ${brand}`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o15', type: 'tx', points: 8,
          prompt: 'Dans l\'historique de la victime, quelle transaction entrante est une tentative d\'empoisonnement d\'adresse, à écarter ?',
          answer: [poison.id],
          hint: 'Cherchez une entrée d\'un centime d\'USDT, arrivée juste après le versement, depuis une adresse qui commence et finit comme celle de la capture.',
          explanation: `La transaction ${poison.hash.slice(0, 16)}… apporte ${amt(0.01, 'USDT')} depuis ${A(w, fakeS1)}, quelques minutes après le versement. Comparez avec l'adresse de la capture, ${A(w, s1)} : mêmes premiers et derniers caractères, milieu différent. C'est un **sosie** fabriqué par un robot qui surveille les gros transferts d'USDT : il espère que la victime recopiera, depuis son historique, cette fausse adresse lors d'un prochain envoi (« address poisoning »). Ce n'est ni l'escroc, ni un remboursement : on le signale dans le rapport, on prévient la victime, et on ne le suit pas.`,
        },
        {
          id: 'o6', type: 'address', points: 8,
          prompt: `Une autre victime a versé des USDT sur la même adresse que ${g('le plaignant', 'la plaignante')}. Quelle est son adresse ?`,
          answer: [other],
          hint: `Dépliez les entrées de l'adresse de l'escroc : un autre expéditeur, non attribué, lui a envoyé des USDT avant ${g('le plaignant', 'la plaignante')}.`,
          explanation: `${A(w, other)} a envoyé ${amt(otherUsdt, 'USDT')} à l'adresse de l'escroc le ${fmtDate(tOther.time)}, quelques jours avant ${victimName}. Même schéma (un montant rond en USDT, sur l'« adresse de dépôt » ${de(brand)}) : c'est très probablement une autre victime, à identifier. Le portefeuille qui envoie de l'ETH, lui, n'est pas une victime : il paie les frais. Son préjudice s'ajoute au dossier et d'autres plaintes existent peut-être ailleurs : on la signale (rapprochement, fichiers d'analyse) et on la cite dans le rapport.`,
        },
        {
          id: 'o7', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.001,
          prompt: 'Combien d\'USDT l\'adresse de l\'escroc a-t-elle reçus au total ?',
          answer: received,
          hint: 'Sélectionnez l\'adresse de l\'escroc et lisez son « Total reçu » : seulement la partie en USDT, pas l\'ETH.',
          explanation: `${amt(received, 'USDT')} : ${amt(usdtAmt, 'USDT')} ${de(victimName)} et ${amt(otherUsdt, 'USDT')} de l'autre victime. Le petit versement d'ETH reçu à côté n'est pas un préjudice : il sert aux frais. Sur un modèle à comptes, on lit les totaux actif par actif, sans jamais additionner des ETH et des USDT.`,
        },
        {
          id: 'o1', type: 'address', points: 12,
          prompt: 'Quelle adresse de dépôt d\'exchange faut-il citer dans la réquisition ?',
          answer: [deposit],
          hint: 'C\'est l\'adresse qui reçoit les USDT de l\'escroc puis les reverse intégralement au hot wallet de la plateforme.',
          explanation: `L'escroc dépose ${amt(depAmt, 'USDT')} sur ${A(w, deposit)}, étiquetée « ${exName} — Adresse de dépôt ». Comme sur Bitcoin, cette adresse est propre à un client : c'est elle qui permet à ${exName} de l'identifier.`,
        },
        {
          id: 'o2', type: 'entity', points: 8,
          prompt: 'Quelle plateforme faut-il requérir ?',
          answer: [destKey],
          hint: 'Le nom figure dans l\'étiquette de l\'adresse de dépôt et dans l\'onglet Entité du panneau d\'analyse.',
          explanation: `${exName}. ${procedureFor(dest.entity)} La « plateforme » ${brand}, elle, n'existe pas : son « adresse de dépôt » est un simple portefeuille de l'escroc.`,
        },
        {
          id: 'o3', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.001,
          prompt: 'Combien d\'USDT ont été déposés sur l\'adresse de dépôt de l\'exchange ?',
          answer: depAmt,
          hint: 'Dans l\'Historique de l\'adresse de dépôt, la ligne entrante indique le montant et l\'actif.',
          explanation: `${amt(depAmt, 'USDT')}, un montant rond. L'adresse de l'escroc avait reçu ${amt(received, 'USDT')} : ${amt(left, 'USDT')} y sont restés, car sur un modèle à comptes il n'y a pas de rendu, le solde demeure simplement sur l'adresse.`,
        },
        {
          id: 'o10', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.005,
          prompt: 'Combien d\'USDT se trouvent encore sur l\'adresse de l\'escroc ?',
          answer: left,
          hint: 'Sélectionnez l\'adresse de l\'escroc et lisez son « Solde actuel », partie USDT.',
          explanation: `${amt(left, 'USDT')} : ${amt(received, 'USDT')} reçus moins ${amt(depAmt, 'USDT')} déposés sur ${exName}. Sur Ethereum, pas de rendu : ce que l'escroc n'a pas envoyé reste sur son adresse. Ce solde n'est pas perdu pour l'enquête : tant qu'il n'a pas bougé, il peut être gelé.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Quelle mesure permet de bloquer rapidement les USDT restés sur l\'adresse de l\'escroc ?',
          ...choice(r,
            'Demander à Tether, l\'émetteur de l\'USDT, de geler l\'adresse, via son portail dédié et en lien avec le magistrat',
            [
              `Demander à ${exName} de geler l'adresse personnelle de l'escroc, qui a déposé chez elle`,
              'Aucune : des jetons détenus sur une adresse personnelle sont hors d\'atteinte de toute mesure',
              'Demander à Coinhouse d\'annuler la vente des USDT, afin qu\'ils lui reviennent automatiquement',
            ]),
          hint: 'L\'USDT est un jeton géré par un smart contract : qui le contrôle ?',
          explanation: `L'USDT est émis par Tether, dont le smart contract permet de geler une adresse : les jetons qu'elle détient ne peuvent plus bouger. ${exName} ne contrôle que les comptes de ses propres clients, pas une adresse personnelle ; Coinhouse ne peut pas annuler une transaction confirmée. Le gel est une mesure conservatoire volontaire de l'émetteur ; la saisie relève ensuite d'une décision judiciaire. C'est l'objet du tutoriel 3.`,
        },
        {
          id: 'o8', type: 'address', points: 8,
          prompt: 'Quelle adresse de l\'escroc fournit l\'ETH nécessaire aux frais (le « gas ») de son adresse de collecte ?',
          answer: [gasW],
          hint: 'Parmi les entrées de l\'adresse de l\'escroc, cherchez le seul versement en ETH, peu avant le dépôt sur l\'exchange.',
          explanation: `${A(w, gasW)} envoie ${amt(gasTx.transfers[0].value, 'ETH')} à l'adresse de collecte le ${fmtDate(gasTx.time)}, environ ${gasGapH} heures avant le dépôt sur ${exName}. Sans ETH, impossible de payer les frais d'un transfert d'USDT : l'escroc « remet du carburant » avant d'encaisser. Ce portefeuille de gas appartient forcément à la même personne : c'est une adresse suspecte de plus, à marquer et à explorer.`,
        },
        {
          id: 'o9', type: 'entity', points: 10,
          prompt: 'Depuis quelle plateforme le portefeuille de gas a-t-il été alimenté en ETH ?',
          answer: [gasKey],
          hint: 'Dépliez les entrées du portefeuille de gas : l\'expéditeur porte l\'étiquette d\'un hot wallet.',
          explanation: `Le ${fmtDate(gasFund.time, false)}, le portefeuille de gas reçoit ${amt(gasFund.transfers[0].value, 'ETH')} depuis le « ${gasExName} — Hot Wallet », puis à nouveau ${amt(refill.transfers[0].value, 'ETH')} le ${fmtDate(refill.time, false)}, environ ${refillH} heures après le dépôt : deux retraits, depuis un compte que l'escroc détient chez ${gasExName}. Seconde piste d'identification, indépendante de la première : on requiert aussi ${gasExName}, en citant ces retraits (hash, date, montant, adresse de destination) pour qu'elle retrouve le compte qui les a ordonnés. ${procedureFor(gasEx.entity)}`,
        },
        {
          id: 'o16', type: 'number', points: 10, unit: 'adresses',
          prompt: 'Outre l\'adresse de collecte de la victime, à combien d\'autres adresses non attribuées le portefeuille de gas a-t-il fourni de l\'ETH ?',
          answer: campaigns.length,
          hint: 'Dépliez les sorties du portefeuille de gas. Écartez les adresses étiquetées (fournisseurs) ; comptez les adresses non attribuées, sans celle de la victime.',
          explanation: `${campaigns.length} : ${campaigns.map((c) => `${A(w, c.addr).slice(0, 10)}… (${fmtDate(c.gas.time, false)})`).join(' et ')}. Le portefeuille de gas fait ${gasOutCount} sorties : deux paiements à l'hébergeur ${host.name} et un achat chez ${leads.name}, revendeur de fichiers de prospects (des fournisseurs de l'escroc, adresses étiquetées), l'ETH de l'adresse de collecte ${de(brand)}, et deux autres petits envois d'ETH vers des adresses non attribuées. Chacune de ces deux adresses a ensuite reçu des USDT d'un inconnu (${campaigns.map((c) => amt(c.usdt.transfers[0].value, 'USDT')).join(', ')}) et les détient encore : ce sont d'autres adresses de collecte, probablement d'autres campagnes ou d'autres « clients ». Elles s'ajoutent à la demande de gel (${amt(campaignsHeld, 'USDT')} au total) et désignent d'autres victimes à rechercher. Les fournisseurs sont des pistes secondaires : ${host.name} héberge probablement le faux site ${de(brand)} (mais un hébergeur offshore répond rarement aux réquisitions), et le fichier acheté chez ${leads.name} explique sans doute comment les victimes ont été ciblées.`,
        },
        {
          id: 'o4', type: 'choice', points: 10,
          prompt: 'Quelles données demander en priorité à la plateforme ?',
          ...choice(r,
            'L\'identité et le KYC du titulaire, ses IP de connexion, ses dépôts et retraits, ses comptes bancaires',
            [
              'La liste de tous les clients ayant reçu des fonds du hot wallet de la plateforme le même jour',
              'La clé privée de l\'adresse de dépôt, afin de restituer directement les USDT à la victime',
              'Le code source du smart contract USDT, pour vérifier l\'authenticité des jetons déposés',
            ]),
          hint: 'Que sait une plateforme régulée de son client ?',
          explanation: 'On demande ce qui identifie et localise le titulaire du compte (pièces d\'identité, selfie de vérification, téléphone, e-mail, adresses IP et appareils de connexion), ce qui retrace l\'argent (historique des dépôts, conversions et retraits, IBAN ou cartes liés) et un blocage conservatoire du compte. Une plateforme ne communique pas de clé privée et n\'a pas à analyser le contrat USDT.',
        },
        {
          id: 'o5', type: 'choice', points: 10,
          prompt: `Le hot wallet ${de(exName)} est-il une bonne cible pour la réquisition ?`,
          ...choice(r,
            'Non : il mêle les fonds de tous les clients ; seule l\'adresse de dépôt désigne un titulaire',
            [
              'Oui : c\'est lui qui détient les fonds au final, il suffit de le citer dans la réquisition',
              'Oui, à condition de demander en plus le gel de la totalité du hot wallet à la plateforme',
              'Non : un hot wallet appartient en général à un mixeur, la plateforme ne pourrait rien dire',
            ]),
          hint: 'Combien de clients alimentent un hot wallet ?',
          explanation: `Le hot wallet ${de(exName)} reçoit les balayages de milliers d'adresses de dépôt : le citer ne désigne aucun client et une demande de gel sur lui serait disproportionnée et sans effet. On vise l'adresse de dépôt, en citant la transaction de dépôt (date, montant, hash).`,
        },
      ],
      truth: {
        path: [pay.id, tOther.id, gasFund.id, gasTx.id, dep.tx.id, sweep.id],
        addresses: [s1, gasW, deposit, other, ...campaigns.map((c) => c.addr)],
        debrief:
          `Ce qui s'est passé :\n\n` +
          `1. ${victimName} envoie ${amt(usdtAmt, 'USDT')} (jeton ERC-20) à ${A(w, s1)}, présentée comme son « adresse de dépôt » ${brand}. Une autre victime (${A(w, other)}) y avait déjà versé ${amt(otherUsdt, 'USDT')} : ${amt(received, 'USDT')} au total.\n` +
          `2. Un portefeuille de l'escroc (${A(w, gasW)}) envoie un peu d'ETH à cette adresse : sans ETH, impossible de payer les frais (le « gas ») d'un transfert d'USDT. Ce portefeuille avait lui-même été alimenté par un retrait depuis ${gasExName}, où l'escroc détient donc un compte, et il sera réalimenté de la même façon après le dépôt.\n` +
          `3. L'escroc dépose ${amt(depAmt, 'USDT')} sur l'adresse de dépôt ${exName} ${A(w, deposit)}, balayée quelques heures plus tard vers le hot wallet. ${amt(left, 'USDT')} restent sur son adresse : pas de rendu sur un modèle à comptes.\n` +
          `4. Le même portefeuille de gas a préparé ${campaigns.length} autres adresses de collecte, qui détiennent ${amt(campaignsHeld, 'USDT')} venus d'inconnus, et paie les fournisseurs de son escroquerie (hébergement chez ${host.name}, fichier de prospects chez ${leads.name}).\n\n` +
          `Les fausses pistes du dossier et comment les écarter :\n\n` +
          `- Le sosie ${A(w, fakeS1).slice(0, 10)}…${A(w, fakeS1).slice(-4)} qui a envoyé 0,01 USDT à la victime : un robot d'empoisonnement d'adresse, pas l'escroc. Seule une comparaison caractère par caractère avec l'adresse de la capture le démasque. On ne le suit pas, mais on prévient la victime de ne jamais recopier une adresse depuis son historique.\n` +
          `- Le portefeuille de gas parmi les entrées de l'adresse de collecte : il envoie de l'ETH, pas des USDT. Ce n'est pas une victime, c'est l'escroc.\n` +
          `- Les sorties du portefeuille de gas vers ${host.name} et ${leads.name} : des achats auprès de fournisseurs, étiquetés, sans lien avec l'encaissement. Les deux adresses non attribuées, elles, sont des adresses de collecte de l'escroc.\n\n` +
          `À retenir :\n\n` +
          `- Ethereum fonctionne par **comptes** : chaque adresse a un solde par actif, débité directement. Pas d'adresse de rendu à chercher.\n` +
          `- L'**ETH** est l'actif natif (il paie les frais) ; l'**USDT** est un jeton géré par un smart contract. Suivez chaque actif séparément, en lisant l'actif indiqué avec chaque montant.\n` +
          `- Une adresse se vérifie **en entier** : les sosies reprennent le début et la fin.\n` +
          `- Les **entrées** d'une adresse suspecte sont aussi parlantes que ses sorties : autres victimes d'un côté, portefeuille de gas (et son origine) de l'autre.\n` +
          `- Une adresse qui reçoit puis reverse tout, rapidement, à un hot wallet étiqueté est une **adresse de dépôt** : c'est elle qu'on réquisitionne. ${procedureFor(dest.entity)}\n` +
          `- Un **retrait** depuis une plateforme vers un portefeuille suspect désigne lui aussi un compte client : ${gasExName} est à requérir sur ces retraits.\n` +
          `- Réquisition : identité et KYC, IP, historique des opérations, moyens de paiement liés, blocage conservatoire. Selon le cadre : art. 77-1-1 (préliminaire), 60-1 (flagrance) ou 99-3 (information judiciaire) du CPP.\n` +
          `- Les USDT restés sur l'adresse de l'escroc et sur ses autres adresses de collecte peuvent faire l'objet d'une demande de gel auprès de l'émetteur (Tether) : c'est l'objet du tutoriel 3.`,
      },
      hints: [
        'Le guide flotte en haut à gauche du graphe. Le bouton « Je bloque » de chaque étape donne le chemin exact.',
        'Sur Ethereum, chaque montant est suivi de son actif (ETH ou USDT) : dans l\'Historique comme sur les flèches du graphe.',
        'Une adresse sosie reprend le début et la fin d\'une adresse connue : comparez toujours l\'adresse en entier.',
        'Une adresse qui reçoit des USDT puis les reverse en totalité, quelques heures après, à un « Hot Wallet » étiqueté est une adresse de dépôt d\'exchange.',
        'Les entrées d\'une adresse (bouton « Entrées ») montrent qui l\'a alimentée : victimes, mais aussi le portefeuille qui lui fournit de l\'ETH pour les frais.',
      ],
      guide: [
        {
          title: 'Ajoutez l\'adresse de la victime',
          text:
            `Ouvrez l'onglet **Pièces**, dépliez la plainte et cliquez l'adresse Ethereum surlignée de la victime : elle s'ajoute au graphe et s'affiche dans le panneau **Analyse** à droite.\n\n` +
            `Différence avec Bitcoin : Ethereum fonctionne par **comptes**, comme un compte bancaire. Chaque adresse a un **solde** par actif, débité directement à chaque envoi. Pas de « pièces » à dépenser, donc **pas de rendu**.`,
          tip: 'Dossier ▸ onglet **Pièces** ▸ « Procès-verbal de plainte » ▸ cliquez l\'adresse surlignée (elle commence par 0x).',
          check: { kind: 'onGraph', address: victim },
        },
        {
          title: 'ETH ou USDT ? Lisez l\'Historique',
          text:
            `Dans le panneau Analyse, onglet **Historique** : chaque montant est suivi de son **actif**. Vous voyez de l'**ETH** (l'actif natif d'Ethereum, qui sert à payer les frais) et de l'**USDT** (un jeton ERC-20 : un « dollar numérique » géré par un smart contract, émis par Tether).\n\n` +
            `Cliquez la ligne **sortante** (flèche rouge) : c'est le versement de la victime. Dans le détail, le transfert est en USDT, mais les **Frais** sont payés en ETH. Un enquêteur suit toujours chaque actif séparément.`,
          tip: 'Panneau Analyse ▸ onglet **Historique** ▸ cliquez la ligne à flèche rouge (montant précédé d\'un signe moins, en USDT). Si le panneau ne montre plus la victime, cliquez son nœud sur le graphe.',
          check: { kind: 'selected', id: pay.id },
        },
        {
          title: 'Un sosie dans l\'historique',
          text:
            `Revenez à la victime et relisez son Historique. Juste après le versement, une **entrée de 0,01 USDT** est arrivée. ${victimName} l'a remarquée : l'adresse expéditrice « ressemble à celle du site ».\n\n` +
            `Cliquez cette ligne et comparez l'expéditeur avec l'adresse de la **capture** (Pièces) : mêmes premiers et derniers caractères, mais le milieu diffère. C'est un **sosie**, fabriqué par un robot qui espère que la victime le recopiera un jour depuis son historique : l'**empoisonnement d'adresse**. À écarter : ce n'est pas l'escroc. Désignez cette transaction dans l'objectif 1.`,
          tip: 'Clic sur la victime ▸ onglet **Historique** ▸ ligne verte « +0,01 USDT » ▸ objectif 1 ▸ « Utiliser la transaction sélectionnée ».',
          check: { kind: 'correct', objective: 'o15' },
        },
        {
          title: 'Dépliez les sorties de la victime',
          text:
            `Revenez à l'adresse de la victime (clic sur son nœud) et **dépliez ses sorties** : double-clic sur le nœud, ou bouton **Sorties**.\n\n` +
            `Sur un modèle à comptes, il n'y a pas de carré de transaction : une **flèche** relie directement l'émetteur au destinataire, avec le montant et l'actif.`,
          tip: 'Double-cliquez le nœud de la victime. Autre chemin : clic droit ▸ « Déplier les sorties ».',
          check: { kind: 'txRevealed', tx: pay.id },
        },
        {
          title: 'Examinez l\'adresse de l\'escroc',
          text:
            `Cliquez l'adresse qui a reçu les USDT. C'est bien celle de la page « Dépôt » ${de(brand)} (vérifiez-la **en entier** avec la capture, cette fois) : une prétendue adresse de dépôt, en réalité un **simple portefeuille** de l'escroc, sans étiquette.\n\n` +
            `Regardez le **Solde actuel** : il reste des USDT dessus. Sur Ethereum, ce qui n'est pas envoyé reste simplement sur l'adresse. Dans l'Historique, notez aussi un petit versement d'**ETH** : il sert à payer les frais des transferts d'USDT.`,
          tip: 'Cliquez le nœud à droite de la victime, au bout de la flèche USDT. Lisez « Solde actuel » et « Total reçu » en haut du panneau.',
          check: { kind: 'selected', id: s1 },
        },
        {
          title: 'Marquez-la Suspect',
          text: `Marquez cette adresse **Suspect**. Elle a reçu les fonds ${de(victimName)}, mais peut-être aussi ceux d'autres personnes : c'est ce que nous allons vérifier.`,
          tip: 'Clic droit sur le nœud ▸ « Marquer : Suspect », ou bouton **Marquer** du panneau ▸ Suspect.',
          check: { kind: 'flagged', address: s1, flag: 'suspect' },
        },
        {
          title: 'Dépliez ses entrées',
          text:
            `Jusqu'ici, on a suivi l'argent vers l'avant (les **sorties**). Pour savoir **qui d'autre** a alimenté l'adresse de l'escroc, dépliez ses **entrées** : bouton **Entrées** du panneau, ou clic droit ▸ « Déplier les entrées ».\n\n` +
            `Plusieurs expéditeurs apparaissent à gauche : la victime, bien sûr, mais aussi une autre adresse qui a envoyé des **USDT** quelques jours plus tôt, et une adresse qui a envoyé un peu d'**ETH**.`,
          tip: 'Sélectionnez l\'adresse marquée Suspect ▸ bouton **Entrées** (flèche verte) du panneau Analyse. Ou clic droit sur le nœud ▸ « Déplier les entrées ».',
          check: { kind: 'txRevealed', tx: tOther.id },
        },
        {
          title: 'Recensez l\'autre victime',
          text:
            `Triez les expéditeurs. Celui qui n'envoie que de l'**ETH** paie les frais : ce n'est pas une victime (nous y reviendrons). L'expéditeur d'**USDT** non attribué, qui a payé un montant rond avant ${victimName}, est très probablement une **autre victime** ${de(brand)}. Marquez-le **Victime** et désignez-le dans l'objectif 2.\n\n` +
            `Réflexe d'enquêteur : une adresse d'escroquerie sert rarement à une seule victime. Recenser les autres permet de chiffrer le préjudice global et de rapprocher des plaintes déposées ailleurs.`,
          tip: `Clic sur le nœud non attribué relié à l'adresse suspecte par une flèche en USDT (pas ${victimName}) ▸ objectif 2 ▸ « Utiliser l'adresse sélectionnée ». Clic droit ▸ « Marquer : Victime ».`,
          check: { kind: 'correct', objective: 'o6' },
        },
        {
          title: 'Chiffrez ce qu\'a reçu l\'escroc',
          text:
            `Sélectionnez l'adresse de l'escroc : la case **Total reçu** indique ce qu'elle a reçu, **actif par actif**. Reportez le total en **USDT** dans l'objectif 3 (sans l'ETH, qui n'est pas un préjudice). Vérifiez : il doit correspondre à la somme des deux versements des victimes.`,
          tip: 'Clic sur l\'adresse marquée Suspect ▸ case « Total reçu » ▸ montant suivi de « USDT ». Saisissez-le sans espace (la virgule est acceptée).',
          check: { kind: 'correct', objective: 'o7' },
        },
        {
          title: 'Trouvez l\'adresse de dépôt',
          text:
            `Dépliez maintenant les **sorties** de l'adresse suspecte (double-clic). Les USDT partent vers une adresse étiquetée **« ${exName} — Adresse de dépôt »**, avec le logo de la plateforme.\n\n` +
            `L'escroc n'a pas tout envoyé : il a déposé un montant rond et gardé le reste.`,
          tip: 'Double-cliquez l\'adresse marquée Suspect (ou clic droit ▸ « Déplier les sorties »).',
          check: { kind: 'onGraph', address: deposit },
        },
        {
          title: 'Observez le balayage',
          text:
            `Dépliez à son tour l'adresse de dépôt : quelques heures plus tard, elle reverse **tout** son solde vers le **« ${exName} — Hot Wallet »**. Ce balayage (sweep) est la signature d'une adresse de dépôt, même quand elle n'est pas étiquetée.\n\n` +
            `Le hot wallet concentre les fonds de milliers de clients : on ne le suit pas, on s'arrête au dépôt.`,
          tip: `Double-cliquez le nœud « ${exName} — Adresse de dépôt ».`,
          check: { kind: 'txRevealed', tx: sweep.id },
        },
        {
          title: 'Ouvrez la fiche Entité et la réquisition',
          text:
            `Sélectionnez l'adresse de dépôt, puis ouvrez l'onglet **Entité** du panneau Analyse. La fiche indique la juridiction ${de(exName)} et sa **voie de coopération**, le contact, le délai de réponse constaté, le niveau de KYC et si un gel est possible.\n\n` +
            `En bas de la fiche, cliquez **« Rédiger une réquisition »** : un modèle se pré-remplit avec l'adresse de dépôt. Choisissez le cadre procédural et cochez la transaction de dépôt à citer.`,
          tip: `Clic sur « ${exName} — Adresse de dépôt » ▸ panneau Analyse ▸ onglet **Entité** ▸ bouton **Rédiger une réquisition**.`,
          check: { kind: 'tool', tool: 'requisition' },
        },
        {
          title: 'Que demander, et à qui ?',
          text:
            `Une bonne réquisition vise **l'adresse de dépôt** (jamais le hot wallet) et cite la transaction de dépôt (date, montant, hash). Elle demande : l'identité et les pièces KYC du titulaire, ses adresses IP et appareils de connexion, l'historique des dépôts, conversions et retraits, les comptes bancaires ou cartes liés, et un **blocage conservatoire** du compte.\n\n` +
            `⚖> Selon le cadre d'enquête : article 77-1-1 (enquête préliminaire, sur autorisation du procureur), 60-1 (flagrance) ou 99-3 (information judiciaire) du code de procédure pénale. Une plateforme établie hors de France peut répondre volontairement via son portail dédié ; à défaut, il faut passer par l'entraide (DEE dans l'UE, entraide internationale ailleurs).`,
          check: { kind: 'manual' },
        },
        {
          title: 'Désignez l\'adresse de dépôt',
          text:
            `Fermez la réquisition. Sélectionnez l'adresse de dépôt sur le graphe, puis cliquez **« Utiliser l'adresse sélectionnée »** dans l'objectif 4. Choisissez ensuite ${exName} dans la liste de l'objectif 5 (groupe « Entités présentes sur votre graphe »).`,
          tip: `Clic sur « ${exName} — Adresse de dépôt » ▸ objectif 4 ▸ « Utiliser l'adresse sélectionnée ». Objectif 5 : menu déroulant ▸ ${exName}.`,
          check: { kind: 'correct', objective: 'o1' },
        },
        {
          title: 'Relevez le montant déposé',
          text: `Dans l'**Historique** de l'adresse de dépôt, la ligne entrante (flèche verte) indique le montant reçu, en USDT. Reportez-le dans l'objectif 6 (la virgule est acceptée).`,
          tip: 'Adresse de dépôt sélectionnée ▸ onglet **Historique** ▸ ligne à flèche verte : « +… USDT ». Saisissez ce nombre sans espace dans l\'objectif 6.',
          check: { kind: 'correct', objective: 'o3' },
        },
        {
          title: 'Ce qui reste sur l\'adresse de l\'escroc',
          text:
            `Revenez à l'adresse de l'escroc et lisez son **Solde actuel** : la partie en USDT correspond à ce qu'il n'a pas déposé. Reportez-la dans l'objectif 7.\n\n` +
            `Contrôle de cohérence : total reçu (objectif 3) − montant déposé (objectif 6) = solde restant. Sur un modèle à comptes, ce calcul tombe juste, puisqu'il n'y a pas de rendu.`,
          tip: 'Clic sur l\'adresse marquée Suspect ▸ case « Solde actuel » ▸ montant suivi de « USDT » (ignorez l\'ETH).',
          check: { kind: 'correct', objective: 'o10' },
        },
        {
          title: 'Ces USDT peuvent-ils être bloqués ?',
          text:
            `Oui, et c'est une spécificité des stablecoins : l'émetteur de l'USDT, **Tether**, peut **geler** une adresse depuis son smart contract. Les jetons qu'elle détient ne peuvent alors plus bouger.\n\n` +
            `Choisissez la bonne mesure dans l'objectif 8. Une plateforme d'échange, elle, ne contrôle que les comptes de ses propres clients.`,
          tip: 'Objectif 8 : cochez la réponse qui s\'adresse à l\'émetteur du jeton.',
          check: { kind: 'answered', objective: 'o11' },
        },
        {
          title: 'Le portefeuille de gas',
          text:
            `Parmi les entrées de l'adresse de l'escroc, une seule est en **ETH** : elle arrive environ ${gasGapH} heures avant le dépôt sur ${exName}. L'escroc « remet du carburant » sur son adresse pour pouvoir déplacer ses USDT.\n\n` +
            `Cette adresse expéditrice est donc la sienne : marquez-la **Suspect** et désignez-la dans l'objectif 9.`,
          tip: 'Repérez la flèche en ETH qui arrive sur l\'adresse marquée Suspect (si elle n\'est pas affichée, dépliez ses entrées) ▸ clic sur son expéditeur ▸ objectif 9 ▸ « Utiliser l\'adresse sélectionnée ».',
          check: { kind: 'correct', objective: 'o8' },
        },
        {
          title: 'D\'où vient l\'ETH ?',
          text:
            `Dépliez les **entrées** du portefeuille de gas. L'ETH vient d'un **« Hot Wallet »** étiqueté, à deux reprises (avant les faits, puis environ ${refillH} heures après le dépôt) : ce sont des **retraits** depuis une plateforme où l'escroc a un compte.\n\n` +
            `Seconde piste d'identification, indépendante de l'adresse de dépôt : cette plateforme aussi peut être requise, en citant les retraits (hash, date, montant, adresse de destination). Renseignez l'objectif 10.`,
          tip: 'Sélectionnez le portefeuille de gas ▸ bouton **Entrées** ▸ lisez l\'étiquette de l\'expéditeur. Objectif 10 : menu déroulant ▸ cette plateforme.',
          check: { kind: 'correct', objective: 'o9' },
        },
        {
          title: 'Triez les sorties du portefeuille de gas',
          text:
            `Ce portefeuille est le portefeuille personnel de l'escroc : il a une vraie vie. Dépliez ses **sorties** (double-clic) et triez-les :\n\n` +
            `- des adresses **étiquetées** (un hébergeur web, un revendeur de fichiers de prospects) : des **fournisseurs** de l'escroc, à noter comme pistes secondaires ;\n` +
            `- l'ETH envoyé à l'adresse de collecte ${de(brand)}, déjà connue ;\n` +
            `- d'autres petits envois d'ETH vers des adresses **non attribuées**. Cliquez-les : chacune a ensuite reçu des USDT d'un inconnu. Ce sont d'autres **adresses de collecte** de l'escroc.\n\n` +
            `Comptez ces autres adresses de collecte et répondez à l'objectif 11.`,
          tip: 'Double-clic sur le portefeuille de gas ▸ ignorez les nœuds étiquetés (Hostiva, LeadSphere) et l\'adresse marquée Suspect ▸ comptez les autres adresses non attribuées.',
          check: { kind: 'correct', objective: 'o16' },
        },
        {
          title: 'Terminez et remettez le rapport',
          text: `Répondez aux objectifs 12 et 13 en vous appuyant sur l'étape « Que demander, et à qui ? », puis cliquez **Remettre le rapport** pour lire le débriefing.`,
          tip: 'Objectifs 12 et 13 : cochez une réponse dans chacun, puis bouton **Remettre le rapport** en bas de l\'onglet Objectifs.',
          check: { kind: 'answered', objective: 'o5' },
        },
      ],
    }
  },
}
