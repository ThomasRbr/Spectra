import { World } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY } from '../engine/patterns'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fakePhone, fmtDate, forwardAll, procedureFor, receivedIn } from './util'

/**
 * Tutoriel 1 : premier traçage Bitcoin, pas à pas.
 * Victime → adresse de l'escroc → un saut → adresse de dépôt d'un exchange → hot wallet.
 */
export const guidePremiersPas: ScenarioTemplate = {
  id: 'guide-premiers-pas',
  guided: true,
  title: 'Tutoriel 1 : votre premier traçage',
  tagline: 'Pas à pas : lire une adresse, ouvrir une transaction, suivre les bitcoins jusqu\'à un exchange.',
  description:
    'Mission guidée pour débuter, sans prérequis. Une victime a payé en bitcoins un véhicule d\'occasion qui n\'existait pas. Le guide vous montre, clic par clic, comment partir de son adresse, lire une transaction, repérer le rendu, marquer l\'escroc et remonter jusqu\'à la plateforme où les fonds ont été déposés.',
  difficulty: 1,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'change', 'exchange_id', 'requisition'],
  estMinutes: 25,
  lessons: ['bases-blockchain', 'explorateur-blocs', 'utxo', 'premiers-reflexes', 'suivre-flux', 'exchanges', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const victimP = fakePerson(r)
    const victimName = victimP.name
    const g = victimP.g
    const city = fakeCity(r)
    const vehicle = r.pick(['un scooter 125 cm³', 'une moto d\'occasion', 'un camping-car', 'une voiture citadine'])

    const cv = exchange(w, 'coinhouse', 'btc')
    const destKey = r.pick(['binance', 'kraken', 'coinbase'] as const)
    const dest = exchange(w, destKey, 'btc')

    const victimE = w.customEntity({ name: victimName, category: 'victim' })
    const victim = w.addr('btc', { entity: victimE, kind: 'p2wpkh' })
    const scamE = w.customEntity({ name: 'Faux vendeur (inconnu)', category: 'suspect' })

    // Achat des bitcoins par la victime sur Coinhouse, retirés vers son portefeuille
    const amount = roundCoin(w, 0.06, 0.2, 0.005)
    const buyT = w.at(-r.int(20, 40))
    const buyTx = cv.withdraw(victim, +(amount + r.float(0.004, 0.012)).toFixed(6), buyT)

    // Paiement au faux vendeur : montant rond, rendu vers une adresse neuve de la victime
    const s1 = w.addr('btc', { entity: scamE, kind: 'p2sh' })
    const t1 = w.utxoTx({ time: w.at(0), from: [victim], to: [{ address: s1, value: amount }] })
    const victimChange = t1.outputs.find((o) => o.address !== s1)?.address

    // Saut intermédiaire : l'escroc vide l'adresse vers une autre adresse à lui
    const s2 = w.addr('btc', { entity: scamE, kind: 'p2sh' })
    const t2 = forwardAll(w, s1, s2, w.at(r.float(2, 7)))

    // Dépôt sur l'exchange (le reste revient à l'escroc en rendu), puis balayage vers le hot wallet
    const deposit = dest.newDeposit()
    const depValue = +(w.unspentValue(s2) * r.float(0.86, 0.94)).toFixed(5)
    const t3 = w.utxoTx({ time: w.at(r.float(14, 30)), from: [s2], to: [{ address: deposit, value: depValue }] })
    const s3 = t3.outputs.find((o) => o.address !== deposit)?.address
    const sweep = dest.sweep([deposit], t3.time + r.float(1, 6) * HOUR)[0]

    // Bruit de fond léger (activité normale des deux plateformes)
    dest.noise(8, w.at(-48), w.at(72))
    cv.noise(5, buyT - DAY, w.at(48))

    const depositReceived = receivedIn(w, t3, deposit)
    const exName = dest.entity.name

    return {
      world: w,
      title: `Fausse annonce de ${vehicle.replace(/^(un|une) /, '')} — ${city}`,
      briefing:
        `${victimName}, demeurant à ${city}, a répondu à une annonce en ligne pour ${vehicle}. Le « vendeur », prétendument muté à l'étranger, exigeait un paiement en bitcoins avant livraison. ${g('Il', 'Elle')} a acheté ${amt(amount, 'BTC')} sur Coinhouse, les a retirés vers son portefeuille personnel puis les a envoyés à l'adresse indiquée. Le véhicule n'a jamais existé et le vendeur ne répond plus.\n\n` +
        `Votre mission : suivre les bitcoins depuis le portefeuille de la victime jusqu'à la plateforme où l'escroc les a déposés, et préparer la suite d'enquête.\n\n` +
        `C'est une **mission guidée** : le guide pas à pas se trouve dans l'onglet **Objectifs** du panneau de gauche (le « Dossier »). Chaque étape se valide toute seule quand vous faites la bonne action, et le bouton « Je bloque » donne le chemin exact. Les indices sont gratuits.`,
      evidence: [
        {
          id: 'plainte',
          type: 'plainte',
          title: 'Procès-verbal de plainte (extrait)',
          date: w.at(3 * 24),
          author: victimName,
          body:
            `« J'ai vu l'annonce sur un site de petites annonces. Le vendeur m'a appelé${g('', 'e')} depuis le ${fakePhone(r)} et m'a expliqué qu'il ne prenait que les bitcoins, "pour aller plus vite".\n\n` +
            `Le ${fmtDate(buyT)}, j'ai acheté des bitcoins sur Coinhouse et je les ai retirés vers mon portefeuille sur mon téléphone. Le ${fmtDate(t1.time)}, j'ai envoyé ${amt(amount, 'BTC')} à l'adresse qu'il m'a donnée par message.\n\n` +
            `L'adresse de mon portefeuille : ${A(w, victim)} »`,
        },
        {
          id: 'message',
          type: 'sms',
          title: 'Message du « vendeur »',
          date: w.at(-3),
          author: 'Numéro masqué',
          body: `Bonjour, comme convenu le paiement se fait en BTC uniquement. Montant : ${amt(amount, 'BTC')}.\nAdresse de paiement :\n${A(w, s1)}\nDès réception, le transporteur part avec le véhicule.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'address', points: 20,
          prompt: 'Quelle est l\'adresse de l\'escroc qui a reçu le paiement de la victime ?',
          answer: [s1],
          hint: 'C\'est l\'adresse qui reçoit le montant rond annoncé dans la plainte, et qui figure aussi dans le message du vendeur.',
          explanation: `La transaction de paiement envoie exactement ${amt(amount, 'BTC')} vers ${A(w, s1)}, l'adresse donnée par message. L'autre sortie de la transaction est le rendu : elle revient à la victime.`,
        },
        {
          id: 'o2', type: 'entity', points: 20,
          prompt: 'Sur quelle plateforme l\'escroc a-t-il déposé les bitcoins ?',
          answer: [destKey],
          hint: 'Suivez les fonds jusqu\'à une adresse dont l\'étiquette porte le nom d\'une plateforme.',
          explanation: `Après un saut par une seconde adresse, l'escroc envoie ${amt(depositReceived, 'BTC')} vers une adresse étiquetée « ${exName} — Adresse de dépôt ». Elle est ensuite balayée vers le hot wallet de ${exName}.`,
        },
        {
          id: 'o3', type: 'address', points: 25,
          prompt: 'Quelle adresse de dépôt faut-il citer dans la réquisition ?',
          answer: [deposit],
          hint: 'Pas le hot wallet : l\'adresse propre au client, juste avant le balayage.',
          explanation: `Sur Bitcoin, l'exchange attribue à chaque client une adresse de dépôt qui lui est propre : c'est elle qui permet à ${exName} de retrouver le titulaire du compte. Le hot wallet, lui, regroupe les fonds de milliers de clients et ne désigne personne.`,
        },
        {
          id: 'o4', type: 'amount', points: 15, unit: 'BTC', tolerance: 0.005,
          prompt: 'Quel montant (en BTC) a été crédité sur cette adresse de dépôt ?',
          answer: depositReceived,
          hint: 'Ouvrez la transaction qui alimente l\'adresse de dépôt et lisez la sortie qui lui est destinée (pas le total de la transaction).',
          explanation: `${amt(depositReceived, 'BTC')}. Le reste de la transaction (${s3 ? amt(receivedIn(w, t3, s3), 'BTC') : 'quelques millièmes'}) est revenu à l'escroc sous forme de rendu, et une petite partie a payé les frais de réseau.`,
        },
        {
          id: 'o5', type: 'choice', points: 20,
          prompt: 'Quelle est la suite d\'enquête la plus pertinente ?',
          ...choice(r,
            `Requérir ${exName} sur l'adresse de dépôt (identité, IP, IBAN) et demander un blocage`,
            [
              `Requérir ${exName} sur son hot wallet, qui centralise l'ensemble des fonds reçus`,
              'Requérir Coinhouse, qui a vendu les bitcoins à la victime avant le paiement',
              'Clôturer le volet financier, les bitcoins devenant intraçables chez l\'exchange',
            ]),
          explanation: `${exName} connaît le titulaire de l'adresse de dépôt (pièce d'identité, adresses IP de connexion, comptes bancaires liés, historique des retraits) et peut bloquer son compte. ${procedureFor(dest.entity)} Coinhouse n'a fait que vendre ses bitcoins à la victime : elle peut confirmer l'achat, pas identifier l'escroc.`,
        },
      ],
      truth: {
        path: [t1.id, t2.id, t3.id, sweep.id],
        addresses: [s1, s2, ...(s3 ? [s3] : []), deposit],
        debrief:
          `Ce qui s'est passé :\n\n` +
          `1. ${victimName} achète des bitcoins sur Coinhouse et les retire vers son portefeuille ${A(w, victim)}.\n` +
          `2. ${g('Il', 'Elle')} paie ${amt(amount, 'BTC')} à l'adresse du faux vendeur ${A(w, s1)}. Son portefeuille renvoie automatiquement la monnaie (le rendu) vers une nouvelle adresse à ${g('lui', 'elle')}${victimChange ? ` (${A(w, victimChange)})` : ''} : sur Bitcoin, on dépense toujours une « pièce » entière.\n` +
          `3. L'escroc vide l'adresse vers une seconde adresse ${A(w, s2)} : un saut sans rendu, toute la somme part d'un bloc.\n` +
          `4. Il envoie ${amt(depositReceived, 'BTC')} sur l'adresse de dépôt ${exName} ${A(w, deposit)} et garde le reste en rendu.\n` +
          `5. ${exName} balaie (sweep) l'adresse de dépôt vers son hot wallet, avec les dépôts d'autres clients : c'est la fin du traçage on-chain.\n\n` +
          `Les réflexes à retenir :\n\n` +
          `- Partir d'un fait sûr (l'adresse de la victime, sa plainte) et avancer saut par saut.\n` +
          `- Dans une transaction Bitcoin, distinguer le paiement (souvent un montant rond) du rendu (qui revient à l'émetteur).\n` +
          `- S'arrêter à l'adresse de dépôt de l'exchange : c'est elle qu'on réquisitionne, avec une demande de blocage. Suivre le hot wallet n'apporte plus rien.\n` +
          `- Marquer au fil de l'eau (suspect, victime) : le rapport reprend ces marquages.`,
      },
      hints: [
        'Le guide est dans l\'onglet Objectifs du Dossier, à gauche. Le bouton « Je bloque » de chaque étape donne le chemin exact.',
        'Double-cliquer sur une adresse du graphe déplie ses sorties : les transactions qui dépensent ses bitcoins apparaissent, avec leurs destinataires.',
        'Une adresse dont l\'étiquette contient « Adresse de dépôt » appartient à une plateforme : c\'est là que le traçage on-chain s\'arrête.',
      ],
      guide: [
        {
          title: 'Prenez vos repères',
          text:
            `Bienvenue ! L'écran a trois zones : à gauche le **Dossier** (onglets Objectifs, Pièces, Marqués, Journal), au centre le **graphe** (vide pour l'instant), à droite le panneau **Analyse** qui détaille ce que vous sélectionnez.\n\n` +
            `Le résumé de l'affaire est dans l'**Ordre de mission** (icône de document, en haut à droite). Un enquêteur commence toujours par relire les faits : montant, date, adresse de la victime.\n\n` +
            `Ce guide reste affiché en haut du dossier, quel que soit l'onglet ouvert : suivez les étapes dans l'ordre, elles se valident toutes seules.`,
          check: { kind: 'manual' },
        },
        {
          title: 'Ajoutez l\'adresse de la victime au graphe',
          text:
            `Ouvrez l'onglet **Pièces** et dépliez la plainte. Les adresses et identifiants de transaction connus sont **surlignés** : un clic les ajoute au graphe.\n\n` +
            `Cliquez l'adresse du portefeuille de la victime. C'est notre point de départ : un fait établi par la plainte, pas une hypothèse.`,
          tip: 'Dossier (à gauche) ▸ onglet **Pièces** ▸ « Procès-verbal de plainte » ▸ cliquez l\'adresse surlignée en bleu après « L\'adresse de mon portefeuille ».',
          check: { kind: 'onGraph', address: victim },
        },
        {
          title: 'Lisez le panneau d\'adresse',
          text:
            `L'adresse est sélectionnée : le panneau **Analyse** (à droite) affiche son solde actuel, son nombre de transactions, le total reçu et envoyé. Elle est « non attribuée » : la base ne la connaît pas, c'est un portefeuille de particulier.\n\n` +
            `Dans l'onglet **Historique** du panneau, chaque ligne est une transaction : flèche verte = entrée, flèche rouge = sortie. Cliquez la transaction **entrante** venant de « Coinhouse — Hot Wallet » : c'est l'achat de la victime, qui confirme sa déclaration.`,
          tip: 'Si le panneau de droite ne montre pas l\'adresse, cliquez son nœud (le rond) sur le graphe. Puis panneau Analyse ▸ onglet **Historique** ▸ cliquez la ligne à flèche verte « Coinhouse — Hot Wallet ».',
          check: { kind: 'selected', id: buyTx.id },
        },
        {
          title: 'Dépliez les sorties de la victime',
          text:
            `Le panneau affiche maintenant la transaction d'achat. Revenez à l'adresse de la victime : cliquez son nœud sur le graphe.\n\n` +
            `Pour voir où sont partis ses bitcoins, **dépliez ses sorties** : double-clic sur le nœud, ou bouton **Sorties** du panneau. Un petit losange apparaît (la transaction de paiement), relié à ses destinataires.`,
          tip: 'Double-cliquez le nœud de la victime sur le graphe. Autres chemins : clic droit sur le nœud ▸ « Déplier les sorties », ou bouton **Sorties** (flèche rouge) dans le panneau d\'adresse.',
          check: { kind: 'txRevealed', tx: t1.id },
        },
        {
          title: 'Ouvrez la transaction de paiement',
          text:
            `Cliquez le **losange** : le panneau affiche la transaction. Lisez ses **Entrées** (les bitcoins dépensés, venant de la victime) et ses **Sorties** (où ils vont). La différence entre les deux, ce sont les **Frais** payés aux mineurs.\n\n` +
            `Il y a deux sorties : le paiement de ${amt(amount, 'BTC')} (montant rond, celui de la plainte) et une autre somme qui **revient à la victime** : le **rendu**. Sur Bitcoin, on dépense des « pièces » entières et la monnaie revient sur une adresse neuve. La barre « Rendu probable » le signale. Le rendu n'est pas une piste : ne le suivez pas.`,
          tip: 'Cliquez le petit losange entre la victime et ses deux destinataires. Dans le panneau, dépliez la barre « Rendu probable » pour voir les raisons (type d\'adresse identique à l\'entrée, montant non rond…).',
          check: { kind: 'selected', id: t1.id },
        },
        {
          title: 'Marquez l\'adresse de l\'escroc',
          text:
            `L'adresse qui reçoit le montant rond est celle du faux vendeur : comparez-la avec celle du **message** dans les Pièces, c'est la même.\n\n` +
            `Marquez-la **Suspect**. Marquer au fur et à mesure évite de se perdre dans un graphe qui grandit, et le rapport final reprendra vos marquages.`,
          tip: 'Clic droit sur le nœud qui a reçu le montant rond ▸ « Marquer : Suspect ». Ou sélectionnez-le puis bouton **Marquer** du panneau ▸ Suspect.',
          check: { kind: 'flagged', address: s1, flag: 'suspect' },
        },
        {
          title: 'Suivez les fonds jusqu\'à la plateforme',
          text:
            `Continuez saut par saut : double-cliquez l'adresse suspecte. Ses bitcoins partent en totalité vers une **seconde adresse** de l'escroc (une seule sortie : pas de rendu). C'est un saut classique pour brouiller les pistes.\n\n` +
            `Double-cliquez cette seconde adresse à son tour. L'une des sorties porte une étiquette de plateforme : **« ${exName} — Adresse de dépôt »**. L'autre, non étiquetée, est le rendu de l'escroc.`,
          tip: 'Double-clic sur l\'adresse marquée Suspect, puis double-clic sur l\'adresse non attribuée qui apparaît à sa droite. Appuyez sur L pour réorganiser le graphe si les nœuds se chevauchent, et sur F pour tout recadrer.',
          check: { kind: 'onGraph', address: deposit },
        },
        {
          title: 'Observez le balayage vers le hot wallet',
          text:
            `Double-cliquez l'adresse de dépôt. Quelques heures après le dépôt, ses fonds sont regroupés avec ceux d'autres adresses de dépôt vers le **« ${exName} — Hot Wallet »** : c'est un **balayage** (sweep), une opération interne de la plateforme.`,
          tip: 'Double-cliquez le nœud « ' + exName + ' — Adresse de dépôt » (ou clic droit ▸ « Déplier les sorties »).',
          check: { kind: 'txRevealed', tx: sweep.id },
        },
        {
          title: 'Adresse de dépôt ou hot wallet ?',
          text:
            `Point clé du métier. L'**adresse de dépôt** est attribuée à **un seul client** de ${exName} : la plateforme sait qui l'utilise (identité vérifiée, adresses IP, compte bancaire). Le **hot wallet** mélange les fonds de milliers de clients : le requérir ne désigne personne.\n\n` +
            `Le traçage on-chain s'arrête donc ici : on ne suit pas le hot wallet. La suite se joue par **réquisition** sur l'adresse de dépôt. Pour voir la fiche de la plateforme, sélectionnez l'adresse de dépôt puis ouvrez l'onglet **Entité** du panneau.`,
          check: { kind: 'manual' },
        },
        {
          title: 'Répondez avec l\'adresse sélectionnée',
          text:
            `Passons aux objectifs (en dessous de ce guide). Pour une réponse de type adresse, **sélectionnez l'adresse sur le graphe** puis cliquez **« Utiliser l'adresse sélectionnée »** dans l'objectif : pas de copier-coller, pas d'erreur de recopie.\n\n` +
            `Sélectionnez l'adresse de l'escroc (marquée Suspect) et utilisez-la pour l'objectif 1. En mission guidée, l'étape ne se valide que si la réponse est juste.`,
          tip: 'Cliquez le nœud marqué Suspect sur le graphe ▸ dans l\'objectif 1, bouton « Utiliser l\'adresse sélectionnée ».',
          check: { kind: 'correct', objective: 'o1' },
        },
        {
          title: 'Désignez l\'adresse de dépôt',
          text:
            `Même méthode pour l'objectif 3 : sélectionnez l'adresse de dépôt de ${exName}, puis « Utiliser l'adresse sélectionnée ».\n\n` +
            `Pour l'objectif 2, choisissez la plateforme dans la liste : elle figure dans le groupe « Entités présentes sur votre graphe ».`,
          tip: `Clic sur le nœud « ${exName} — Adresse de dépôt » ▸ objectif 3 ▸ « Utiliser l'adresse sélectionnée ». Objectif 2 : menu déroulant ▸ ${exName}.`,
          check: { kind: 'correct', objective: 'o3' },
        },
        {
          title: 'Terminez et remettez le rapport',
          text:
            `Objectif 4 : ouvrez la transaction qui alimente l'adresse de dépôt (le losange juste avant elle) et lisez la **sortie** destinée à l'adresse de dépôt, pas le total. La virgule est acceptée (ex. 0,0815).\n\n` +
            `Objectif 5 : choisissez la suite d'enquête. Quand tout est rempli, cliquez **Remettre le rapport** : le débriefing explique chaque réponse.`,
          tip: 'Cliquez le losange relié à l\'adresse de dépôt ▸ section **Sorties** ▸ montant en face de « ' + exName + ' — Adresse de dépôt ». Recopiez-le dans l\'objectif 4, puis cochez une réponse à l\'objectif 5.',
          check: { kind: 'answered', objective: 'o5' },
        },
      ],
    }
  },
}
