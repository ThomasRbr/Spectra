import { World } from '../engine/world'
import { exchange } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

/**
 * Tutoriel 2 : modèle à comptes (Ethereum), USDT ERC-20, adresse de dépôt
 * d'exchange et réquisition.
 */
export const guideExchange: ScenarioTemplate = {
  id: 'guide-exchange',
  guided: true,
  title: 'Tutoriel 2 : reconnaître un exchange et réquisitionner',
  tagline: 'Pas à pas sur Ethereum : ETH ou USDT, adresse de dépôt ou hot wallet, et la réquisition qui en découle.',
  description:
    'Mission guidée. Une victime a « investi » des USDT sur une fausse plateforme de placement. Le guide vous fait découvrir le modèle à comptes d\'Ethereum (pas de rendu), la différence entre l\'ETH natif et un jeton ERC-20, les entrées d\'une adresse (autre victime, portefeuille de « gas »), la mécanique dépôt / balayage d\'un exchange, la fiche Entité, la rédaction d\'une réquisition et le gel des USDT restants.',
  difficulty: 1,
  chains: ['eth'],
  skills: ['evm', 'tokens', 'exchange_id', 'requisition'],
  estMinutes: 40,
  lessons: ['comptes-evm', 'tokens-erc20', 'stablecoins', 'exchanges', 'requisitions', 'suivre-flux'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const brand = r.pick(['NovaYield', 'PrimeVest Capital', 'Eurobit Placements', 'Helios Gestion'])

    const cv = exchange(w, 'coinhouse', 'eth')
    const destKey = r.pick(['binance', 'kraken', 'coinbase'] as const)
    const dest = exchange(w, destKey, 'eth')
    const exName = dest.entity.name

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('eth', { entity: victimE })
    const scamE = w.customEntity({ name: `« ${brand} » (fausse plateforme)`, category: 'suspect' })

    // Historique de la victime : un ancien achat d'ETH (pour les frais), puis l'achat des USDT
    const ethFund = cv.withdraw(victim, roundAsset('ETH', r.float(0.04, 0.12)), w.at(-r.int(40, 120) * 24), 'ETH')
    const usdtAmt = Math.round(r.float(3500, 12000) / 100) * 100
    cv.withdraw(victim, usdtAmt + r.int(5, 40), w.at(-r.float(3, 20)), 'USDT')

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
    // Il a été alimenté par un retrait depuis un compte de l'escroc sur une seconde plateforme :
    // une piste d'identification indépendante de l'adresse de dépôt.
    const gasKey = r.pick((['bitstamp', 'okx', 'kraken', 'coinbase'] as const).filter((k) => k !== destKey))
    const gasEx = exchange(w, gasKey, 'eth')
    const gasExName = gasEx.entity.name
    const gasW = w.addr('eth', { entity: scamE })
    const gasFund = gasEx.withdraw(gasW, roundAsset('ETH', r.float(0.4, 1.2)), w.at(-r.float(25, 35) * 24), 'ETH')
    const gasTx = w.transfer({ time: w.at(r.float(2, 5)), from: gasW, to: s1, value: roundAsset('ETH', r.float(0.008, 0.02)), asset: 'ETH' })

    // Dépôt d'un montant rond sur l'exchange, le reste demeure sur l'adresse (pas de rendu)
    const held = usdtAmt + otherUsdt
    const depAmt = Math.floor((held * r.float(0.75, 0.9)) / 100) * 100
    const depT = w.at(r.float(8, 20))
    const dep = dest.receive(s1, depAmt, depT, { asset: 'USDT', sweepDelayH: r.float(1, 5) })
    const deposit = dep.deposit
    const sweep = dep.sweep!
    const left = roundAsset('USDT', w.balanceOf(s1, 'USDT'))

    // Bruit de fond (clients ordinaires des deux plateformes)
    dest.noise(8, w.at(-3 * 24), w.at(4 * 24), 'USDT')
    dest.noise(6, w.at(-3 * 24), w.at(4 * 24), 'ETH')
    cv.noise(5, w.at(-4 * 24), w.at(3 * 24), 'USDT')
    gasEx.noise(6, w.at(-36 * 24), w.at(2 * 24), 'ETH')

    return {
      world: w,
      title: `Faux placement « ${brand} » — ${city}`,
      briefing:
        `${victimName} (${city}) a cliqué sur une publicité pour « ${brand} », une plateforme de placement promettant 4 % de rendement mensuel. Un « conseiller » l'a ${g('guidé', 'guidée')} : acheter des USDT sur Coinhouse, puis les envoyer, sur le réseau Ethereum, à « son adresse de dépôt personnelle ». Le tableau de bord affichait des gains… jusqu'au jour où ${g('il', 'elle')} a voulu retirer.\n\n` +
        `Le ${fmtDate(pay.time, false)}, ${g('il', 'elle')} a envoyé ${amt(usdtAmt, 'USDT')}. Votre mission : suivre ces USDT jusqu'à la plateforme réelle où l'escroc les a déposés, identifier l'adresse à réquisitionner et préparer la réquisition.\n\n` +
        `C'est une **mission guidée** : le guide pas à pas se trouve dans l'onglet **Objectifs** du Dossier (à gauche). Les étapes se valident d'elles-mêmes ; « Je bloque » donne le chemin exact. Les indices sont gratuits.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: w.at(3 * 24), author: victimName,
          body:
            `« J'ai acheté des USDT sur Coinhouse et je les ai retirés vers mon portefeuille, celui que j'utilise depuis un moment pour un peu d'ether. Le conseiller m'a fait vérifier trois fois que je choisissais bien le réseau "ERC-20".\n\n` +
            `Le ${fmtDate(pay.time)}, j'ai envoyé ${amt(usdtAmt, 'USDT')} vers l'adresse de dépôt affichée sur le site.\n\n` +
            `Mon adresse Ethereum : ${A(w, victim)} »`,
        },
        {
          id: 'capture', type: 'capture', title: `Capture — page « Dépôt » de ${brand}`, date: w.at(-6),
          body: `${brand} · Alimenter mon compte\nActif : USDT · Réseau : Ethereum (ERC-20)\nVotre adresse de dépôt :\n${A(w, s1)}\nLes fonds sont crédités après 12 confirmations.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o6', type: 'address', points: 8,
          prompt: `Une autre victime a versé des USDT sur la même adresse que ${g('le plaignant', 'la plaignante')}. Quelle est son adresse ?`,
          answer: [other],
          hint: `Dépliez les entrées de l'adresse de l'escroc : un autre expéditeur, non attribué, lui a envoyé des USDT avant ${g('le plaignant', 'la plaignante')}.`,
          explanation: `${A(w, other)} a envoyé ${amt(otherUsdt, 'USDT')} à l'adresse de l'escroc le ${fmtDate(tOther.time)}, quelques jours avant ${victimName}. Même schéma (un montant rond en USDT, sur l'« adresse de dépôt » de ${brand}) : c'est très probablement une autre victime, à identifier. Son préjudice s'ajoute au dossier et d'autres plaintes existent peut-être ailleurs : on la signale (rapprochement, fichiers d'analyse) et on la cite dans le rapport.`,
        },
        {
          id: 'o7', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.001,
          prompt: 'Combien d\'USDT l\'adresse de l\'escroc a-t-elle reçus au total ?',
          answer: held,
          hint: 'Sélectionnez l\'adresse de l\'escroc et lisez son « Total reçu » : seulement la partie en USDT, pas l\'ETH.',
          explanation: `${amt(held, 'USDT')} : ${amt(usdtAmt, 'USDT')} de ${victimName} et ${amt(otherUsdt, 'USDT')} de l'autre victime. Le petit versement d'ETH reçu à côté n'est pas un préjudice : il sert aux frais. Sur un modèle à comptes, on lit les totaux actif par actif, sans jamais additionner des ETH et des USDT.`,
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
          explanation: `${amt(depAmt, 'USDT')}, un montant rond. L'adresse de l'escroc avait reçu ${amt(held, 'USDT')} (${amt(usdtAmt, 'USDT')} de ${victimName} et ${amt(otherUsdt, 'USDT')} d'une autre victime) : ${amt(left, 'USDT')} y sont restés, car sur un modèle à comptes il n'y a pas de rendu, le solde demeure simplement sur l'adresse.`,
        },
        {
          id: 'o10', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.005,
          prompt: 'Combien d\'USDT se trouvent encore sur l\'adresse de l\'escroc ?',
          answer: left,
          hint: 'Sélectionnez l\'adresse de l\'escroc et lisez son « Solde actuel », partie USDT.',
          explanation: `${amt(left, 'USDT')} : ${amt(held, 'USDT')} reçus moins ${amt(depAmt, 'USDT')} déposés sur ${exName}. Sur Ethereum, pas de rendu : ce que l'escroc n'a pas envoyé reste sur son adresse. Ce solde n'est pas perdu pour l'enquête : tant qu'il n'a pas bougé, il peut être gelé.`,
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
          explanation: `${A(w, gasW)} envoie ${amt(gasTx.transfers[0].value, 'ETH')} à l'adresse de collecte le ${fmtDate(gasTx.time)}, quelques heures avant le dépôt sur ${exName}. Sans ETH, impossible de payer les frais d'un transfert d'USDT : l'escroc « remet du carburant » juste avant d'encaisser. Ce portefeuille de gas appartient forcément à la même personne : c'est une adresse suspecte de plus, à marquer et à explorer.`,
        },
        {
          id: 'o9', type: 'entity', points: 10,
          prompt: 'Depuis quelle plateforme le portefeuille de gas a-t-il été alimenté en ETH ?',
          answer: [gasKey],
          hint: 'Dépliez les entrées du portefeuille de gas : l\'expéditeur porte l\'étiquette d\'un hot wallet.',
          explanation: `Le ${fmtDate(gasFund.time, false)}, le portefeuille de gas reçoit ${amt(gasFund.transfers[0].value, 'ETH')} depuis le « ${gasExName} — Hot Wallet » : c'est un retrait, depuis un compte que l'escroc détient chez ${gasExName}. Seconde piste d'identification, indépendante de la première : on requiert aussi ${gasExName}, en citant ce retrait (hash, date, montant, adresse de destination) pour qu'elle retrouve le compte qui l'a ordonné. ${procedureFor(gasEx.entity)}`,
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
          prompt: `Le hot wallet de ${exName} est-il une bonne cible pour la réquisition ?`,
          ...choice(r,
            'Non : il mêle les fonds de tous les clients ; seule l\'adresse de dépôt désigne un titulaire',
            [
              'Oui : c\'est lui qui détient les fonds au final, il suffit de le citer dans la réquisition',
              'Oui, à condition de demander en plus le gel de la totalité du hot wallet à la plateforme',
              'Non : un hot wallet appartient en général à un mixeur, la plateforme ne pourrait rien dire',
            ]),
          hint: 'Combien de clients alimentent un hot wallet ?',
          explanation: `Le hot wallet de ${exName} reçoit les balayages de milliers d'adresses de dépôt : le citer ne désigne aucun client et une demande de gel sur lui serait disproportionnée et sans effet. On vise l'adresse de dépôt, en citant la transaction de dépôt (date, montant, hash).`,
        },
      ],
      truth: {
        path: [pay.id, tOther.id, gasFund.id, gasTx.id, dep.tx.id, sweep.id],
        addresses: [s1, gasW, deposit, other],
        debrief:
          `Ce qui s'est passé :\n\n` +
          `1. ${victimName} envoie ${amt(usdtAmt, 'USDT')} (jeton ERC-20) à ${A(w, s1)}, présentée comme son « adresse de dépôt » ${brand}. Une autre victime (${A(w, other)}) y avait déjà versé ${amt(otherUsdt, 'USDT')} : ${amt(held, 'USDT')} au total.\n` +
          `2. Un portefeuille de l'escroc (${A(w, gasW)}) envoie un peu d'ETH à cette adresse : sans ETH, impossible de payer les frais (le « gas ») d'un transfert d'USDT. Ce portefeuille avait lui-même été alimenté par un retrait depuis ${gasExName}, où l'escroc détient donc un compte.\n` +
          `3. L'escroc dépose ${amt(depAmt, 'USDT')} sur l'adresse de dépôt ${exName} ${A(w, deposit)}, aussitôt balayée vers le hot wallet. ${amt(left, 'USDT')} restent sur son adresse : pas de rendu sur un modèle à comptes.\n\n` +
          `À retenir :\n\n` +
          `- Ethereum fonctionne par **comptes** : chaque adresse a un solde par actif, débité directement. Pas d'adresse de rendu à chercher.\n` +
          `- L'**ETH** est l'actif natif (il paie les frais) ; l'**USDT** est un jeton géré par un smart contract. Suivez chaque actif séparément, en lisant l'actif indiqué avec chaque montant.\n` +
          `- Les **entrées** d'une adresse suspecte sont aussi parlantes que ses sorties : autres victimes d'un côté, portefeuille de gas (et son origine) de l'autre.\n` +
          `- Une adresse qui reçoit puis reverse tout, rapidement, à un hot wallet étiqueté est une **adresse de dépôt** : c'est elle qu'on réquisitionne. ${procedureFor(dest.entity)}\n` +
          `- Un **retrait** depuis une plateforme vers un portefeuille suspect désigne lui aussi un compte client : ${gasExName} est à requérir sur ce retrait.\n` +
          `- Réquisition : identité et KYC, IP, historique des opérations, moyens de paiement liés, blocage conservatoire. Selon le cadre : art. 77-1-1 (préliminaire), 60-1 (flagrance) ou 99-3 (information judiciaire) du CPP.\n` +
          `- Les ${amt(left, 'USDT')} restés sur l'adresse de l'escroc peuvent faire l'objet d'une demande de gel auprès de l'émetteur (Tether) : c'est l'objet du tutoriel 3.`,
      },
      hints: [
        'Le guide est dans l\'onglet Objectifs du Dossier. Le bouton « Je bloque » de chaque étape donne le chemin exact.',
        'Sur Ethereum, chaque montant est suivi de son actif (ETH ou USDT) : dans l\'Historique comme sur les flèches du graphe.',
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
          title: 'Dépliez les sorties de la victime',
          text:
            `Revenez à l'adresse de la victime (clic sur son nœud) et **dépliez ses sorties** : double-clic sur le nœud, ou bouton **Sorties**.\n\n` +
            `Sur un modèle à comptes, il n'y a pas de losange de transaction : une **flèche** relie directement l'émetteur au destinataire, avec le montant et l'actif.`,
          tip: 'Double-cliquez le nœud de la victime. Autre chemin : clic droit ▸ « Déplier les sorties ».',
          check: { kind: 'txRevealed', tx: pay.id },
        },
        {
          title: 'Examinez l\'adresse de l\'escroc',
          text:
            `Cliquez l'adresse qui a reçu les USDT. C'est celle de la page « Dépôt » de ${brand} (voir la capture dans les Pièces) : une prétendue adresse de dépôt, en réalité un **simple portefeuille** de l'escroc, sans étiquette.\n\n` +
            `Regardez le **Solde actuel** : il reste des USDT dessus. Sur Ethereum, ce qui n'est pas envoyé reste simplement sur l'adresse. Dans l'Historique, notez aussi un petit versement d'**ETH** : il sert à payer les frais des transferts d'USDT.`,
          tip: 'Cliquez le nœud à droite de la victime, au bout de la flèche USDT. Lisez « Solde actuel » et « Total reçu » en haut du panneau.',
          check: { kind: 'selected', id: s1 },
        },
        {
          title: 'Marquez-la Suspect',
          text: `Marquez cette adresse **Suspect**. Elle a reçu les fonds de ${victimName}, mais peut-être aussi ceux d'autres personnes : c'est ce que nous allons vérifier.`,
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
            `L'expéditeur d'USDT non attribué, qui a payé un montant rond avant ${victimName}, est très probablement une **autre victime** de ${brand}. Marquez-le **Victime** et désignez-le dans l'objectif 1.\n\n` +
            `Réflexe d'enquêteur : une adresse d'escroquerie sert rarement à une seule victime. Recenser les autres permet de chiffrer le préjudice global et de rapprocher des plaintes déposées ailleurs.`,
          tip: `Clic sur le nœud non attribué relié à l'adresse suspecte par une flèche en USDT (pas ${victimName}) ▸ objectif 1 ▸ « Utiliser l'adresse sélectionnée ». Clic droit ▸ « Marquer : Victime ».`,
          check: { kind: 'correct', objective: 'o6' },
        },
        {
          title: 'Chiffrez ce qu\'a reçu l\'escroc',
          text:
            `Sélectionnez l'adresse de l'escroc : la case **Total reçu** indique ce qu'elle a reçu, **actif par actif**. Reportez le total en **USDT** dans l'objectif 2 (sans l'ETH, qui n'est pas un préjudice). Vérifiez : il doit correspondre à la somme des deux versements des victimes.`,
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
            `Sélectionnez l'adresse de dépôt, puis ouvrez l'onglet **Entité** du panneau Analyse. La fiche indique la juridiction de ${exName} et sa **voie de coopération**, le contact, le délai de réponse constaté, le niveau de KYC et si un gel est possible.\n\n` +
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
            `Fermez la réquisition. Sélectionnez l'adresse de dépôt sur le graphe, puis cliquez **« Utiliser l'adresse sélectionnée »** dans l'objectif 3. Choisissez ensuite ${exName} dans la liste de l'objectif 4 (groupe « Entités présentes sur votre graphe »).`,
          tip: `Clic sur « ${exName} — Adresse de dépôt » ▸ objectif 3 ▸ « Utiliser l'adresse sélectionnée ». Objectif 4 : menu déroulant ▸ ${exName}.`,
          check: { kind: 'correct', objective: 'o1' },
        },
        {
          title: 'Relevez le montant déposé',
          text: `Dans l'**Historique** de l'adresse de dépôt, la ligne entrante (flèche verte) indique le montant reçu, en USDT. Reportez-le dans l'objectif 5 (la virgule est acceptée).`,
          tip: 'Adresse de dépôt sélectionnée ▸ onglet **Historique** ▸ ligne à flèche verte : « +… USDT ». Saisissez ce nombre sans espace dans l\'objectif 5.',
          check: { kind: 'correct', objective: 'o3' },
        },
        {
          title: 'Ce qui reste sur l\'adresse de l\'escroc',
          text:
            `Revenez à l'adresse de l'escroc et lisez son **Solde actuel** : la partie en USDT correspond à ce qu'il n'a pas déposé. Reportez-la dans l'objectif 6.\n\n` +
            `Contrôle de cohérence : total reçu (objectif 2) − montant déposé (objectif 5) = solde restant. Sur un modèle à comptes, ce calcul tombe juste, puisqu'il n'y a pas de rendu.`,
          tip: 'Clic sur l\'adresse marquée Suspect ▸ case « Solde actuel » ▸ montant suivi de « USDT » (ignorez l\'ETH).',
          check: { kind: 'correct', objective: 'o10' },
        },
        {
          title: 'Ces USDT peuvent-ils être bloqués ?',
          text:
            `Oui, et c'est une spécificité des stablecoins : l'émetteur de l'USDT, **Tether**, peut **geler** une adresse depuis son smart contract. Les jetons qu'elle détient ne peuvent alors plus bouger.\n\n` +
            `Choisissez la bonne mesure dans l'objectif 7. Une plateforme d'échange, elle, ne contrôle que les comptes de ses propres clients.`,
          tip: 'Objectif 7 : cochez la réponse qui s\'adresse à l\'émetteur du jeton.',
          check: { kind: 'answered', objective: 'o11' },
        },
        {
          title: 'Le portefeuille de gas',
          text:
            `Parmi les entrées de l'adresse de l'escroc, une seule est en **ETH** : elle arrive quelques heures avant le dépôt sur ${exName}. L'escroc « remet du carburant » sur son adresse pour pouvoir déplacer ses USDT.\n\n` +
            `Cette adresse expéditrice est donc la sienne : marquez-la **Suspect** et désignez-la dans l'objectif 8.`,
          tip: 'Repérez la flèche en ETH qui arrive sur l\'adresse marquée Suspect (si elle n\'est pas affichée, dépliez ses entrées) ▸ clic sur son expéditeur ▸ objectif 8 ▸ « Utiliser l\'adresse sélectionnée ».',
          check: { kind: 'correct', objective: 'o8' },
        },
        {
          title: 'D\'où vient l\'ETH ?',
          text:
            `Dépliez les **entrées** du portefeuille de gas. L'ETH vient d'un **« Hot Wallet »** étiqueté : c'est un **retrait** depuis une plateforme où l'escroc a un compte.\n\n` +
            `Seconde piste d'identification, indépendante de l'adresse de dépôt : cette plateforme aussi peut être requise, en citant le retrait (hash, date, montant, adresse de destination). Renseignez l'objectif 9.`,
          tip: 'Sélectionnez le portefeuille de gas ▸ bouton **Entrées** ▸ lisez l\'étiquette de l\'expéditeur. Objectif 9 : menu déroulant ▸ cette plateforme.',
          check: { kind: 'correct', objective: 'o9' },
        },
        {
          title: 'Terminez et remettez le rapport',
          text: `Répondez aux objectifs 10 et 11 en vous appuyant sur l'étape « Que demander, et à qui ? », puis cliquez **Remettre le rapport** pour lire le débriefing.`,
          tip: 'Objectifs 10 et 11 : cochez une réponse dans chacun, puis bouton **Remettre le rapport** en bas de l\'onglet Objectifs.',
          check: { kind: 'answered', objective: 'o5' },
        },
      ],
    }
  },
}
