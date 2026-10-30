import { World } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY } from '../engine/patterns'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeName, fakePerson, fmtDate, forwardAll, procedureFor } from './util'

/**
 * Tutoriel 4 : plusieurs victimes paient la même adresse. Entrées, marquage,
 * comptage, recherche par fragment d'adresse, journal et rapport.
 */
export const guideRapport: ScenarioTemplate = {
  id: 'guide-rapport',
  guided: true,
  title: 'Tutoriel 4 : plusieurs victimes, marquage et rapport',
  tagline: 'Pas à pas : retrouver une adresse à partir d\'un fragment, recenser les victimes, chiffrer le préjudice et produire le rapport.',
  description:
    'Mission guidée. Une fausse plateforme de « minage » a fait payer plusieurs victimes sur la même adresse Bitcoin. À partir d\'une simple capture d\'écran, vous retrouvez cette adresse avec la recherche, dépliez ses entrées pour recenser les victimes, écartez un intrus qui s\'avère être une piste d\'identification, chiffrez le préjudice, datez l\'encaissement, puis générez un rapport d\'analyse appuyé sur le journal de vos actes.',
  difficulty: 1,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'typologies', 'exchange_id', 'requisition'],
  estMinutes: 45,
  lessons: ['suivre-flux', 'premiers-reflexes', 'typologies', 'exchanges', 'rapport', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const complainant = fakePerson(r)
    const g = complainant.g
    const city = fakeCity(r)
    const brand = r.pick(['HashFlux', 'MineCloud Pro', 'BitHarvest', 'GigaHash Club'])

    const cv = exchange(w, 'coinhouse', 'btc')
    const exKey = r.pick(['binance', 'kraken', 'coinbase', 'bitstamp'] as const)
    const ex = exchange(w, exKey, 'btc')
    const exName = ex.entity.name
    const scamE = w.customEntity({ name: `« ${brand} » (fausse plateforme)`, category: 'suspect' })
    const scam = w.addr('btc', { entity: scamE, kind: 'p2wpkh' })

    // Avant la campagne, l'escroc alimente son adresse depuis son propre compte sur l'exchange (l'« intrus »)
    const testValue = roundCoin(w, 0.012, 0.025, 0.001)
    const testTx = ex.withdraw(scam, testValue, w.at(-r.int(18, 25) * 24))

    // Les victimes : chacune paie l'adresse unique affichée par le site ; l'une d'elles paie deux fois
    const n = r.int(3, 4)
    const twice = r.int(1, n - 1)
    const victims: { name: string; addr: string; txs: string[]; total: number }[] = []
    for (let i = 0; i < n; i++) {
      const name = i === 0 ? complainant.name : fakeName(r)
      const ve = w.customEntity({ name, category: 'victim' })
      const va = w.addr('btc', { entity: ve, kind: r.pick(['p2wpkh', 'p2wpkh', 'p2sh'] as const) })
      const payTimes = [w.at(-(14 - i * 3) * 24 - r.int(0, 20))]
      if (i === twice) payTimes.push(payTimes[0] + r.int(3, 6) * DAY)
      const values = payTimes.map(() => roundCoin(w, 0.03, 0.22, 0.005))
      const need = values.reduce((s, v) => s + v, 0) + r.float(0.004, 0.02)
      const fundT = payTimes[0] - r.int(4, 30) * HOUR
      if (i === 0) cv.withdraw(va, +need.toFixed(6), fundT)
      else w.fund(va, +need.toFixed(6), fundT)
      const txs = payTimes.map((t, k) => w.utxoTx({ time: t, from: [va], to: [{ address: scam, value: values[k] }], change: i === twice ? va : undefined }).id)
      victims.push({ name, addr: va, txs, total: values.reduce((s, v) => s + v, 0) })
    }
    const lastPay = Math.max(...victims.flatMap((v) => v.txs.map((t) => w.tx(t).time)))
    const total = +victims.reduce((s, v) => s + v.total, 0).toFixed(8)
    const nTx = victims.reduce((s, v) => s + v.txs.length, 0)

    // Encaissement : tout part vers une adresse de dépôt du même exchange, balayée ensuite
    const deposit = ex.newDeposit()
    const outTx = forwardAll(w, scam, deposit, lastPay + r.int(12, 40) * HOUR)
    const sweep = ex.sweep([deposit], outTx.time + r.float(1, 5) * HOUR)[0]
    const deposited = outTx.outputs[0].value
    // Délai entre le dernier versement d'une victime et l'encaissement (en heures, au dixième)
    const delayH = Math.round((outTx.time - lastPay) / 360) / 10

    // Bruit de fond
    ex.noise(8, w.at(-25 * 24), w.at(5 * 24))
    cv.noise(5, w.at(-20 * 24), w.at(2 * 24))

    // Fragment d'adresse affiché par l'application de la victime : assez long pour être unique
    const full = A(w, scam)
    let k = 8
    const unique = (frag: string) => [...w.addresses.values()].filter((a) => a.addr.toLowerCase().includes(frag.toLowerCase())).length === 1
    while (!unique(full.slice(-k)) && k < 20) k++
    const tail = full.slice(-k)
    const shown = `${full.slice(0, 6)}…${tail}`

    const plaignante = victims[0]
    const plainteT = lastPay + r.int(2, 5) * DAY

    return {
      world: w,
      title: `Faux minage « ${brand} » — ${city}`,
      briefing:
        `${complainant.name} (${city}) a souscrit un « contrat de minage » sur le site ${brand}, qui promettait de doubler la mise en trente jours. ${g('Il', 'Elle')} a payé en bitcoins à l'adresse affichée sur le site ; le site a disparu depuis. ${g('Il', 'Elle')} ne dispose que d'une capture d'écran de son application, sur laquelle l'adresse de destination est **tronquée**.\n\n` +
        `Le site affichait sans doute la même adresse à tous ses clients : il y a probablement d'autres victimes. Votre mission : retrouver l'adresse de l'escroc, recenser toutes les victimes, chiffrer le préjudice, identifier la plateforme d'encaissement et produire un rapport d'analyse.\n\n` +
        `C'est une **mission guidée** : le guide pas à pas se trouve dans l'onglet **Objectifs** du Dossier (à gauche). Les étapes se valident d'elles-mêmes ; « Je bloque » donne le chemin exact. Les indices sont gratuits.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteT, author: complainant.name,
          body:
            `« J'ai vu une publicité pour ${brand} sur un réseau social. Le site expliquait qu'en louant de la puissance de minage, on doublait sa mise en un mois. J'ai acheté des bitcoins sur Coinhouse et je les ai envoyés depuis mon portefeuille le ${fmtDate(w.tx(plaignante.txs[0]).time)}. Depuis, le site est inaccessible.\n\n` +
            `Mon adresse Bitcoin : ${A(w, plaignante.addr)}\n\n` +
            `Je n'ai pas noté l'adresse du site, seulement fait une capture d'écran de mon application. »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture — application portefeuille de la victime', date: w.tx(plaignante.txs[0]).time,
          body: `Envoyé · Bitcoin\n−${amt(plaignante.total, 'BTC')}\nÀ : ${shown}\nStatut : Confirmé (6+ confirmations)`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe', date: plainteT + 3 * HOUR, author: 'Chef de groupe',
          body: `D'autres plaintes visant ${brand} pourraient arriver dans d'autres services. Recense toutes les victimes visibles on-chain et chiffre le préjudice total : on aura besoin d'un rapport propre pour le parquet, avec la méthode et le journal des opérations.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o3', type: 'address', points: 10,
          prompt: 'Quelle est l\'adresse Bitcoin de l\'escroc ?',
          answer: [scam],
          hint: 'Ouvrez la recherche et tapez la fin de l\'adresse visible sur la capture.',
          explanation: `${full}. La fin visible sur la capture (« ${tail} ») suffisait à la retrouver, à condition de vérifier aussi le début et que la victime figure bien parmi ses entrées : des escrocs créent parfois des adresses qui ressemblent à s'y méprendre à une autre (address poisoning).`,
        },
        {
          id: 'o6', type: 'tx', points: 10,
          prompt: 'Quelle transaction montre l\'escroc alimentant son adresse depuis son propre compte, avant les faits ?',
          answer: [testTx.id],
          hint: 'Parmi les entrées de l\'adresse de l\'escroc, une seule vient d\'une adresse étiquetée « Hot Wallet ».',
          explanation: `La transaction ${testTx.hash.slice(0, 16)}… du ${fmtDate(testTx.time)} envoie ${amt(testValue, 'BTC')} du hot wallet de ${exName} vers l'adresse de l'escroc, bien avant le premier versement de victime. C'est un retrait, ordonné depuis un compte client de ${exName} : la plateforme peut retrouver ce compte à partir du hash et de l'adresse de destination. C'est une piste d'identification de premier ordre, à citer dans la réquisition.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: `Comment traiter, dans l'analyse, ce versement venu du hot wallet de ${exName} ?`,
          ...choice(r,
            'L\'exclure du préjudice, mais le citer dans la réquisition comme retrait ordonné depuis le compte de l\'escroc',
            [
              'Le compter comme une victime de plus, puisqu\'il a payé l\'adresse de l\'escroc comme les autres',
              'L\'ignorer complètement : un hot wallet mélange des milliers de clients, il n\'apporte rien',
              'Demander à la plateforme de geler son hot wallet, qui a financé l\'escroquerie',
            ]),
          hint: 'Un retrait depuis une plateforme part du compte d\'un client précis : lequel ?',
          explanation: `Ce versement n'est pas un préjudice : aucune victime ne l'a payé, c'est l'escroc qui s'envoie des fonds depuis son compte ${exName}. Mais un retrait est ordonné par un client identifié : avec le hash, la date et l'adresse de destination, ${exName} retrouve le compte d'origine. On l'écarte donc du chiffrage et on le met en avant dans la réquisition. Un hot wallet ne se gèle pas : il appartient à la plateforme et à tous ses clients.`,
        },
        {
          id: 'o7', type: 'address', points: 8,
          prompt: 'Quelle victime a payé deux fois ? Donnez son adresse.',
          answer: [victims[twice].addr],
          hint: 'Parmi les entrées de l\'adresse de l\'escroc, une adresse expéditrice est reliée par deux transactions.',
          explanation: `${A(w, victims[twice].addr)} (${victims[twice].name}) a envoyé deux versements, à quelques jours d'intervalle, pour ${amt(victims[twice].total, 'BTC')} au total. Le second versement est typique des fausses plateformes, qui relancent leurs « clients » (frais, « taxe » de retrait, mise complémentaire). Son portefeuille renvoie de plus le rendu sur l'adresse d'origine : on la voit en entrée et en sortie de ses deux transactions.`,
        },
        {
          id: 'o1', type: 'number', points: 10, unit: 'victimes',
          prompt: 'Combien de victimes distinctes ont payé l\'adresse de l\'escroc ?',
          answer: n,
          hint: 'Comptez les adresses qui envoient des fonds, pas les transactions : une victime a payé deux fois. Et l\'adresse d\'exchange n\'est pas une victime.',
          explanation: `${n} victimes, pour ${nTx} versements : ${victims[twice].name} a payé deux fois depuis la même adresse. Le versement venant du hot wallet de ${exName} n'est pas une victime : c'est l'escroc qui alimente son adresse depuis son propre compte.`,
        },
        {
          id: 'o2', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.002,
          prompt: 'Quel montant total (en BTC) les victimes ont-elles versé ?',
          answer: total,
          hint: 'Additionnez les versements des victimes, ou prenez le « Total reçu » de l\'adresse et retranchez le retrait venant de l\'exchange.',
          explanation: `${amt(total, 'BTC')} au total (${victims.map((v) => amt(v.total, 'BTC')).join(' + ')}). Le « Total reçu » de l'adresse est plus élevé de ${amt(testValue, 'BTC')} : c'est le retrait de l'escroc depuis ${exName}, qui ne fait pas partie du préjudice.`,
        },
        {
          id: 'o4', type: 'entity', points: 8,
          prompt: 'Sur quelle plateforme l\'escroc a-t-il encaissé les fonds ?',
          answer: [exKey],
          hint: 'Dépliez les sorties de l\'adresse de l\'escroc.',
          explanation: `Les ${amt(deposited, 'BTC')} sont envoyés en une fois vers une adresse de dépôt ${exName}. ${procedureFor(ex.entity)} Indice précieux : l'escroc avait déjà retiré des fonds de ${exName} vers cette adresse. Dans la réquisition, on cite donc à la fois l'adresse de dépôt et ce retrait.`,
        },
        {
          id: 'o8', type: 'address', points: 10,
          prompt: 'Quelle adresse de dépôt faut-il citer dans la réquisition ?',
          answer: [deposit],
          hint: 'C\'est la seule destination de la transaction qui vide l\'adresse de l\'escroc ; elle est ensuite balayée vers le hot wallet.',
          explanation: `${A(w, deposit)}, étiquetée « ${exName} — Adresse de dépôt » : elle est propre à un client, contrairement au hot wallet vers lequel elle est balayée quelques heures plus tard. La réquisition vise ce compte, avec deux points d'entrée concordants : ce dépôt et le retrait antérieur vers l'adresse de l'escroc. Si les deux mènent au même titulaire, l'attribution est solide.`,
        },
        {
          id: 'o9', type: 'amount', points: 8, unit: 'BTC', tolerance: 0.002,
          prompt: 'Quel montant (en BTC) a été crédité sur cette adresse de dépôt ?',
          answer: deposited,
          hint: 'Ouvrez la transaction qui vide l\'adresse de l\'escroc : elle n\'a qu\'une sortie.',
          explanation: `${amt(deposited, 'BTC')} : tout le solde de l'adresse de l'escroc (versements des victimes et retrait préalable), moins ${amt(outTx.fee, 'BTC')} de frais de réseau. Une transaction à une seule sortie, sans rendu, vide entièrement l'adresse : l'escroc ne garde rien sur place.`,
        },
        {
          id: 'o10', type: 'number', points: 8, unit: 'heures', tolerance: 1.5,
          prompt: 'Combien d\'heures se sont écoulées entre le dernier versement d\'une victime et l\'encaissement sur la plateforme ?',
          answer: delayH,
          hint: 'Repérez, parmi les versements des victimes, le plus récent, puis comparez sa date à celle de la transaction vers l\'adresse de dépôt.',
          explanation: `Dernier versement le ${fmtDate(lastPay)}, encaissement le ${fmtDate(outTx.time)} : environ ${delayH.toLocaleString('fr-FR')} heures. L'escroc a attendu la fin de sa campagne avant de tout sortir d'un bloc, puis le site a disparu. Pour le rapport, cette chronologie (préparation de l'adresse, versements, encaissement, fermeture du site) éclaire le mode opératoire ; pour la réquisition, elle cadre la période de connexion à demander.`,
        },
        {
          id: 'o5', type: 'choice', points: 10,
          prompt: 'Qu\'est-ce qui rend un rapport d\'analyse exploitable par le magistrat ?',
          ...choice(r,
            'Des constatations sourcées et datées, la méthode employée, des hypothèses signalées comme telles',
            [
              'Un graphe aussi complet que possible, avec toutes les adresses dépliées même sans lien direct',
              'Des conclusions présentées comme certaines, afin de ne laisser aucune place au doute',
              'Les seuls montants totaux, sans adresses ni transactions qui alourdiraient la lecture',
            ]),
          hint: 'Un tiers doit pouvoir refaire votre raisonnement.',
          explanation: 'Un rapport d\'analyse doit permettre à un tiers de refaire le raisonnement : chaque constatation renvoie à une adresse ou une transaction vérifiable, la méthode (heuristiques, outils) est exposée, et ce qui relève de l\'hypothèse (rattachements, attribution) est présenté comme tel. Le journal horodaté des opérations en garantit la traçabilité.',
        },
      ],
      truth: {
        path: [...victims.flatMap((v) => v.txs), testTx.id, outTx.id, sweep.id],
        addresses: [scam, deposit, ...victims.map((v) => v.addr)],
        debrief:
          `Ce qui s'est passé :\n\n` +
          `1. Environ trois semaines avant les faits, l'escroc retire ${amt(testValue, 'BTC')} de son compte ${exName} vers ${full} (transaction ${testTx.hash.slice(0, 12)}…) : il prépare son adresse.\n` +
          `2. Le site ${brand} affiche cette même adresse à tous ses « clients ». ${n} victimes y versent ${amt(total, 'BTC')} en ${nTx} transactions :\n` +
          victims.map((v) => `- ${v.name} : ${amt(v.total, 'BTC')}${v.txs.length > 1 ? ` (${v.txs.length} versements)` : ''}`).join('\n') + `\n` +
          `3. Environ ${delayH.toLocaleString('fr-FR')} heures après le dernier versement, l'escroc vide l'adresse en une transaction : ${amt(deposited, 'BTC')} sur l'adresse de dépôt ${exName} ${A(w, deposit)}, balayée ensuite vers le hot wallet.\n\n` +
          `À retenir :\n\n` +
          `- Une adresse d'escroquerie partagée entre clients se lit par ses **Entrées** : chaque expéditeur est une victime potentielle, à confirmer.\n` +
          `- On compte des **victimes** (adresses expéditrices), pas des transactions, et on écarte ce qui n'est pas un préjudice (ici le retrait depuis l'exchange, qui est en revanche une excellente piste d'identification).\n` +
          `- Une même plateforme en amont (retrait) et en aval (dépôt) : deux points d'entrée pour une seule réquisition, qui se recoupent.\n` +
          `- Une adresse tronquée se retrouve avec la recherche, mais on vérifie toujours le début, la fin et la cohérence (montant, date, victime parmi les entrées).\n` +
          `- Le **marquage**, les **notes** et le **journal** alimentent directement le rapport : marquer au fil de l'eau, c'est rédiger le rapport en avançant.`,
      },
      hints: [
        'Le guide est dans l\'onglet Objectifs du Dossier. Le bouton « Je bloque » de chaque étape donne le chemin exact.',
        'La recherche (loupe en haut à droite, ou Ctrl K) trouve une adresse à partir de quatre caractères consécutifs.',
        'Les Entrées d\'une adresse montrent qui lui a envoyé des fonds. Une étiquette « Hot Wallet » désigne une plateforme, pas une victime.',
        'La date de chaque transaction figure dans son panneau (« Date (Paris) ») ; la frise (touche T) les place toutes sur un axe.',
      ],
      guide: [
        {
          title: 'Ouvrez la recherche',
          text:
            `Dans les **Pièces**, la capture montre une adresse **tronquée** : « ${shown} ». Elle n'est pas cliquable, car incomplète.\n\n` +
            `Ouvrez la **recherche** : icône loupe « Rechercher » en haut à droite, ou raccourci **Ctrl K**. Elle trouve les adresses, transactions et entités du dossier à partir d'un fragment d'au moins quatre caractères.`,
          tip: 'Barre du haut ▸ icône loupe (« Rechercher »), ou appuyez sur Ctrl et K en même temps.',
          check: { kind: 'tool', tool: 'search' },
        },
        {
          title: 'Retrouvez l\'adresse de l\'escroc',
          text:
            `Tapez la **fin** de l'adresse visible sur la capture (« ${tail} ») et cliquez le résultat : l'adresse s'ajoute au graphe.\n\n` +
            `Vérifiez que le **début** correspond aussi. Une adresse partielle peut en cacher une autre qui lui ressemble : c'est le principe de l'« address poisoning ». Ici, la présence de la victime parmi les entrées confirmera le rapprochement.`,
          tip: `Dans la fenêtre de recherche, tapez ${tail} puis cliquez la ligne sous « Adresses ».`,
          check: { kind: 'onGraph', address: scam },
        },
        {
          title: 'Marquez l\'escroc et désignez son adresse',
          text: `Marquez l'adresse de l'escroc **Suspect**, puis, en la gardant sélectionnée, cliquez **« Utiliser l'adresse sélectionnée »** dans l'objectif 1.`,
          tip: 'Clic droit sur l\'adresse de l\'escroc ▸ « Marquer : Suspect ». Puis clic sur son nœud ▸ objectif 1 ▸ « Utiliser l\'adresse sélectionnée ».',
          check: { kind: 'flagged', address: scam, flag: 'suspect' },
        },
        {
          title: 'Dépliez ses entrées',
          text:
            `Jusqu'ici, on dépliait les **sorties** (où va l'argent). Pour savoir **qui a payé** cette adresse, on déplie ses **entrées** : bouton **Entrées** du panneau, ou clic droit ▸ « Déplier les entrées ».\n\n` +
            `Les expéditeurs apparaissent à gauche, chacun relié à l'adresse par sa transaction (losange).`,
          tip: 'Sélectionnez l\'adresse de l\'escroc ▸ bouton **Entrées** (flèche verte) du panneau Analyse. Ou clic droit sur le nœud ▸ « Déplier les entrées ».',
          check: { kind: 'txRevealed', tx: victims[n - 1].txs[0] },
        },
        {
          title: 'Repérez l\'intrus',
          text:
            `Parmi les expéditeurs, l'un porte une étiquette : **« ${exName} — Hot Wallet »**. Ce n'est pas une victime : c'est un **retrait** depuis ${exName} vers l'adresse de l'escroc, bien avant les faits. L'escroc a alimenté son adresse depuis son propre compte.\n\n` +
            `Cliquez le losange de cette transaction pour la lire. À écarter du préjudice, mais à garder précieusement : c'est une piste d'identification.`,
          tip: `Cliquez le petit losange relié au nœud « ${exName} — Hot Wallet ».`,
          check: { kind: 'selected', id: testTx.id },
        },
        {
          title: 'Citez ce retrait',
          text:
            `La transaction est sélectionnée : cliquez **« Utiliser la transaction sélectionnée »** dans l'objectif 2. Une transaction se cite par son **hash** (l'identifiant affiché en haut du panneau), avec sa date et son montant.\n\n` +
            `Puis répondez à l'objectif 3 : comment ce versement doit-il être traité dans l'analyse ?`,
          tip: `Losange relié à « ${exName} — Hot Wallet » sélectionné ▸ objectif 2 ▸ « Utiliser la transaction sélectionnée ».`,
          check: { kind: 'correct', objective: 'o6' },
        },
        {
          title: 'Préjudice ou piste ?',
          text:
            `Objectif 3. Un **retrait** depuis une plateforme est ordonné par un client précis, depuis son compte : la plateforme sait lequel. Ce versement n'est donc pas un préjudice, mais il désigne indirectement l'escroc.\n\n` +
            `Distinguer ce qui chiffre le préjudice de ce qui sert à identifier est un réflexe essentiel du rapport.`,
          tip: 'Objectif 3 : cochez la réponse qui écarte ce versement du préjudice tout en l\'exploitant.',
          check: { kind: 'answered', objective: 'o11' },
        },
        {
          title: 'Marquez chaque victime',
          text:
            `Les autres expéditeurs, non attribués, sont des victimes. Marquez **chacune** d'elles **Victime**, y compris ${g('le plaignant', 'la plaignante')} (comparez avec l'adresse de la plainte).\n\n` +
            `Attention : une victime a payé **deux fois** depuis la même adresse. Elle ne compte qu'une fois.`,
          tip: 'Pour chaque expéditeur non étiqueté : clic droit ▸ « Marquer : Victime ». Contrôlez ensuite dans l\'onglet **Marqués** du Dossier.',
          check: { kind: 'flagged', address: victims[n - 1].addr, flag: 'victim' },
        },
        {
          title: 'Repérez la victime qui a payé deux fois',
          text:
            `Une des adresses victimes est reliée à l'escroc par **deux** losanges : deux versements à quelques jours d'intervalle. Sélectionnez-la et utilisez-la dans l'objectif 4.\n\n` +
            `Ces relances (« frais », « taxe » de retrait…) sont typiques des fausses plateformes : la victime paie une seconde fois pour récupérer la première mise.`,
          tip: 'Cherchez le nœud victime d\'où partent deux transactions vers l\'escroc (ou, dans l\'Historique de l\'escroc, deux lignes entrantes venant de la même adresse) ▸ objectif 4 ▸ « Utiliser l\'adresse sélectionnée ».',
          check: { kind: 'correct', objective: 'o7' },
        },
        {
          title: 'Comptez les victimes',
          text:
            `Ouvrez l'onglet **Marqués** du Dossier : vos marquages sont regroupés par catégorie, avec leur nombre. C'est votre recensement.\n\n` +
            `Revenez à l'onglet Objectifs et saisissez le nombre de victimes dans l'objectif 5.`,
          tip: 'Dossier ▸ onglet **Marqués** ▸ lisez le chiffre entre parenthèses après « Victime ». Objectif 5 : saisissez ce nombre (sans compter le hot wallet).',
          check: { kind: 'correct', objective: 'o1' },
        },
        {
          title: 'Chiffrez le préjudice',
          text:
            `Deux méthodes, qui doivent concorder : additionner les versements des victimes (cliquez chaque losange et lisez la sortie vers l'escroc), ou partir du **Total reçu** de l'adresse de l'escroc (onglet **Historique**, lignes entrantes) et retrancher le retrait venu de ${exName}.\n\n` +
            `Saisissez le total en BTC dans l'objectif 6 (la virgule est acceptée).`,
          tip: 'Adresse de l\'escroc ▸ onglet **Historique** ▸ filtre « Entrantes » : additionnez les montants, sauf la ligne « ' + exName + ' — Hot Wallet ».',
          check: { kind: 'correct', objective: 'o2' },
        },
        {
          title: 'Suivez l\'encaissement',
          text: `Dépliez maintenant les **sorties** de l'adresse de l'escroc (double-clic). Tout part en une fois vers une **« ${exName} — Adresse de dépôt »** : l'escroc encaisse là où il avait déjà un compte. Renseignez l'objectif 7.`,
          tip: `Double-cliquez l'adresse de l'escroc ▸ repérez « ${exName} — Adresse de dépôt ». Objectif 7 : menu déroulant ▸ ${exName}.`,
          check: { kind: 'onGraph', address: deposit },
        },
        {
          title: 'Désignez l\'adresse de dépôt',
          text:
            `Sélectionnez l'adresse de dépôt et utilisez-la dans l'objectif 8. C'est elle que vise la réquisition, jamais le hot wallet vers lequel elle sera balayée.\n\n` +
            `Remarquez la cohérence : la même plateforme apparaît **en amont** (le retrait qui a alimenté l'adresse) et **en aval** (le dépôt). Deux points d'entrée pour une seule réquisition, qui devraient mener au même titulaire.`,
          tip: `Clic sur « ${exName} — Adresse de dépôt » ▸ objectif 8 ▸ « Utiliser l'adresse sélectionnée ».`,
          check: { kind: 'correct', objective: 'o8' },
        },
        {
          title: 'Relevez le montant encaissé',
          text: `Cliquez le losange de la transaction d'encaissement : elle n'a qu'**une sortie**, vers l'adresse de dépôt (pas de rendu, l'adresse est vidée). Reportez son montant dans l'objectif 9.`,
          tip: 'Clic sur le losange entre l\'adresse de l\'escroc et l\'adresse de dépôt ▸ section **Sorties** ▸ montant. Saisissez-le dans l\'objectif 9.',
          check: { kind: 'correct', objective: 'o9' },
        },
        {
          title: 'Mesurez le délai d\'encaissement',
          text:
            `Retrouvez le **dernier** versement d'une victime (le plus récent des losanges d'entrée) et comparez sa **Date (Paris)** à celle de la transaction d'encaissement. Saisissez l'écart en heures dans l'objectif 10 (une marge d'une heure et demie est tolérée).\n\n` +
            `Astuce : la **Frise** (touche T) place toutes les transactions du graphe sur un axe du temps, ce qui aide à repérer la plus récente.`,
          tip: 'Ouvrez chaque losange d\'entrée et notez sa date ; gardez la plus récente. Puis losange d\'encaissement ▸ « Date (Paris) ». Calculez l\'écart en heures.',
          check: { kind: 'correct', objective: 'o10' },
        },
        {
          title: 'Consultez le Journal',
          text:
            `Ouvrez l'onglet **Journal** du Dossier : chaque action (ajout d'adresse, dépliage, marquage…) y est **horodatée**. C'est la traçabilité de votre analyse : le magistrat ou la défense doivent pouvoir comprendre comment vous êtes arrivé(e) à vos conclusions.\n\n` +
            `Ajoutez si vous le souhaitez une observation dans l'onglet **Notes** d'une adresse (ex. « retrait ${exName} préalable aux faits ») : les notes sont reprises dans le rapport. Revenez ensuite ici.`,
          check: { kind: 'manual' },
        },
        {
          title: 'Générez le rapport',
          text:
            `Cliquez **Rapport** (icône d'imprimante, barre du haut). Le rapport reprend le contexte, la méthode, vos réponses, les adresses marquées avec vos notes, le graphe et le journal. Vérifiez le rédacteur et l'unité, puis cliquez **« Générer le rapport »** : il s'ouvre prêt à imprimer ou à enregistrer en PDF.`,
          tip: 'Barre du haut ▸ icône imprimante (« Rapport ») ▸ bouton **Générer le rapport**.',
          check: { kind: 'tool', tool: 'report' },
        },
        {
          title: 'Terminez et remettez',
          text: `Répondez à l'objectif 11, vérifiez que tous les objectifs sont remplis, puis cliquez **Remettre le rapport** pour lire le débriefing.`,
          tip: 'Objectif 11 : cochez une réponse ▸ bouton **Remettre le rapport** en bas de l\'onglet Objectifs.',
          check: { kind: 'answered', objective: 'o5' },
        },
      ],
    }
  },
}
