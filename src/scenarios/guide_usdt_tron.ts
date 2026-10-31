import { World } from '../engine/world'
import { exchange, HOUR } from '../engine/patterns'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

/**
 * Tutoriel 3 : USDT sur Tron, collecteur encore approvisionné, gel par l'émetteur.
 */
export const guideUsdtTron: ScenarioTemplate = {
  id: 'guide-usdt-tron',
  guided: true,
  title: 'Tutoriel 3 : USDT sur Tron et gel des fonds',
  tagline: 'Pas à pas sur Tron : TRX ou USDT, remonter au collecteur, repérer les fonds encore gelables et agir vite.',
  description:
    'Mission guidée. Une victime d\'escroquerie sentimentale à l\'investissement a versé des USDT sur le réseau Tron. Le guide vous apprend à distinguer le TRX de l\'USDT-TRC20, à remonter jusqu\'au portefeuille collecteur, à recenser les autres victimes et le portefeuille « carburant » du réseau, à marquer victime et suspect, à filtrer une période sur la frise chronologique et à saisir l\'occasion d\'un gel par l\'émetteur.',
  difficulty: 1,
  chains: ['tron'],
  skills: ['tron', 'tokens', 'typologies', 'gel', 'exchange_id'],
  estMinutes: 45,
  lessons: ['tron-usdt', 'stablecoins', 'gel-stablecoins', 'typologies', 'exchanges', 'gel-saisie', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const brand = r.pick(['Lumina Trade', 'CoinMarina', 'Orchid Exchange', 'SilkFX Pro'])
    const persona = victimP.female ? r.pick(['« Daniel »', '« Alex »', '« Mike »']) : r.pick(['« Lina »', '« Jessica »', '« Mei »'])

    const cv = exchange(w, 'coinhouse', 'tron')
    const outKey = r.pick(['binance', 'okx', 'kraken'] as const)
    const ex = exchange(w, outKey, 'tron')
    const exName = ex.entity.name
    const tether = w.entity('tether')

    const op = w.customEntity({ name: `Réseau « ${brand} » (opérateurs inconnus)`, category: 'suspect' })
    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('tron', { entity: victimE })

    // Portefeuille « carburant » des opérateurs : du TRX pour payer les frais de leurs adresses
    const gasW = w.addr('tron', { entity: op })
    w.fundAccount(gasW, 30000, 'TRX', w.at(-50 * 24))
    const collector = w.addr('tron', { entity: op })
    const gasToCollector = w.transfer({ time: w.at(-40 * 24), from: gasW, to: collector, value: 800, asset: 'TRX' })

    // La victime : un peu de TRX acheté sur Coinhouse (pour les frais), puis des USDT avant chaque versement
    const trxFund = cv.withdraw(victim, r.int(80, 250), w.at(-r.int(25, 35) * 24), 'TRX')
    const vDep = w.addr('tron', { entity: op })
    w.transfer({ time: w.at(-24 * 24), from: gasW, to: vDep, value: 50, asset: 'TRX' })
    const nPay = 3
    const pays: string[] = []
    const fwds: string[] = []
    let vTotal = 0
    for (let k = 0; k < nPay; k++) {
      const t = w.at(-(20 - k * r.float(4, 6)) * 24)
      const value = Math.round(r.float(1500, 9000) / 100) * 100 * (k + 1 === nPay ? 2 : 1)
      cv.withdraw(victim, value + r.int(2, 30), t - r.int(2, 8) * HOUR, 'USDT')
      pays.push(w.transfer({ time: t, from: victim, to: vDep, value, asset: 'USDT' }).id)
      fwds.push(w.transfer({ time: t + r.int(15, 120) * 60, from: vDep, to: collector, value, asset: 'USDT' }).id)
      vTotal += value
    }

    // D'autres victimes (deux à quatre), chacune avec sa propre « adresse de dépôt » remontant au
    // collecteur ; chaque relais reçoit son TRX du même portefeuille « carburant »
    const nOthers = r.int(2, 4)
    const others: { victim: string; relay: string }[] = []
    const othersPays: string[] = []
    const othersFwds: string[] = []
    let othersTotal = 0
    for (let i = 0; i < nOthers; i++) {
      const oa = w.addr('tron', { entity: w.customEntity({ name: 'Victime non identifiée', category: 'victim' }) })
      const od = w.addr('tron', { entity: op })
      w.transfer({ time: w.at(-(30 - i * 2) * 24), from: gasW, to: od, value: 50, asset: 'TRX' })
      others.push({ victim: oa, relay: od })
      const nP = r.int(1, 2)
      for (let k = 0; k < nP; k++) {
        const t = w.at(-r.float(6, 21) * 24)
        const value = Math.round(r.float(2000, 15000) / 100) * 100
        w.fundAccount(oa, value + r.int(0, 40), 'USDT', t - r.int(1, 5) * HOUR)
        othersPays.push(w.transfer({ time: t, from: oa, to: od, value, asset: 'USDT' }).id)
        othersFwds.push(w.transfer({ time: t + r.int(15, 120) * 60, from: od, to: collector, value, asset: 'USDT' }).id)
        othersTotal += value
      }
    }
    const nVictims = nOthers + 1

    // Décaissement partiel vers un exchange : le reste dort encore sur le collecteur
    const grand = vTotal + othersTotal
    const outAmt = Math.round((grand * r.float(0.25, 0.4)) / 100) * 100
    const outT = w.at(-r.float(20, 40))
    const outRes = ex.receive(collector, outAmt, outT, { asset: 'USDT', sweepDelayH: r.float(1, 4) })
    const exDeposit = outRes.deposit
    const stillHeld = roundAsset('USDT', w.balanceOf(collector, 'USDT'))

    // Bruit de fond
    ex.noise(10, w.at(-12 * 24), w.at(2 * 24), 'USDT')
    cv.noise(6, w.at(-30 * 24), w.at(0), 'USDT')

    const handle = fakeHandle(r)
    const plainteT = w.at(-r.float(3, 8))
    // Délai entre le dernier décaissement du collecteur et la plainte (en heures, au dixième)
    const sinceOutH = Math.round((plainteT - outRes.tx.time) / 360) / 10

    return {
      world: w,
      title: `Romance et faux trading « ${brand} » — ${city}`,
      briefing:
        `${victimName} (${city}) a fait la connaissance de ${persona} sur un réseau social. Après des semaines d'échanges quotidiens, ${persona} lui a présenté « ${brand} », une plateforme de trading où ${g('il', 'elle')} aurait multiplié ses gains. ${victimName} a versé des USDT à trois reprises, sur le réseau Tron, vers son « adresse de dépôt personnelle ». Pour retirer, on lui réclame maintenant une « taxe » de 20 %.\n\n` +
        `${g('Il', 'Elle')} dépose plainte aujourd'hui, ${fmtDate(plainteT)}. Votre mission : suivre les USDT jusqu'au portefeuille qui centralise l'argent des victimes, mesurer ce qui s'y trouve encore et décider des actions urgentes.\n\n` +
        `C'est une **mission guidée** : le guide pas à pas flotte en haut à gauche du graphe. Les étapes se valident d'elles-mêmes ; « Je bloque » donne le chemin exact. Les indices sont gratuits.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteT, author: victimName,
          body:
            `« J'ai acheté des USDT sur Coinhouse, en choisissant le réseau "TRC20" comme on me l'avait dit, et je les ai envoyés depuis mon portefeuille. J'ai fait trois versements, le dernier, le plus gros, le ${fmtDate(w.tx(pays[nPay - 1]).time, false)}. Au total : ${amt(vTotal, 'USDT')}.\n\n` +
            `Mon adresse Tron : ${A(w, victim)} »`,
        },
        {
          id: 'capture', type: 'capture', title: `Capture — page « Dépôt » de ${brand}`, date: w.tx(pays[0]).time - 3600,
          body: `${brand} · Dépôt\nActif : USDT · Réseau : TRC20 uniquement\nVotre adresse de dépôt personnelle :\n${A(w, vDep)}\n⚠️ Tout dépôt sur un autre réseau sera définitivement perdu.`,
        },
        {
          id: 'chat', type: 'telegram', title: `Conversation avec ${persona}`, author: `@${handle}`, date: plainteT - 2 * 86400,
          body: `${persona.replace(/[«»]/g, '').trim()} : Ton portefeuille ${brand} est à +280 %, je suis tellement ${victimP.female ? 'fier' : 'fière'} de toi\n${persona.replace(/[«»]/g, '').trim()} : Pour débloquer le retrait il faut d'abord régler la taxe de 20 %, c'est la règle\n${persona.replace(/[«»]/g, '').trim()} : Envoie sur la même adresse, le support valide en 24 h`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse du portefeuille collecteur du réseau ?',
          answer: [collector],
          hint: 'Suivez les USDT reçus par l\'« adresse de dépôt » de la plateforme : vers où repartent-ils ?',
          explanation: `L'« adresse de dépôt ${brand} » de la victime n'est qu'une adresse de passage : chaque versement est reversé en moins de deux heures vers ${A(w, collector)}, qui reçoit aussi l'argent d'autres victimes par leurs propres adresses de passage.`,
        },
        {
          id: 'o6', type: 'number', points: 10, unit: 'victimes', tolerance: 0,
          prompt: `Combien de victimes distinctes, ${g('plaignant compris', 'plaignante comprise')}, ont alimenté le collecteur ?`,
          answer: nVictims,
          hint: 'Dépliez les entrées du collecteur : chaque adresse relais qui lui envoie des USDT correspond à une victime. Remontez les entrées de chaque relais pour vérifier.',
          explanation: `${nVictims} victimes : ${victimName} et ${nOthers} autres personnes non identifiées. Chacune a reçu de ${brand} sa propre « adresse de dépôt » (un relais), et chaque relais reverse tout au collecteur. On compte des victimes (les expéditeurs des relais), pas des transactions : certaines ont payé plusieurs fois. Le portefeuille qui envoie du TRX au collecteur n'est pas une victime : il appartient au réseau. Ces victimes inconnues sont à identifier (rapprochement avec d'autres plaintes, réquisitions sur l'origine de leurs fonds).`,
        },
        {
          id: 'o7', type: 'amount', points: 8, unit: 'USDT', tolerance: 0.005,
          prompt: 'Combien d\'USDT le collecteur a-t-il reçus au total ?',
          answer: grand,
          hint: 'Sélectionnez le collecteur et lisez son « Total reçu », partie USDT uniquement.',
          explanation: `${amt(grand, 'USDT')} : ${amt(vTotal, 'USDT')} venant de ${victimName} et ${amt(othersTotal, 'USDT')} venant des ${nOthers} autres victimes. C'est le préjudice minimal visible on-chain pour l'ensemble du réseau, à reporter dans le rapport (le TRX reçu, lui, n'est que du carburant).`,
        },
        {
          id: 'o8', type: 'address', points: 8,
          prompt: 'Quelle adresse approvisionne en TRX le collecteur et les adresses relais ?',
          answer: [gasW],
          hint: 'Parmi les entrées du collecteur, cherchez celle en TRX (pas en USDT) ; vérifiez qu\'elle alimente aussi les relais.',
          explanation: `${A(w, gasW)} envoie ${amt(gasToCollector.transfers[0].value, 'TRX')} au collecteur le ${fmtDate(gasToCollector.time, false)} et 50 TRX à chaque relais, avant leurs premiers versements. Sur Tron, il faut du TRX (ou de l'énergie) pour transférer de l'USDT : ce portefeuille « carburant » est l'outil des opérateurs. Il rattache tous les relais au même réseau et constitue une piste à part entière (d'où vient son propre TRX ?).`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: 'Qu\'est-ce qui permet de rattacher les adresses relais au même réseau que le collecteur ?',
          ...choice(r,
            'Elles reversent chaque versement au collecteur dans l\'heure et reçoivent leur TRX du même portefeuille carburant',
            [
              'Elles portent toutes l\'étiquette « Adresse de dépôt » d\'un exchange connu de la base',
              'Elles ont été créées le même jour, ce qui suffit à établir un propriétaire commun',
              'Elles appartiennent aux victimes, qui les ont créées elles-mêmes sur le site de la plateforme',
            ]),
          hint: 'Regardez d\'où vient le TRX des relais et où partent leurs USDT.',
          explanation: `Deux faits concordants : chaque relais vide ses USDT vers le même collecteur en moins de deux heures, et chacun a reçu 50 TRX du même portefeuille ${A(w, gasW).slice(0, 10)}… avant son premier versement. Aucun de ces relais n'est étiqueté : ce ne sont pas des adresses d'exchange, mais des adresses générées par les escrocs pour chaque « client ». Une date de création commune serait, seule, un indice bien trop faible.`,
        },
        {
          id: 'o2', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.005,
          prompt: 'Combien d\'USDT se trouvent encore sur le collecteur ?',
          answer: stillHeld,
          hint: 'Sélectionnez le collecteur et lisez son « Solde actuel » (uniquement la partie en USDT, pas le TRX).',
          explanation: `${amt(stillHeld, 'USDT')} dorment encore sur le collecteur : le réseau n'a décaissé que ${amt(outAmt, 'USDT')} vers ${exName}. Ce solde est gelable par l'émetteur de l'USDT tant qu'il n'a pas bougé.`,
        },
        {
          id: 'o4', type: 'entity', points: 8,
          prompt: 'Sur quelle plateforme une partie des fonds a-t-elle déjà été encaissée ?',
          answer: [outKey],
          hint: 'Dépliez les sorties du collecteur : une adresse porte une étiquette « Adresse de dépôt ».',
          explanation: `${amt(outAmt, 'USDT')} ont été déposés sur une adresse de dépôt ${exName}, puis balayés vers son hot wallet. ${procedureFor(ex.entity)} On y demande l'identité du titulaire et un blocage conservatoire du compte.`,
        },
        {
          id: 'o9', type: 'tx', points: 8,
          prompt: 'Quelle transaction a envoyé des USDT du collecteur vers la plateforme d\'encaissement ? (à citer dans la réquisition)',
          answer: [outRes.tx.id],
          hint: 'Sélectionnez la flèche (ou la ligne d\'Historique) qui relie le collecteur à l\'adresse de dépôt de la plateforme.',
          explanation: `La transaction ${outRes.tx.hash.slice(0, 16)}… du ${fmtDate(outRes.tx.time)} transfère ${amt(outAmt, 'USDT')} du collecteur vers ${A(w, exDeposit)}, adresse de dépôt de ${exName}. La réquisition cite cette adresse de dépôt et cette transaction (hash, date, montant) : la plateforme retrouve ainsi le compte crédité et peut le bloquer.`,
        },
        {
          id: 'o10', type: 'number', points: 8, unit: 'heures', tolerance: 2,
          prompt: 'Combien d\'heures se sont écoulées entre ce décaissement et le dépôt de plainte ?',
          answer: sinceOutH,
          hint: 'La date de la plainte figure dans le procès-verbal ; celle du décaissement dans le panneau de la transaction (« Date (Paris) ») ou sur la frise.',
          explanation: `Décaissement le ${fmtDate(outRes.tx.time)}, plainte le ${fmtDate(plainteT)} : environ ${sinceOutH.toLocaleString('fr-FR')} heures. Le réseau encaisse par tranches et vient tout juste d'en sortir une : le solde restant peut partir à tout moment. C'est ce qui justifie une demande de gel immédiate, avant même la réquisition de la plateforme.`,
        },
        {
          id: 'o3', type: 'entity', points: 10,
          prompt: 'À quelle entité demander le gel des USDT encore présents sur le collecteur ?',
          answer: ['tether'],
          hint: 'Qui émet l\'USDT ? Cherchez la catégorie « Émetteur de stablecoin » dans la liste.',
          explanation: `${tether.name}, l'émetteur de l'USDT, peut geler (« blacklister ») une adresse : les jetons qu'elle détient ne peuvent plus bouger. La demande, motivée, passe par son portail dédié aux forces de l'ordre ; la saisie des fonds relève ensuite d'une décision judiciaire.`,
        },
        {
          id: 'o5', type: 'choice', points: 12,
          prompt: 'Quelles actions engager en priorité ?',
          ...choice(r,
            'Demander sans attendre à Tether le gel des USDT du collecteur, puis requérir la plateforme de sortie',
            [
              'Attendre que le collecteur envoie le reste vers un exchange, pour tout requérir en une seule fois',
              'Demander à Tether de geler l\'adresse de la victime, afin d\'empêcher tout nouveau versement',
              'Requérir d\'abord Coinhouse, qui a vendu les USDT à la victime avant chacun de ses versements',
            ]),
          hint: 'Qu\'est-ce qui peut disparaître le plus vite ?',
          explanation: `Le gel est une course contre la montre : le collecteur peut se vider en une transaction, à toute heure. Demande de gel à ${tether.name} d'abord (quelques heures à quelques jours), réquisition de ${exName} sur l'adresse de dépôt ensuite, pour identifier qui encaisse. Geler l'adresse de la victime ne protège rien ; Coinhouse ne peut que confirmer ses achats.`,
        },
      ],
      truth: {
        path: [...pays, ...fwds, ...othersPays, ...othersFwds, outRes.tx.id, ...(outRes.sweep ? [outRes.sweep.id] : [])],
        addresses: [vDep, collector, gasW, exDeposit, ...others.map((o) => o.relay)],
        debrief:
          `Ce qui s'est passé :\n\n` +
          `1. ${victimName} achète des USDT sur Coinhouse (réseau Tron) et les envoie en trois fois, ${amt(vTotal, 'USDT')} au total, à son « adresse de dépôt » ${brand} ${A(w, vDep)}.\n` +
          `2. Cette adresse n'est qu'un relais : chaque versement repart dans l'heure vers le collecteur ${A(w, collector)}. ${nOthers} autres victimes alimentent le même collecteur par leurs propres relais (${amt(othersTotal, 'USDT')}) : ${nVictims} victimes et ${amt(grand, 'USDT')} au total.\n` +
          `3. Un portefeuille « carburant » des opérateurs (${A(w, gasW)}) envoie du TRX aux relais et au collecteur : sans TRX (ou énergie), impossible de payer les frais d'un transfert d'USDT sur Tron. C'est lui qui rattache tous les relais au réseau.\n` +
          `4. Le réseau a déjà encaissé ${amt(outAmt, 'USDT')} sur ${exName} (transaction ${outRes.tx.hash.slice(0, 12)}…), environ ${sinceOutH.toLocaleString('fr-FR')} heures avant la plainte ; ${amt(stillHeld, 'USDT')} restent sur le collecteur.\n\n` +
          `À retenir :\n\n` +
          `- Sur Tron, le **TRX** est l'actif natif (frais), l'**USDT-TRC20** est un jeton émis par Tether. C'est le réseau le plus utilisé pour l'USDT dans les escroqueries.\n` +
          `- Les escroqueries sentimentales à l'investissement donnent à chaque victime une « adresse de dépôt » qui remonte à un **collecteur** commun : ses entrées révèlent les autres victimes, qu'on compte par expéditeur et non par transaction.\n` +
          `- Le portefeuille qui fournit le **carburant** (TRX) signe l'appartenance des relais au même réseau.\n` +
          `- Des USDT encore présents sur une adresse peuvent être **gelés par l'émetteur** : c'est la priorité absolue, avant même la réquisition de l'exchange.\n` +
          `- La frise chronologique aide à dater les mouvements et à mesurer l'urgence : ici, le dernier décaissement date de quelques heures à peine avant la plainte.`,
      },
      hints: [
        'Le guide flotte en haut à gauche du graphe. Le bouton « Je bloque » de chaque étape donne le chemin exact.',
        'Sur Tron, chaque montant indique son actif : TRX (actif natif, sert aux frais) ou USDT (jeton TRC-20). Suivez les USDT.',
        'Le « Solde actuel » d\'une adresse, en haut du panneau d\'analyse, montre ce qu\'elle détient encore : des USDT encore là sont gelables par l\'émetteur.',
        'Les entrées du collecteur (bouton « Entrées ») montrent tous les relais qui l\'alimentent : un relais = une victime, à confirmer en dépliant ses propres entrées.',
      ],
      guide: [
        {
          title: 'Ajoutez l\'adresse de la victime',
          text:
            `Onglet **Pièces** ▸ plainte : cliquez l'adresse Tron surlignée de la victime (elle commence par T). Elle s'ajoute au graphe et s'affiche dans le panneau **Analyse**.\n\n` +
            `Tron fonctionne, comme Ethereum, par **comptes** : chaque adresse a un solde par actif, et il n'y a pas de rendu.`,
          tip: 'Dossier ▸ onglet **Pièces** ▸ « Procès-verbal de plainte » ▸ cliquez l\'adresse surlignée.',
          check: { kind: 'onGraph', address: victim },
        },
        {
          title: 'TRX ou USDT ? Lisez l\'Historique',
          text:
            `Onglet **Historique** du panneau : les montants sont suivis de leur actif. Le **TRX** est l'actif natif de Tron : il sert à payer les frais (sous forme d'« énergie » et de « bande passante »). L'**USDT** est un jeton **TRC-20**, émis par la société Tether.\n\n` +
            `Cliquez la ligne **entrante en TRX** venant de « Coinhouse — Hot Wallet » : la victime a d'abord acheté un peu de TRX, juste pour pouvoir payer les frais de ses envois d'USDT.`,
          tip: 'Panneau Analyse ▸ onglet **Historique** ▸ filtre « Entrantes » si besoin ▸ cliquez la ligne verte dont le montant est en TRX (la plus ancienne, tout en bas).',
          check: { kind: 'selected', id: trxFund.id },
        },
        {
          title: 'Marquez la victime',
          text:
            `Revenez à l'adresse de la victime (clic sur son nœud) et marquez-la **Victime**. Sur un graphe qui grandit, ce marquage vert évite de confondre la victime avec les autres adresses, et il sera repris dans le rapport.`,
          tip: 'Clic droit sur le nœud de la victime ▸ « Marquer : Victime ». Ou bouton **Marquer** du panneau ▸ Victime.',
          check: { kind: 'flagged', address: victim, flag: 'victim' },
        },
        {
          title: 'Dépliez ses versements',
          text:
            `Dépliez les **sorties** de la victime (double-clic sur son nœud). Ses trois versements d'USDT partent vers une même adresse : son « adresse de dépôt » ${brand}, celle de la capture d'écran.\n\n` +
            `Cette adresse n'a pas d'étiquette : ce n'est pas une vraie plateforme, juste un portefeuille contrôlé par les escrocs.`,
          tip: 'Double-cliquez le nœud de la victime (ou clic droit ▸ « Déplier les sorties »). Une seule flèche apparaît : elle regroupe les trois versements.',
          check: { kind: 'txRevealed', tx: pays[0] },
        },
        {
          title: 'Remontez jusqu\'au collecteur',
          text:
            `Dépliez les sorties de cette « adresse de dépôt » (double-clic). Chaque versement repart en moins de deux heures vers une **autre adresse** : c'est le **collecteur**, le portefeuille qui centralise l'argent des victimes.\n\n` +
            `Les fausses plateformes donnent une adresse différente à chaque victime, mais tout remonte au même endroit.`,
          tip: 'Double-cliquez l\'adresse située à droite de la victime. Appuyez sur L pour réorganiser le graphe si besoin.',
          check: { kind: 'onGraph', address: collector },
        },
        {
          title: 'Marquez le collecteur et lisez son solde',
          text:
            `Sélectionnez le collecteur et marquez-le **Suspect**. Regardez son **Solde actuel**, en haut du panneau : il détient encore une grosse somme en **USDT** (et un peu de TRX pour les frais).\n\n` +
            `C'est une information capitale : des USDT encore présents peuvent être **gelés** par leur émetteur.`,
          tip: 'Clic droit sur le collecteur ▸ « Marquer : Suspect ». Puis lisez la case « Solde actuel » du panneau Analyse.',
          check: { kind: 'flagged', address: collector, flag: 'suspect' },
        },
        {
          title: 'Désignez le collecteur',
          text: `Sélectionnez le collecteur sur le graphe et cliquez **« Utiliser l'adresse sélectionnée »** dans l'objectif 1.`,
          tip: 'Clic sur le nœud marqué Suspect ▸ objectif 1 ▸ « Utiliser l\'adresse sélectionnée ».',
          check: { kind: 'correct', objective: 'o1' },
        },
        {
          title: 'Dépliez les entrées du collecteur',
          text:
            `Qui d'autre alimente ce collecteur ? Dépliez ses **entrées** : bouton **Entrées** du panneau, ou clic droit ▸ « Déplier les entrées ».\n\n` +
            `Plusieurs adresses apparaissent à gauche. Celles qui envoient des **USDT** sont des relais, comme l'« adresse de dépôt » de ${victimName} : chacune a été attribuée par ${brand} à une victime différente. Une autre envoie seulement du **TRX** : nous y reviendrons.`,
          tip: 'Sélectionnez le collecteur ▸ bouton **Entrées** (flèche verte). Appuyez sur L pour réorganiser le graphe.',
          check: { kind: 'txRevealed', tx: othersFwds[0] },
        },
        {
          title: 'Remontez aux autres victimes',
          text:
            `Pour chaque relais qui envoie des USDT au collecteur, dépliez à son tour ses **entrées** : l'expéditeur non attribué qui apparaît est une victime. Marquez chacune **Victime**.\n\n` +
            `Comptez ensuite les victimes, **${g('plaignant compris', 'plaignante comprise')}**, et saisissez le nombre dans l'objectif 2. On compte des personnes (des adresses expéditrices), pas des transactions : certaines victimes ont payé deux fois.`,
          tip: 'Pour chaque relais (adresse non attribuée envoyant des USDT au collecteur) : clic ▸ bouton **Entrées** ▸ clic droit sur l\'expéditeur ▸ « Marquer : Victime ». Puis onglet **Marqués** du Dossier : comptez les victimes.',
          check: { kind: 'correct', objective: 'o6' },
        },
        {
          title: 'Chiffrez le total collecté',
          text:
            `Sélectionnez le collecteur : la case **Total reçu** donne ce qu'il a reçu, actif par actif. Reportez la partie **USDT** dans l'objectif 3. C'est le préjudice minimal du réseau visible on-chain, toutes victimes confondues.`,
          tip: 'Clic sur le collecteur ▸ case « Total reçu » ▸ montant suivi de « USDT » (ignorez le TRX).',
          check: { kind: 'correct', objective: 'o7' },
        },
        {
          title: 'Le portefeuille carburant',
          text:
            `Parmi les entrées du collecteur, une adresse n'envoie que du **TRX**. Cliquez-la et lisez son Historique : elle a aussi envoyé 50 TRX à chaque relais, avant leur premier versement. C'est le portefeuille **« carburant »** des opérateurs, qui paie les frais de toutes leurs adresses.\n\n` +
            `Marquez-le **Suspect** et désignez-le dans l'objectif 4.`,
          tip: 'Repérez la flèche en TRX qui arrive sur le collecteur ▸ clic sur son expéditeur ▸ objectif 4 ▸ « Utiliser l\'adresse sélectionnée ».',
          check: { kind: 'correct', objective: 'o8' },
        },
        {
          title: 'Un même réseau ?',
          text:
            `Objectif 5 : sur quels faits s'appuyer pour affirmer que les relais appartiennent au réseau du collecteur ? Pensez à ce que vous venez d'observer : où partent leurs USDT, et d'où vient leur TRX.\n\n` +
            `Dans un rapport, un rattachement s'écrit toujours avec ses indices : c'est leur convergence qui le rend solide.`,
          tip: 'Objectif 5 : cochez la réponse qui reprend les deux observations faites sur le graphe.',
          check: { kind: 'answered', objective: 'o11' },
        },
        {
          title: 'Chiffrez ce qui reste gelable',
          text: `Reportez dans l'objectif 6 la partie **USDT** du « Solde actuel » du collecteur (sans le TRX). La virgule est acceptée, sans espace entre les milliers.`,
          tip: 'Collecteur sélectionné ▸ case « Solde actuel » ▸ recopiez le montant suivi de « USDT » dans l\'objectif 6.',
          check: { kind: 'correct', objective: 'o2' },
        },
        {
          title: 'Filtrez une période sur la frise',
          text:
            `Ouvrez la **Frise** chronologique (bouton « Frise » en haut, ou touche T) : chaque trait est une transaction affichée sur le graphe, placée à sa date. **Glissez** la souris sur la frise pour sélectionner la période des versements de la victime : le reste du graphe s'estompe.\n\n` +
            `Dater les mouvements permet de vérifier le récit de la plainte et de mesurer l'**urgence** : combien de temps s'est écoulé depuis le dernier mouvement des escrocs ?`,
          tip: 'Bouton **Frise** (icône de panneau en bas, barre du haut) ou touche T ▸ cliquez-glissez horizontalement sur la zone des traits. Le filtre s\'annule avec la croix « Filtre : … ».',
          check: { kind: 'tool', tool: 'timeline' },
        },
        {
          title: 'Trouvez où l\'argent est encaissé',
          text:
            `Dépliez les **sorties** du collecteur. Une partie des USDT est partie vers une adresse étiquetée **« ${exName} — Adresse de dépôt »** : le réseau a commencé à encaisser. Renseignez la plateforme dans l'objectif 7.\n\n` +
            `Regardez la date de ce dépôt sur la frise : il est très récent. Le reste peut partir à tout moment.`,
          tip: 'Double-cliquez le collecteur (marqué Suspect), ou clic droit ▸ « Déplier les sorties ». Annulez le filtre de la frise si les nouveaux nœuds apparaissent estompés. Objectif 7 : menu déroulant ▸ ' + exName + '.',
          check: { kind: 'onGraph', address: exDeposit },
        },
        {
          title: 'Citez le décaissement',
          text:
            `Cliquez la **flèche** qui relie le collecteur à l'adresse de dépôt de ${exName} : sur un modèle à comptes, une flèche qui ne porte qu'une transaction vaut sélection de cette transaction. Utilisez-la dans l'objectif 8 (« Utiliser la transaction sélectionnée »).\n\n` +
            `C'est cette transaction (hash, date, montant) que la réquisition citera, avec l'adresse de dépôt.`,
          tip: `Clic sur la flèche collecteur ▸ « ${exName} — Adresse de dépôt » (ou, dans l'Historique du collecteur, sur la ligne sortante vers cette adresse) ▸ objectif 8 ▸ « Utiliser la transaction sélectionnée ».`,
          check: { kind: 'correct', objective: 'o9' },
        },
        {
          title: 'Mesurez l\'urgence',
          text:
            `Comparez la **date du décaissement** (panneau de la transaction, « Date (Paris) ») et la **date de la plainte** (en tête du procès-verbal). Saisissez l'écart en heures dans l'objectif 9 (une marge de deux heures est tolérée).\n\n` +
            `Un décaissement aussi récent signifie que le réseau est actif : le solde du collecteur peut partir dans l'heure.`,
          tip: 'Transaction de décaissement sélectionnée ▸ « Date (Paris) ». Pièces ▸ plainte ▸ date indiquée. Écart en heures (ex. de 9 h la veille à 15 h le lendemain = 30 h).',
          check: { kind: 'correct', objective: 'o10' },
        },
        {
          title: 'Le gel : pourquoi c\'est urgent',
          text:
            `L'USDT a une particularité : son émetteur, **Tether**, peut **geler** une adresse. Les jetons qu'elle détient sont alors bloqués, où qu'aille ensuite le portefeuille. Mais le gel ne bloque que ce qui est **encore là** au moment où il prend effet.\n\n` +
            `L'ordre des priorités : 1) demande de gel à Tether sur le collecteur, via son portail dédié aux forces de l'ordre, en lien avec le magistrat ; 2) réquisition de ${exName} sur l'adresse de dépôt (identité, IP, blocage du compte) ; 3) identification des autres victimes repérées parmi les entrées du collecteur.\n\n` +
            `⚖> Le gel par l'émetteur est une mesure volontaire et conservatoire : la saisie des fonds relève ensuite d'une décision judiciaire (saisie pénale), à préparer avec le parquet ou le juge d'instruction.`,
          check: { kind: 'manual' },
        },
        {
          title: 'Terminez et remettez le rapport',
          text:
            `Objectif 10 : l'émetteur de l'USDT figure dans la liste, groupe « Autres entités de la base » (catégorie « Émetteur de stablecoin »). Objectif 11 : appuyez-vous sur l'étape « Le gel : pourquoi c'est urgent ».\n\n` +
            `Puis cliquez **Remettre le rapport** pour lire le débriefing.`,
          tip: 'Objectif 10 : menu déroulant ▸ Tether. Objectif 11 : cochez une réponse.',
          check: { kind: 'answered', objective: 'o5' },
        },
      ],
    }
  },
}
