import { World, type Tx } from '../engine/world'
import { exchange, roundCoin, HOUR, DAY, type ExchangeKit } from '../engine/patterns'
import { createHdWallet, scanHdWallet } from '../engine/hd'
import { usd } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakePerson, fmtDate, procedureFor } from './util'

const r8 = (v: number) => Math.round(v * 1e8) / 1e8
const BRANDS = ['Livret Crypto Plus', 'Épargne Satoshi', 'Horizon Rendement BTC', 'Patrimoine Numérique Conseil', 'Bitcoin Garanti 12 %']
const INITIALS = ['M. B.', 'C. L.', 'J.-P. R.', 'A. D.', 'S. M.', 'F. G.', 'N. T.', 'H. V.', 'R. K.', 'E. P.']

/** Montant BTC lisible (pas de zéros inutiles). */
const btc = (v: number) => amt(r8(v), 'BTC')
/** Adresse tronquée telle qu'une interface l'affiche (non cliquable). */
const trunc = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`

export const btcHdPerquisition: ScenarioTemplate = {
  id: 'hd-perquisition',
  title: 'Perquisition : la zpub du tiroir',
  tagline: 'Une clé publique étendue griffonnée sur un carnet : tout le portefeuille, adresses cachées comprises.',
  description:
    'Lors de la perquisition chez l\'animateur présumé d\'un faux placement en bitcoins, les enquêteurs saisissent un portefeuille matériel, une feuille de récupération, un carnet portant une clé publique étendue (zpub) et un téléphone équipé d\'une application de suivi en lecture seule. Dérivez le portefeuille, chiffrez les avoirs, identifiez les comptes d\'exchange à requérir… et ne vous fiez pas au solde qu\'affiche l\'application.',
  difficulty: 3,
  chains: ['btc'],
  skills: ['utxo', 'cioh', 'exchange_id', 'requisition', 'gel'],
  estMinutes: 35,
  lessons: ['portefeuilles-hd', 'forensique-supports', 'gel-saisie', 'saisie-avancee', 'requisitions', 'cles-portefeuilles'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const sp = fakePerson(r)
    const ge = sp.g
    const brand = r.pick(BRANDS)
    const complainant = fakePerson(r)
    const opj = fakePerson(r)

    const keys = r.shuffle(['coinhouse', 'kraken', 'bitstamp', 'binance', 'coinbase'] as const)
    const exA = exchange(w, keys[0], 'btc')
    const exB = exchange(w, keys[1], 'btc')
    const cardhub = w.entity('cardhub')
    const suspect = w.customEntity({ name: `${sp.name} (mis en cause)`, category: 'suspect' })
    const victimE = w.customEntity({ name: complainant.name, category: 'victim' })
    const hd = createHdWallet(w, { chain: 'btc', kind: 'p2wpkh', entity: suspect, label: 'Portefeuille matériel (scellé n° 1)' })

    // ── Versements des victimes : une adresse de réception neuve par client ──
    const nV = r.int(8, 11)
    const named = r.int(1, 3)
    const pays: { tx: Tx; addr: string; idx: number; value: number; time: number; initials: string }[] = []
    let idx = 0
    let t = w.at(0)
    const initials = r.shuffle([...INITIALS])
    for (let i = 0; i < nV; i++) {
      const a = hd.receive(idx)
      const value = roundCoin(w, 0.03, 0.32, 0.001)
      const va = i === named ? w.addr('btc', { entity: victimE, kind: 'p2wpkh' }) : w.addr('btc')
      const tx = w.fund(a, value, t, { from: [va] })
      pays.push({ tx, addr: a, idx, value, time: t, initials: initials[i % initials.length] })
      // Adresse remise à un prospect qui n'a finalement rien versé : index sauté
      idx += r.chance(0.3) ? 2 : 1
      t += Math.round(r.float(1.5, 5) * DAY)
    }
    const lastIdx = pays[pays.length - 1].idx
    const victimPay = pays[named]

    // ── Dépenses : dépôts sur deux exchanges, un achat, rendus sur la branche 1 ──
    let ci = 0
    const deposits: { ex: ExchangeKit; addr: string; tx: Tx; value: number; sweep: Tx }[] = []
    const spends: Tx[] = []
    const pool = (time: number) =>
      hd.derived().map((d) => d.id).filter((id) => w.unspentValue(id, time) > 1e-8)
        .sort((a, b) => w.unspentValue(b, time) - w.unspentValue(a, time))
    const spend = (time: number, to: string, want: number | ((avail: number) => number)) => {
      const p = pool(time)
      const avail = p.reduce((s, id) => s + w.unspentValue(id, time), 0)
      const target = typeof want === 'number' ? want : want(avail)
      const chosen: string[] = []
      let acc = 0
      for (const id of p) {
        if (acc >= target + 0.0005) break
        chosen.push(id)
        acc += w.unspentValue(id, time)
      }
      const value = Math.floor(Math.min(target, acc - 0.0004) * 1000) / 1000
      const tx = w.utxoTx({ time, from: chosen, to: [{ address: to, value }], change: hd.change(ci++), spendAll: true })
      spends.push(tx)
      return { tx, value }
    }
    const deposit = (ex: ExchangeKit, time: number, frac: number) => {
      const addr = ex.newDeposit()
      const { tx, value } = spend(time, addr, (a) => a * frac)
      const sweep = ex.sweep([addr], time + Math.round(r.float(1, 8) * HOUR))[0]
      deposits.push({ ex, addr, tx, value, sweep })
    }
    const at = (k: number) => pays[Math.min(pays.length - 1, k)].time + Math.round(r.float(5, 30) * HOUR)
    deposit(exA, at(Math.floor(nV * 0.4)), r.float(0.6, 0.75))
    const invoice = w.addr('btc', { entity: cardhub, label: 'CardHub — Facture', tags: ['invoice'] })
    const cardSpend = spend(at(Math.floor(nV * 0.55)), invoice, roundCoin(w, 0.004, 0.012, 0.0001))
    deposit(exB, at(Math.floor(nV * 0.75)), r.float(0.3, 0.45))
    deposit(exA, at(nV - 1) + Math.round(r.float(1, 3) * DAY), r.float(0.5, 0.65))
    const tLast = Math.max(...deposits.map((d) => d.sweep.time), cardSpend.tx.time)

    // ── Factures du logiciel d'encaissement : index de dérivation consommés ──
    // Le logiciel dérive une adresse par facture ; les factures impayées
    // laissent des adresses vides : l'écart dépasse la limite par défaut (20).
    const hIdx = lastIdx + r.int(24, 34)
    const h2Idx = hIdx + r.int(2, 4)
    const otherMax = Math.max(...hd.derived().map((d) => w.unspentValue(d.id)))
    const bigValue = Math.max(roundCoin(w, 0.45, 1.6, 0.01), Math.ceil(otherMax * r.float(1.5, 2.2) * 100) / 100)
    const smallValue = roundCoin(w, 0.004, 0.02, 0.0001)
    const tBig = pays[Math.floor(nV * 0.6)].time + Math.round(r.float(6, 40) * HOUR)
    const hBig = hd.receive(hIdx)
    const hSmall = hd.receive(h2Idx)
    const bigTx = w.fund(hBig, bigValue, tBig, { senders: 1 })
    const smallTx = w.fund(hSmall, smallValue, tBig + Math.round(r.float(2, 9) * DAY), { senders: 1 })

    // ── Bruit ──
    exA.noise(12, w.at(-10 * 24), tLast + 5 * DAY)
    exB.noise(10, w.at(-10 * 24), tLast + 5 * DAY)

    // ── Vérité : portefeuille complet vs vue de l'application (gap 20) ──
    const used = hd.used()
    const usedReceive = used.filter((id) => w.get(id).hd!.path.split('/')[4] === '0')
    const usedChange = used.length - usedReceive.length
    const total = r8(used.reduce((s, id) => s + w.unspentValue(id), 0))
    const appScan = scanHdWallet(w, hd.xpub, { gap: 20 })!
    const appUsed = [...appScan.receive, ...appScan.change].filter((x) => x.used)
    const appTotal = r8(appUsed.reduce((s, x) => s + w.unspentValue(x.id), 0))
    const tPerq = Math.max(tLast, smallTx.time) + Math.round(r.float(3, 12) * DAY)
    const tArrest = tPerq - Math.round(r.float(6, 9) * HOUR)

    const byEx = new Map<string, number>()
    for (const d of deposits) byEx.set(d.ex.entity.id, (byEx.get(d.ex.entity.id) ?? 0) + d.value)
    const mainEx = [...byEx.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const mainKit = mainEx === exA.entity.id ? exA : exB
    const otherKit = mainKit === exA ? exB : exA
    const totalVictims = r8(pays.reduce((s, p) => s + p.value, 0))
    const pvNum = `${r.int(10, 99)}/${String(r.int(1, 9999)).padStart(5, '0')}`
    const nInvoices = h2Idx - lastIdx + r.int(2, 6)
    const shownReq = r.shuffle([...pays]).slice(0, 4).sort((a, b) => a.idx - b.idx)

    return {
      world: w,
      title: `Faux placement « ${brand} » — ${city}`,
      briefing:
        `Depuis plusieurs mois, le site « ${brand} » promet un rendement garanti sur un « livret » en bitcoins. Les épargnants versent des bitcoins sur une adresse que leur « conseiller » leur communique par courriel, une adresse différente pour chaque client. Aucun intérêt n'a jamais été versé ; ${pays.length} versements ont été recensés à partir des plaintes et des premières constatations.\n\n` +
        `${sp.name}, ${ge('identifié', 'identifiée')} comme l'animateur présumé, a été ${ge('interpellé', 'interpellée')} à son domicile de ${city}. La perquisition a permis de saisir un portefeuille matériel, une feuille de récupération, un carnet et un téléphone. Le carnet porte une clé publique étendue (zpub) ; le téléphone contient une application de suivi en lecture seule.\n\n` +
        `Le magistrat souhaite savoir, avant la fin de la garde à vue, ce que détient réellement ce portefeuille, où sont partis les fonds déjà sortis et comment sécuriser ce qui reste. Utilisez l'outil « Dérivation HD » (cliquez sur la zpub dans les pièces) et confrontez son résultat aux autres pièces.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: victimPay.time + Math.round(r.float(20, 50) * DAY), author: complainant.name,
          body:
            `« J'ai été démarché${complainant.female ? 'e' : ''} par téléphone par un conseiller de « ${brand} » qui m'a promis 12 % par an. Il m'a envoyé par courriel une adresse « personnelle et sécurisée » pour mon livret : ${A(w, victimPay.addr)}. ` +
            `J'ai acheté ${btc(victimPay.value)} sur une application et je les ai envoyés le ${fmtDate(victimPay.time)}. Référence de la transaction : ${victimPay.tx.hash}. Depuis, le site ne répond plus. »`,
        },
        {
          id: 'perquisition', type: 'perquisition', title: `Procès-verbal de perquisition (extrait) — PV n° ${pvNum}`, date: tPerq, author: `${opj.name}, officier de police judiciaire`,
          body:
            `Le ${fmtDate(tPerq)}, au domicile de ${sp.name} à ${city}, en sa présence constante, assisté${opj.female ? 'e' : ''} de deux enquêteurs de la section de recherches.\n\n` +
            `Découvrons et saisissons :\n` +
            `- scellé n° 1 : un portefeuille matériel (boîtier noir, port USB-C) dans sa boîte d'origine, rangé dans le tiroir du bureau ;\n` +
            `- scellé n° 2 : une carte cartonnée portant 24 mots manuscrits (phrase de récupération). Les mots ne sont pas reproduits au présent procès-verbal ; la carte est placée sous enveloppe scellée, sans photographie ;\n` +
            `- scellé n° 3 : un carnet à spirale ; page 14, une chaîne de caractères manuscrite commençant par « zpub » (voir photographie jointe) ;\n` +
            `- scellé n° 4 : un smartphone, découvert déverrouillé sur la table du salon, aussitôt placé en mode avion puis dans une pochette d'isolement ;\n` +
            `- scellé n° 5 : un ordinateur portable, éteint, découvert dans la chambre.\n\n` +
            `Interrogé${ge('', 'e')} sur la nature du boîtier, ${sp.name} déclare : « C'est mon épargne personnelle, il n'y a presque rien dessus, regardez l'appli. »`,
        },
        {
          id: 'carnet', type: 'capture', title: 'Photographie du scellé n° 3 — carnet, page 14 (description)', date: tPerq, author: 'Section de recherches — technicien en identification criminelle',
          body:
            `Écriture manuscrite au stylo bleu, partiellement raturée en haut de page (« achats 2e trimestre ? »).\n` +
            `Au centre, encadré : « clé publique — NE PAS PERDRE — compte 0 »\n` +
            `${hd.xpub}\n` +
            `En dessous : « appli de suivi = lecture seule. Boîtier = signature. »`,
        },
        {
          id: 'appli', type: 'extraction', title: 'Extraction du smartphone (scellé n° 4) — application de suivi en lecture seule', date: tPerq + Math.round(r.float(1, 3) * DAY), author: 'Section de recherches — cellule d\'appui numérique',
          body:
            `Extraction logique réalisée sur copie de travail, empreinte SHA-256 de l'image consignée au procès-verbal.\n\n` +
            `Application : portefeuille « Épargne » — mode « lecture seule (watch-only) »\n` +
            `Clé importée : ${hd.xpub}\n` +
            `Type : SegWit natif (BIP 84), compte 0\n` +
            `Limite d'écart (gap limit) : 20 (valeur par défaut)\n` +
            `Dernière synchronisation : ${fmtDate(tPerq - Math.round(r.float(2, 10) * HOUR))}\n` +
            `Adresses utilisées affichées : ${appUsed.length}\n` +
            `Solde affiché : ${btc(appTotal)}\n\n` +
            `Aucune clé privée n'est présente dans l'application (signature déléguée au portefeuille matériel).`,
        },
        {
          id: 'encaissement', type: 'extraction', title: 'Extraction de l\'ordinateur portable — logiciel d\'encaissement (export)', date: tPerq + Math.round(r.float(2, 5) * DAY), author: 'Section de recherches — cellule d\'appui numérique',
          body:
            `Logiciel d'encaissement auto-hébergé, configuré avec la même clé publique étendue (une adresse dérivée par facture). Export de l'historique :\n\n` +
            `Factures « grands comptes » générées : ${nInvoices} — payées : 2 — expirées sans paiement : ${nInvoices - 2}\n` +
            `- Facture « ${initials[(nV + 1) % initials.length]} » — ${btc(bigValue)} — payée le ${fmtDate(bigTx.time)} — adresse ${trunc(A(w, hBig))}\n` +
            `- Facture « ${initials[(nV + 2) % initials.length]} » — ${btc(smallValue)} — payée le ${fmtDate(smallTx.time)} — adresse ${trunc(A(w, hSmall))}\n\n` +
            `Courriels de l'application téléphonique (demandes de paiement envoyées aux clients, extraits) :\n` +
            shownReq.map((p) => `- « ${p.initials} » — ${btc(p.value)} — adresse ${trunc(A(w, p.addr))}`).join('\n'),
        },
        {
          id: 'note', type: 'note', title: 'Note de la cellule d\'appui — portefeuilles HD', date: tPerq - 30 * DAY, author: 'Groupe d\'appui crypto-actifs',
          body:
            `- Une clé publique étendue (xpub / ypub / zpub) permet de recalculer toutes les adresses d'un compte : réception (branche 0) et rendu (branche 1). Elle ne permet ni de signer ni de dépenser.\n` +
            `- Un logiciel de portefeuille arrête de chercher après un certain nombre d'adresses consécutives sans transaction (gap limit). Ce qu'il affiche n'est donc pas forcément tout ce que contient le portefeuille.\n` +
            `- Les sorties vers des adresses de dépôt d'exchange désignent des comptes clients identifiables par réquisition.`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'choice', points: 10,
          prompt: 'Que permet, à elle seule, la clé publique étendue relevée sur le carnet ?',
          ...choice(r,
            'Recalculer et surveiller toutes les adresses du compte, sans pouvoir dépenser',
            [
              'Signer des transactions et vider le portefeuille vers un compte de saisie',
              'Consulter le solde de la première adresse de réception, et elle seule',
              'Obtenir l\'identité du titulaire auprès du fabricant du boîtier',
            ]),
          explanation: `Une zpub (BIP 84) est une clé publique : elle permet de dériver toutes les adresses du compte, passées et futures, sur les branches de réception et de rendu, donc de reconstituer l'historique et de surveiller le portefeuille. Elle ne contient aucune clé privée : impossible de signer, donc de saisir les fonds avec elle seule. Le fabricant d'un portefeuille matériel ne détient ni les clés ni l'identité de l'utilisateur.`,
        },
        {
          id: 'o2', type: 'number', points: 15, tolerance: 1, unit: 'adresses',
          prompt: 'Combien d\'adresses de ce portefeuille (réception et rendu confondus) ont été réellement utilisées ?',
          answer: used.length,
          hint: 'L\'outil « Dérivation HD » compte les adresses utilisées. Le résultat dépend de la limite d\'écart choisie : confrontez-le à l\'export du logiciel d\'encaissement.',
          explanation: `${used.length} adresses : ${usedReceive.length} de réception et ${usedChange} de rendu. Avec la limite par défaut (20), l'outil comme l'application n'en trouvent que ${appUsed.length} : les deux adresses dérivées pour les factures payées (index ${hIdx} et ${h2Idx}) se trouvent après plus de 20 adresses vides, laissées par les factures expirées.`,
        },
        {
          id: 'o3', type: 'address', points: 20,
          prompt: 'Quelle adresse du portefeuille détient aujourd\'hui le solde le plus élevé ?',
          answer: [hBig],
          hint: 'L\'export du logiciel d\'encaissement mentionne des factures payées dont l\'adresse n\'apparaît pas dans la liste par défaut. Augmentez la limite d\'écart dans l\'outil.',
          explanation: `${A(w, hBig)} (chemin m/84'/0'/0'/0/${hIdx}) détient ${btc(bigValue)}, versés le ${fmtDate(bigTx.time)} pour la facture « grands comptes ». Elle est invisible avec la limite d'écart par défaut : entre l'index ${lastIdx} (dernière adresse remise à un client par l'application) et l'index ${hIdx}, le logiciel d'encaissement a consommé ${hIdx - lastIdx - 1} adresses restées vides. Il faut porter la limite à 50 pour la faire apparaître.`,
        },
        {
          id: 'o4', type: 'amount', points: 15, unit: 'BTC', tolerance: 0.005,
          prompt: 'Quel montant total (en BTC) ce portefeuille détient-il encore, toutes adresses confondues ?',
          answer: total,
          hint: 'Additionnez le solde de chaque adresse utilisée, sur les deux branches, après un balayage complet. Le solde affiché par l\'application n\'est pas une référence.',
          explanation: `${btc(total)} (≈ ${Math.round(usd('BTC', total)).toLocaleString('fr-FR')} $), dont ${btc(r8(bigValue + smallValue))} sur les deux adresses de factures. L'application n'affiche que ${btc(appTotal)} : elle s'arrête à la limite de 20 adresses vides. C'est précisément ce que le mis en cause invitait à « regarder ». Le montant à saisir doit être établi par un balayage complet, puis confirmé au moment du transfert.`,
        },
        {
          id: 'o5', type: 'addresses', points: 15,
          prompt: 'Sélectionnez toutes les adresses de dépôt d\'exchange alimentées par ce portefeuille.',
          answer: deposits.map((d) => d.addr),
          hint: 'Ajoutez au graphe toutes les adresses utilisées (bouton de l\'outil) puis dépliez leurs sorties : les adresses de dépôt sont étiquetées et balayées vers un hot wallet.',
          explanation:
            `${deposits.length} dépôts :\n` +
            deposits.map((d) => `- ${d.ex.entity.name} ${A(w, d.addr)} : ${btc(d.value)} le ${fmtDate(d.tx.time)}`).join('\n') +
            `\nChaque adresse de dépôt est propre à un compte client : c'est la donnée à citer dans la réquisition. Le paiement CardHub (${btc(cardSpend.value)}) est un achat de cartes cadeaux, pas un compte à requérir en priorité.`,
        },
        {
          id: 'o6', type: 'entity', points: 10,
          prompt: 'Quelle plateforme a reçu le plus de fonds depuis ce portefeuille ?',
          answer: [mainEx],
          explanation: `${mainKit.entity.name} a reçu ${btc(byEx.get(mainEx)!)} contre ${btc(byEx.get(otherKit.entity.id) ?? 0)} pour ${otherKit.entity.name}. Les deux plateformes sont à requérir (identité, IP, IBAN de retrait, solde), en priorité ${mainKit.entity.name}. ${procedureFor(mainKit.entity)}`,
        },
        {
          id: 'o7', type: 'choice', points: 15,
          prompt: 'Comment sécuriser les fonds encore présents sur ce portefeuille ?',
          ...choice(r,
            'Sur instruction du magistrat, transférer vers le portefeuille de saisie du service, à deux, chaque étape au PV',
            [
              'Restaurer la phrase sur le téléphone d\'un enquêteur pour déplacer les fonds au plus vite, puis rédiger le PV',
              'Transférer les fonds à l\'aide de la zpub, ce qui évite de manipuler la phrase de récupération sous scellé',
              'Laisser les fonds en place et demander au fabricant du boîtier de bloquer l\'appareil à distance',
            ]),
          explanation: `Seule la phrase de récupération (ou le boîtier et son code) permet de signer. La saisie consiste à transférer les fonds vers un portefeuille contrôlé par l'État (portefeuille de saisie du service, puis gestion par l'AGRASC), sur instruction du magistrat, depuis un poste dédié, sous double contrôle, en consignant au procès-verbal les adresses, montants et hash de transaction. On ne restaure jamais une phrase sur un équipement personnel (sécurité, traçabilité, loyauté de la preuve). La zpub ne donne aucun pouvoir de dépense et aucun fabricant ne peut bloquer un portefeuille auto-hébergé. Le transfert doit couvrir toutes les adresses, y compris celles au-delà de la limite d'écart.`,
        },
      ],
      truth: {
        path: [...pays.map((p) => p.tx.id), ...spends.map((x) => x.id), ...deposits.map((d) => d.sweep.id), bigTx.id, smallTx.id],
        addresses: [...used, ...deposits.map((d) => d.addr)],
        debrief:
          `1. ${pays.length} épargnants versent au total ${btc(totalVictims)}, chacun sur une adresse de réception neuve du même portefeuille HD (index 0 à ${lastIdx}, quelques index sautés pour des prospects qui n'ont pas payé).\n` +
          `2. Le mis en cause dépense depuis ces adresses : ${deposits.length} dépôts (${deposits.map((d) => `${d.ex.entity.name} ${btc(d.value)}`).join(', ')}) et un achat CardHub. Chaque rendu revient sur la branche de rendu (m/84'/0'/0'/1/i) : ${usedChange} adresses de rendu utilisées.\n` +
          `3. En parallèle, un logiciel d'encaissement branché sur la même zpub crée une adresse par facture. ${nInvoices - 2} factures expirent sans paiement, ce qui laisse plus de 20 adresses vides consécutives ; deux factures sont payées, sur les index ${hIdx} (${btc(bigValue)}) et ${h2Idx} (${btc(smallValue)}).\n` +
          `4. L'application de suivi, réglée sur une limite d'écart de 20, s'arrête avant ces adresses et affiche ${btc(appTotal)}. Le portefeuille détient en réalité ${btc(total)} sur ${used.length} adresses.\n\n` +
          `À retenir : une clé publique étendue trouvée en perquisition est une pièce majeure. Elle relie avec certitude toutes les adresses d'un compte (bien plus fort qu'une heuristique), permet de chiffrer les avoirs et de désigner les comptes d'exchange à requérir. Mais le résultat dépend de la limite d'écart : en cas de doute (logiciel d'encaissement, factures, index élevés dans les pièces), on balaie large. Une même graine peut aussi porter d'autres comptes (compte 1, autres schémas) que cette seule clé ne montre pas. Pour saisir, il faut la phrase ou le boîtier : transfert vers le portefeuille de saisie sur instruction du magistrat, à deux, tout au procès-verbal.`,
      },
      hints: [
        'Cliquez sur la zpub dans la photographie du carnet : l\'outil « Dérivation HD » s\'ouvre sur ce portefeuille.',
        'Comparez le nombre d\'adresses et le solde que donne l\'outil avec ceux de l\'application : identiques avec la limite par défaut… mais l\'export du logiciel d\'encaissement mentionne des factures payées absentes de la liste.',
        'Montez la limite d\'écart (gap limit) à 50 : 20 adresses vides consécutives ne prouvent pas que le portefeuille s\'arrête là.',
        'Ajoutez toutes les adresses utilisées au graphe et dépliez leurs sorties : les adresses étiquetées « Adresse de dépôt » désignent les comptes à requérir.',
      ],
    }
  },
}

