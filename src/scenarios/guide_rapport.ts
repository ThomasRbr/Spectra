import { World } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY } from '../engine/patterns'
import type { ScenarioTemplate } from './types'
import { A, de, amt, choice, fakeCity, fakePerson, fmtDate, forwardAll, procedureFor, receivedIn } from './util'

/**
 * Tutoriel 4 : plusieurs victimes paient la même adresse. Entrées, marquage,
 * tri (retrait de l'escroc, poussière, faux gain versé à une victime),
 * comptage, recherche par fragment d'adresse, journal et rapport.
 */

/** Premier instant ≥ `after` tombant en journée (entre 9 h et 19 h environ, heure de Paris). */
function daytime(w: World, after: number): number {
  let t = Math.floor(after / DAY) * DAY + w.rng.int(8 * 60, 17 * 60) * 60
  if (t < after) t += DAY
  return t
}
export const guideRapport: ScenarioTemplate = {
  id: 'guide-rapport',
  guided: true,
  title: 'Tutoriel 4 : plusieurs victimes, marquage et rapport',
  tagline: 'Pas à pas : retrouver une adresse à partir d\'un fragment, recenser les victimes en écartant les intrus, chiffrer le préjudice et produire le rapport.',
  description:
    'Mission guidée. Une fausse plateforme de « minage » a fait payer plusieurs victimes sur la même adresse Bitcoin. À partir d\'une simple capture d\'écran, vous retrouvez cette adresse avec la recherche, dépliez ses entrées pour recenser les victimes, écartez les intrus (un retrait de l\'escroc qui s\'avère être une piste d\'identification, une poussière envoyée par un inconnu), repérez le faux « gain » versé pour mettre une victime en confiance, chiffrez le préjudice, datez l\'encaissement, puis générez un rapport d\'analyse appuyé sur le journal de vos actes.',
  difficulty: 1,
  chains: ['btc'],
  skills: ['lecture_tx', 'utxo', 'typologies', 'exchange_id', 'requisition'],
  estMinutes: 50,
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
    const victims: { name: string; g: (m: string, f: string) => string; addr: string; txs: string[]; total: number }[] = []
    for (let i = 0; i < n; i++) {
      const person = i === 0 ? complainant : fakePerson(r)
      const name = person.name
      const ve = w.customEntity({ name, category: 'victim' })
      const va = w.addr('btc', { entity: ve, kind: r.pick(['p2wpkh', 'p2wpkh', 'p2sh'] as const) })
      // Versement en journée ou en soirée (entre 7 h et 22 h environ, heure de Paris)
      const payTimes = [Math.floor(w.at(-(14 - i * 3) * 24) / DAY) * DAY + r.int(6 * 60, 20 * 60) * 60]
      if (i === twice) payTimes.push(payTimes[0] + r.int(3, 6) * DAY)
      const values = payTimes.map(() => roundCoin(w, 0.03, 0.22, 0.005))
      const need = values.reduce((s, v) => s + v, 0) + r.float(0.004, 0.02)
      const fundT = payTimes[0] - r.int(4, 30) * HOUR
      if (i === 0) cv.withdraw(va, +need.toFixed(6), fundT)
      else w.fund(va, +need.toFixed(6), fundT)
      const txs = payTimes.map((t, k) => w.utxoTx({ time: t, from: [va], to: [{ address: scam, value: values[k] }], change: i === twice ? va : undefined }).id)
      victims.push({ name, g: person.g, addr: va, txs, total: values.reduce((s, v) => s + v, 0) })
    }
    const lastPay = Math.max(...victims.flatMap((v) => v.txs.map((t) => w.tx(t).time)))
    const total = +victims.reduce((s, v) => s + v.total, 0).toFixed(8)
    const nTx = victims.reduce((s, v) => s + v.txs.length, 0)

    // Faux « gain » : entre ses deux versements, la victime qui paiera deux fois reçoit un premier
    // « versement de production » depuis l'adresse de la plateforme (rendu sur la même adresse)
    const tw = victims[twice]
    const firstPay = w.tx(tw.txs[0])
    const firstValue = receivedIn(w, firstPay, scam)
    const gainValue = Math.max(0.002, Math.round(firstValue * r.float(0.08, 0.14) * 1000) / 1000)
    const gainTx = w.utxoTx({ time: firstPay.time + r.float(1, 2) * DAY, from: [scam], to: [{ address: tw.addr, value: gainValue }], change: scam })

    // Poussière : un inconnu envoie 546 sats à l'adresse affichée publiquement sur le site
    const duster = w.addr('btc', { kind: 'p2wpkh' })
    w.fund(duster, 0.0002, lastPay - r.float(4, 6) * DAY)
    const dustTx = w.utxoTx({ time: lastPay - r.float(1, 3) * DAY, from: [duster], to: [{ address: scam, value: 0.00000546 }], tags: ['dust'] })

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
    const plainteT = daytime(w, lastPay + r.float(1.5, 4.5) * DAY)
    // Fourchette des versements des victimes, et délai entre le retrait préparatoire et le premier versement
    const payVals = victims.flatMap((v) => v.txs.map((t) => receivedIn(w, w.tx(t), scam)))
    const firstPayT = Math.min(...victims.flatMap((v) => v.txs.map((t) => w.tx(t).time)))
    const prepDays = Math.round((firstPayT - testTx.time) / DAY)
    const receivedAll = Math.round((w.summary(scam).received.BTC ?? 0) * 1e8) / 1e8
    const twNet = Math.round((tw.total - gainValue) * 1e8) / 1e8

    return {
      world: w,
      title: `Faux minage « ${brand} » — ${city}`,
      briefing:
        `${complainant.name} (${city}) a souscrit un « contrat de minage » sur le site ${brand}, qui promettait de doubler la mise en trente jours. ${g('Il', 'Elle')} a payé en bitcoins à l'adresse affichée sur le site ; le site a disparu depuis. ${g('Il', 'Elle')} ne dispose que d'une capture d'écran de son application, sur laquelle l'adresse de destination est **tronquée**.\n\n` +
        `Le site affichait sans doute la même adresse à tous ses clients : il y a probablement d'autres victimes. Votre mission : retrouver l'adresse de l'escroc, recenser toutes les victimes (et seulement elles), chiffrer le préjudice, identifier la plateforme d'encaissement et produire un rapport d'analyse.\n\n` +
        `C'est une **mission guidée** : le guide pas à pas flotte en haut à gauche du graphe. Les étapes se valident d'elles-mêmes ; « Je bloque » donne le chemin exact. Les indices sont gratuits.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: plainteT, author: complainant.name,
          body:
            `« J'ai vu une publicité pour ${brand} sur un réseau social. Le site expliquait qu'en louant de la puissance de minage, on doublait sa mise en un mois, avec des "versements de production" chaque semaine. J'ai acheté des bitcoins sur Coinhouse et je les ai envoyés depuis mon portefeuille le ${fmtDate(w.tx(plaignante.txs[0]).time)}. Je n'ai jamais rien reçu, et depuis, le site est inaccessible.\n\n` +
            `Mon adresse Bitcoin : ${A(w, plaignante.addr)}\n\n` +
            `Je n'ai pas noté l'adresse du site, seulement fait une capture d'écran de mon application. »`,
        },
        {
          id: 'capture', type: 'capture', title: 'Capture — application portefeuille de la victime', date: w.tx(plaignante.txs[0]).time,
          body: `Envoyé · Bitcoin\n−${amt(plaignante.total, 'BTC')}\nÀ : ${shown}\nStatut : Confirmé (6+ confirmations)`,
        },
        {
          id: 'forum', type: 'forum', title: `Forum d'investisseurs — fil « ${brand} : arnaque ? »`, date: lastPay + DAY, author: 'Extraits publics',
          body:
            `— « Moi j'ai bien reçu un premier versement de production il y a quelques jours, c'est sérieux. Du coup j'ai remis une deuxième fois. »\n` +
            `— « Le support ne répond plus depuis hier… »\n` +
            `— « Classique : on vous reverse un petit "gain" pour que vous remettiez au pot. »`,
        },
        {
          id: 'note', type: 'note', title: 'Note du chef de groupe', date: plainteT + 3 * HOUR, author: 'Chef de groupe',
          body: `D'autres plaintes visant ${brand} pourraient arriver dans d'autres services. Recense toutes les victimes visibles on-chain et chiffre le préjudice total, brut et net (attention aux « versements de production » évoqués sur le forum). On aura besoin d'un rapport propre pour le parquet, avec la méthode et le journal des opérations.`,
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
          explanation: `La transaction ${testTx.hash.slice(0, 16)}… du ${fmtDate(testTx.time)} envoie ${amt(testValue, 'BTC')} du hot wallet ${de(exName)} vers l'adresse de l'escroc, bien avant le premier versement de victime. C'est un retrait, ordonné depuis un compte client ${de(exName)} : la plateforme peut retrouver ce compte à partir du hash et de l'adresse de destination. C'est une piste d'identification de premier ordre, à citer dans la réquisition.`,
        },
        {
          id: 'o11', type: 'choice', points: 8,
          prompt: `Comment traiter, dans l'analyse, ce versement venu du hot wallet ${de(exName)} ?`,
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
          id: 'o21', type: 'tx', points: 8,
          prompt: 'Parmi les entrées de l\'adresse de l\'escroc, quelle transaction n\'est qu\'une poussière, à écarter du recensement ?',
          answer: [dustTx.id],
          hint: 'Cherchez une entrée minuscule (quelques centaines de satoshis) venant d\'une adresse inconnue.',
          explanation: `La transaction ${dustTx.hash.slice(0, 16)}… du ${fmtDate(dustTx.time)} apporte 546 satoshis (0,00000546 BTC), le plus petit montant que le réseau accepte. Une adresse affichée publiquement sur un site attire ce genre d'envois (« dusting ») : des inconnus y déposent des miettes pour tenter de suivre ensuite les fonds, ou pour se faire de la publicité. Personne n'achète un contrat de minage pour quelques dizaines de centimes : ce n'est pas une victime. On l'écarte du nombre de victimes et du préjudice, et on le signale dans le rapport comme bruit identifié.`,
        },
        {
          id: 'o7', type: 'address', points: 8,
          prompt: 'Quelle victime a payé deux fois ? Donnez son adresse.',
          answer: [tw.addr],
          hint: 'Parmi les entrées de l\'adresse de l\'escroc, une adresse expéditrice est reliée par deux transactions.',
          explanation: `${A(w, tw.addr)} (${tw.name}) a envoyé deux versements, à quelques jours d'intervalle, pour ${amt(tw.total, 'BTC')} au total. Entre les deux, cette victime a reçu un faux « versement de production » : le second versement, plus confiant, est typique des fausses plateformes. Son portefeuille renvoie de plus le rendu sur l'adresse d'origine : on la voit en entrée et en sortie de ses deux transactions.`,
        },
        {
          id: 'o1', type: 'number', points: 10, unit: 'victimes',
          prompt: 'Combien de victimes distinctes ont payé l\'adresse de l\'escroc ?',
          answer: n,
          hint: 'Comptez les adresses qui envoient des fonds, pas les transactions : une victime a payé deux fois. Et ni l\'adresse d\'exchange ni l\'expéditeur de la poussière ne sont des victimes.',
          explanation: `${n} victimes, pour ${nTx} versements : ${tw.name} a payé deux fois depuis la même adresse. Le versement venant du hot wallet ${de(exName)} n'est pas une victime : c'est l'escroc qui alimente son adresse depuis son propre compte. L'expéditeur des 546 satoshis non plus : c'est de la poussière.`,
        },
        {
          id: 'o2', type: 'amount', points: 10, unit: 'BTC', tolerance: 0.002,
          prompt: 'Quel montant total (en BTC) les victimes ont-elles versé ?',
          answer: total,
          hint: 'Additionnez les versements des victimes, ou prenez le « Total reçu » de l\'adresse et retranchez ce qui ne vient pas d\'une victime.',
          explanation: `${amt(total, 'BTC')} au total (${victims.map((v) => amt(v.total, 'BTC')).join(' + ')}) : c'est le préjudice brut. Le « Total reçu » de l'adresse (${amt(receivedAll, 'BTC')}) est plus élevé : il compte aussi le retrait de l'escroc depuis ${exName} (${amt(testValue, 'BTC')}), la poussière (0,00000546 BTC) et les rendus que l'adresse s'est renvoyés à elle-même lors du faux gain. Le préjudice net tient compte du faux gain reversé à ${tw.name} (${amt(gainValue, 'BTC')}) : ${amt(Math.round((total - gainValue) * 1e8) / 1e8, 'BTC')}.`,
        },
        {
          id: 'o22', type: 'tx', points: 8,
          prompt: 'Quelle transaction sortante de l\'adresse de l\'escroc n\'est pas un encaissement mais un faux « gain » versé à une victime ?',
          answer: [gainTx.id],
          hint: 'Dépliez les sorties de l\'adresse de l\'escroc : une petite sortie retourne vers une adresse que vous avez marquée Victime.',
          explanation: `La transaction ${gainTx.hash.slice(0, 16)}… du ${fmtDate(gainTx.time)} envoie ${amt(gainValue, 'BTC')} à ${tw.name}, un à deux jours après son premier versement, et le rendu revient sur l'adresse de l'escroc. C'est le « versement de production » dont parle le forum : l'escroc reverse une petite partie de l'argent reçu pour mettre la victime en confiance, et elle a effectivement payé une seconde fois quelques jours plus tard. Ce n'est pas un encaissement : l'argent reste dans le dossier, chez une victime. Dans le rapport, on indique le préjudice brut ${de(tw.name)} (${amt(tw.total, 'BTC')}) et son préjudice net (${amt(twNet, 'BTC')}).`,
        },
        {
          id: 'o4', type: 'entity', points: 8,
          prompt: 'Sur quelle plateforme l\'escroc a-t-il encaissé les fonds ?',
          answer: [exKey],
          hint: 'Dépliez les sorties de l\'adresse de l\'escroc.',
          explanation: `Les ${amt(deposited, 'BTC')} sont envoyés en une fois vers une adresse de dépôt ${exName}. ${procedureFor(ex.entity)} Indice précieux : l'escroc avait déjà retiré des fonds ${de(exName)} vers cette adresse. Dans la réquisition, on cite donc à la fois l'adresse de dépôt et ce retrait.`,
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
          explanation: `${amt(deposited, 'BTC')} : tout le solde de l'adresse de l'escroc (versements des victimes, retrait préalable et même la poussière, moins le faux gain déjà reversé et ses frais), moins ${amt(outTx.fee, 'BTC')} de frais de réseau. Une transaction à une seule sortie, sans rendu, vide entièrement l'adresse : l'escroc ne garde rien sur place.`,
        },
        {
          id: 'o10', type: 'number', points: 8, unit: 'heures', tolerance: 1.5,
          prompt: 'Combien d\'heures se sont écoulées entre le dernier versement d\'une victime et l\'encaissement sur la plateforme ?',
          answer: delayH,
          hint: 'Repérez, parmi les versements des victimes, le plus récent, puis comparez sa date à celle de la transaction vers l\'adresse de dépôt.',
          explanation: `Dernier versement le ${fmtDate(lastPay)}, encaissement le ${fmtDate(outTx.time)} : environ ${delayH.toLocaleString('fr-FR')} heures. L'escroc a attendu la fin de sa campagne avant de tout sortir d'un bloc, puis le site a disparu. Pour le rapport, cette chronologie (préparation de l'adresse, versements, faux gain, encaissement, fermeture du site) éclaire le mode opératoire ; pour la réquisition, elle cadre la période de connexion à demander.`,
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
          explanation: 'Un rapport d\'analyse doit permettre à un tiers de refaire le raisonnement : chaque constatation renvoie à une adresse ou une transaction vérifiable, la méthode (heuristiques, outils) est exposée, ce qui a été écarté l\'est avec sa raison (retrait de l\'escroc, poussière, faux gain), et ce qui relève de l\'hypothèse (rattachements, attribution) est présenté comme tel. Le journal horodaté des opérations en garantit la traçabilité.',
        },
      ],
      truth: {
        path: [...victims.flatMap((v) => v.txs), testTx.id, gainTx.id, outTx.id, sweep.id],
        addresses: [scam, deposit, ...victims.map((v) => v.addr)],
        debrief:
          `Ce qui s'est passé :\n\n` +
          `1. Le ${fmtDate(testTx.time, false)}, ${prepDays} jours avant le premier versement d'une victime, l'escroc retire ${amt(testValue, 'BTC')} de son compte ${exName} vers ${full} (transaction ${testTx.hash.slice(0, 12)}…) : il prépare son adresse.\n` +
          `2. Le site ${brand} affiche cette même adresse à tous ses « clients ». ${n} victimes y versent ${amt(total, 'BTC')} en ${nTx} transactions :\n` +
          victims.map((v) => `- ${v.name} : ${amt(v.total, 'BTC')}${v.txs.length > 1 ? ` (${v.txs.length} versements)` : ''}`).join('\n') + `\n` +
          `3. Après le premier versement ${de(tw.name)}, l'escroc lui reverse ${amt(gainValue, 'BTC')} de faux « gain » (transaction ${gainTx.hash.slice(0, 12)}…) ; ${tw.g('mis', 'mise')} en confiance, ${tw.g('il', 'elle')} paie une seconde fois.\n` +
          `4. Environ ${delayH.toLocaleString('fr-FR')} heures après le dernier versement, l'escroc vide l'adresse en une transaction : ${amt(deposited, 'BTC')} sur l'adresse de dépôt ${exName} ${A(w, deposit)}, balayée ensuite vers le hot wallet.\n\n` +
          `Les intrus du dossier et comment les écarter :\n\n` +
          `- Le retrait depuis le hot wallet ${de(exName)} : pas une victime, mais l'escroc lui-même. Exclu du préjudice, cité dans la réquisition.\n` +
          `- Les 546 satoshis venus d'un inconnu (${dustTx.hash.slice(0, 12)}…) : de la poussière, attirée par une adresse publique. Ni victime ni piste.\n` +
          `- La petite sortie vers ${tw.name} : un faux gain, pas un encaissement. Il réduit son préjudice net, et il explique son second versement.\n\n` +
          `À retenir :\n\n` +
          `- Une adresse d'escroquerie partagée entre clients se lit par ses **Entrées** : chaque expéditeur est une victime potentielle, à confirmer. Une étiquette d'exchange ou un montant dérisoire disqualifient l'expéditeur.\n` +
          `- On compte des **victimes** (adresses expéditrices), pas des transactions, et on écarte ce qui n'est pas un préjudice (ici le retrait depuis l'exchange, qui est en revanche une excellente piste d'identification, et la poussière).\n` +
          `- Les **Sorties** se trient aussi : une sortie vers une victime connue est un faux gain, pas un encaissement. Le rapport distingue préjudice brut et net.\n` +
          `- Une même plateforme en amont (retrait) et en aval (dépôt) : deux points d'entrée pour une seule réquisition, qui se recoupent.\n` +
          `- Une adresse tronquée se retrouve avec la recherche, mais on vérifie toujours le début, la fin et la cohérence (montant, date, victime parmi les entrées).\n` +
          `- Le **marquage**, les **notes** et le **journal** alimentent directement le rapport : marquer au fil de l'eau, c'est rédiger le rapport en avançant.`,
      },
      hints: [
        'Le guide flotte en haut à gauche du graphe. Le bouton « Je bloque » de chaque étape donne le chemin exact.',
        'La recherche (champ « Adresse, transaction, entité… » en haut, ou Ctrl K) trouve une adresse à partir de quatre caractères consécutifs.',
        'Les Entrées d\'une adresse montrent qui lui a envoyé des fonds. Une étiquette « Hot Wallet » désigne une plateforme, pas une victime ; 546 satoshis, c\'est de la poussière.',
        'La date de chaque transaction figure dans son panneau (« Date (Paris) ») ; la frise (touche T) les place toutes sur un axe.',
      ],
      guide: [
        {
          title: 'Ouvrez la recherche',
          text:
            `Dans les **Pièces**, la capture montre une adresse **tronquée** : « ${shown} ». Elle n'est pas cliquable, car incomplète.\n\n` +
            `Ouvrez la **recherche** : champ « Adresse, transaction, entité… » dans la barre du haut, ou raccourci **Ctrl K**. Elle trouve les adresses, transactions et entités du dossier à partir d'un fragment d'au moins quatre caractères.`,
          tip: 'Barre du haut ▸ champ de recherche (« Adresse, transaction, entité… »), ou appuyez sur Ctrl et K en même temps.',
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
            `Les expéditeurs apparaissent à gauche, chacun relié à l'adresse par sa transaction (carré). Attention : tous ne sont pas des victimes. Nous allons **trier**.`,
          tip: 'Sélectionnez l\'adresse de l\'escroc ▸ bouton **Entrées** (flèche verte) du panneau Analyse. Ou clic droit sur le nœud ▸ « Déplier les entrées ».',
          check: { kind: 'txRevealed', tx: victims[n - 1].txs[0] },
        },
        {
          title: 'Repérez le premier intrus',
          text:
            `Parmi les expéditeurs, l'un porte une étiquette : **« ${exName} — Hot Wallet »**. Ce n'est pas une victime : c'est un **retrait** depuis ${exName} vers l'adresse de l'escroc, bien avant les faits. L'escroc a alimenté son adresse depuis son propre compte.\n\n` +
            `Cliquez le carré de cette transaction pour la lire. À écarter du préjudice, mais à garder précieusement : c'est une piste d'identification.`,
          tip: `Cliquez le petit carré relié au nœud « ${exName} — Hot Wallet ».`,
          check: { kind: 'selected', id: testTx.id },
        },
        {
          title: 'Citez ce retrait',
          text:
            `La transaction est sélectionnée : cliquez **« Utiliser la transaction sélectionnée »** dans l'objectif 2. Une transaction se cite par son **hash** (l'identifiant affiché en haut du panneau), avec sa date et son montant.\n\n` +
            `Puis répondez à l'objectif 3 : comment ce versement doit-il être traité dans l'analyse ?`,
          tip: `Carré relié à « ${exName} — Hot Wallet » sélectionné ▸ objectif 2 ▸ « Utiliser la transaction sélectionnée ».`,
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
          title: 'Écartez la poussière',
          text:
            `Second intrus : parmi les expéditeurs non attribués, l'un n'a envoyé que **546 satoshis** (0,00000546 BTC, quelques dizaines de centimes). Personne n'achète un contrat de minage pour ce prix : c'est de la **poussière** (« dusting »), qu'attire toute adresse affichée publiquement.\n\n` +
            `Cliquez ce carré et désignez la transaction dans l'objectif 4. Ne marquez pas son expéditeur comme victime.`,
          tip: 'Clic sur le carré d\'entrée au montant minuscule (0,00000546 BTC) ▸ objectif 4 ▸ « Utiliser la transaction sélectionnée ». Astuce : l\'onglet **Historique** de l\'adresse de l\'escroc liste les montants.',
          check: { kind: 'correct', objective: 'o21' },
        },
        {
          title: 'Marquez chaque victime',
          text:
            `Les autres expéditeurs, non attribués et aux montants bien plus importants (de ${amt(Math.min(...payVals), 'BTC')} à ${amt(Math.max(...payVals), 'BTC')} par versement), sont des victimes. Marquez **chacune** d'elles **Victime**, y compris ${g('le plaignant', 'la plaignante')} (comparez avec l'adresse de la plainte).\n\n` +
            `Attention : une victime a payé **deux fois** depuis la même adresse. Elle ne compte qu'une fois.`,
          tip: 'Pour chaque expéditeur non étiqueté, sauf celui de la poussière : clic droit ▸ « Marquer : Victime ». Contrôlez ensuite dans l\'onglet **Marqués** du Dossier.',
          check: { kind: 'flagged', address: victims[n - 1].addr, flag: 'victim' },
        },
        {
          title: 'Repérez la victime qui a payé deux fois',
          text:
            `Une des adresses victimes est reliée à l'escroc par **deux** carrés d'entrée : deux versements à quelques jours d'intervalle. Sélectionnez-la et utilisez-la dans l'objectif 5.\n\n` +
            `Ces relances (« frais », « taxe » de retrait, mise complémentaire…) sont typiques des fausses plateformes : nous verrons bientôt ce qui l'a décidée à payer de nouveau.`,
          tip: 'Cherchez le nœud victime d\'où partent deux transactions vers l\'escroc (ou, dans l\'Historique de l\'escroc, deux lignes entrantes venant de la même adresse) ▸ objectif 5 ▸ « Utiliser l\'adresse sélectionnée ».',
          check: { kind: 'correct', objective: 'o7' },
        },
        {
          title: 'Comptez les victimes',
          text:
            `Ouvrez l'onglet **Marqués** du Dossier : vos marquages sont regroupés par catégorie, avec leur nombre. C'est votre recensement.\n\n` +
            `Revenez à l'onglet Objectifs et saisissez le nombre de victimes dans l'objectif 6.`,
          tip: 'Dossier ▸ onglet **Marqués** ▸ lisez le chiffre entre parenthèses après « Victime ». Objectif 6 : saisissez ce nombre (sans le hot wallet ni la poussière).',
          check: { kind: 'correct', objective: 'o1' },
        },
        {
          title: 'Chiffrez le préjudice',
          text:
            `Deux méthodes, qui doivent concorder : additionner les versements des victimes (cliquez chaque carré et lisez la sortie vers l'escroc), ou partir de l'onglet **Historique** de l'adresse de l'escroc (lignes entrantes) et retrancher ce qui ne vient pas d'une victime : le retrait venu ${de(exName)} et la poussière.\n\n` +
            `Attention, le « Total reçu » affiché en haut du panneau compte aussi les rendus que l'adresse s'est renvoyés à elle-même : partez des lignes d'entrée. Saisissez le total en BTC dans l'objectif 7 (la virgule est acceptée).`,
          tip: 'Adresse de l\'escroc ▸ onglet **Historique** ▸ filtre « Entrantes » : additionnez les montants des victimes, sans la ligne « ' + exName + ' — Hot Wallet » ni les 546 satoshis.',
          check: { kind: 'correct', objective: 'o2' },
        },
        {
          title: 'Dépliez les sorties',
          text:
            `Dépliez maintenant les **sorties** de l'adresse de l'escroc (double-clic). Deux transactions apparaissent :\n\n` +
            `- une **petite** sortie, pendant la campagne, vers une adresse que vous avez déjà marquée **Victime** ;\n` +
            `- la sortie finale, qui vide toute l'adresse vers une **« ${exName} — Adresse de dépôt »**.`,
          tip: `Double-cliquez l'adresse de l'escroc ▸ repérez « ${exName} — Adresse de dépôt ». Touche L pour réorganiser le graphe.`,
          check: { kind: 'onGraph', address: deposit },
        },
        {
          title: 'Un faux gain',
          text:
            `Cliquez la petite sortie vers la victime. Elle arrive un à deux jours après son premier versement, et avant le second. Relisez le **forum** dans les Pièces : c'est un « versement de production », un faux gain reversé pour la mettre en confiance. Ça a marché : elle a payé de nouveau.\n\n` +
            `Ce n'est pas un encaissement. Désignez cette transaction dans l'objectif 8 : dans le rapport, elle distingue le préjudice **brut** de cette victime de son préjudice **net**.`,
          tip: 'Clic sur le carré entre l\'adresse de l\'escroc et la victime qui a payé deux fois (celui dont l\'escroc est l\'expéditeur) ▸ objectif 8 ▸ « Utiliser la transaction sélectionnée ».',
          check: { kind: 'correct', objective: 'o22' },
        },
        {
          title: 'Désignez l\'adresse de dépôt',
          text:
            `Renseignez la plateforme dans l'objectif 9, puis sélectionnez l'adresse de dépôt et utilisez-la dans l'objectif 10. C'est elle que vise la réquisition, jamais le hot wallet vers lequel elle sera balayée.\n\n` +
            `Remarquez la cohérence : la même plateforme apparaît **en amont** (le retrait qui a alimenté l'adresse) et **en aval** (le dépôt). Deux points d'entrée pour une seule réquisition, qui devraient mener au même titulaire.`,
          tip: `Objectif 9 : menu déroulant ▸ ${exName}. Puis clic sur « ${exName} — Adresse de dépôt » ▸ objectif 10 ▸ « Utiliser l'adresse sélectionnée ».`,
          check: { kind: 'correct', objective: 'o8' },
        },
        {
          title: 'Relevez le montant encaissé',
          text: `Cliquez le carré de la transaction d'encaissement : elle n'a qu'**une sortie**, vers l'adresse de dépôt (pas de rendu, l'adresse est vidée). Reportez son montant dans l'objectif 11.`,
          tip: 'Clic sur le carré entre l\'adresse de l\'escroc et l\'adresse de dépôt ▸ section **Sorties** ▸ montant. Saisissez-le dans l\'objectif 11.',
          check: { kind: 'correct', objective: 'o9' },
        },
        {
          title: 'Mesurez le délai d\'encaissement',
          text:
            `Retrouvez le **dernier** versement d'une victime (le plus récent des carrés d'entrée, poussière exclue) et comparez sa **Date (Paris)** à celle de la transaction d'encaissement. Saisissez l'écart en heures dans l'objectif 12 (une marge d'une heure et demie est tolérée).\n\n` +
            `Astuce : la **Frise** (touche T) place toutes les transactions du graphe sur un axe du temps, ce qui aide à repérer la plus récente.`,
          tip: 'Ouvrez chaque carré d\'entrée des victimes et notez sa date ; gardez la plus récente. Puis carré d\'encaissement ▸ « Date (Paris) ». Calculez l\'écart en heures.',
          check: { kind: 'correct', objective: 'o10' },
        },
        {
          title: 'Consultez le Journal',
          text:
            `Ouvrez l'onglet **Journal** du Dossier : chaque action (ajout d'adresse, dépliage, marquage…) y est **horodatée**. C'est la traçabilité de votre analyse : le magistrat ou la défense doivent pouvoir comprendre comment vous avez abouti à vos conclusions.\n\n` +
            `Ajoutez si vous le souhaitez une observation dans l'onglet **Notes** d'une adresse (ex. « retrait ${exName} préalable aux faits », « 546 sats : poussière écartée », « faux gain reçu ») : les notes sont reprises dans le rapport. Revenez ensuite ici.`,
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
          text: `Répondez à l'objectif 13, vérifiez que tous les objectifs sont remplis, puis cliquez **Remettre le rapport** pour lire le débriefing.`,
          tip: 'Objectif 13 : cochez une réponse ▸ bouton **Remettre le rapport** en bas de l\'onglet Objectifs.',
          check: { kind: 'answered', objective: 'o5' },
        },
      ],
    }
  },
}
