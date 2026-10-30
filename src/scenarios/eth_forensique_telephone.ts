import { World, type Tx } from '../engine/world'
import { dex, exchange, swapper, HOUR, DAY } from '../engine/patterns'
import { createEvmSeedAccounts } from '../engine/hd'
import { roundAsset } from '../engine/chains'
import type { ScenarioTemplate } from './types'
import { A, amt, choice, fakeCity, fakeHandle, fakePerson, fmtDate, procedureFor } from './util'

const usdt = (v: number) => amt(roundAsset('USDT', v), 'USDT')
const r100 = (v: number) => Math.round(v / 100) * 100
const PLATFORMS = ['NovaTrade Pro', 'Quantix Capital', 'BlueOak Markets', 'Stellaris FX', 'Ardent Invest']

export const ethForensiqueTelephone: ScenarioTemplate = {
  id: 'forensique-telephone',
  title: 'Le téléphone du gestionnaire',
  tagline: 'Une extraction de téléphone, une phrase de récupération dans les notes : les comptes que l\'application ne montrait pas.',
  description:
    'Le téléphone d\'un « gestionnaire de comptes » d\'une fausse plateforme de trading a été saisi et exploité. On y trouve une application de portefeuille multi-chaînes, une phrase de récupération recopiée dans les notes et des conversations Telegram avec un acheteur d\'USDT. Retrouvez les comptes dérivés absents de l\'application, reliez-les aux versements des victimes, suivez la conversion vers Tron et la revente de gré à gré, puis identifiez la plateforme de cash-out.',
  difficulty: 3,
  chains: ['eth', 'tron'],
  skills: ['evm', 'tokens', 'tron', 'crosschain', 'exchange_id', 'requisition'],
  estMinutes: 60,
  lessons: ['forensique-supports', 'portefeuilles-hd', 'echangeurs-instantanes', 'tron-usdt', 'dab-cash-p2p', 'requisitions'],
  generate(seed) {
    const w = new World(seed)
    const r = w.rng
    const city = fakeCity(r)
    const sp = fakePerson(r)
    const ge = sp.g
    const handle = fakeHandle(r)
    const buyerHandle = `${r.pick(['cashflow', 'otc_lyon', 'change_rapide', 'usdt_dispo', 'kash'])}${r.int(10, 99)}`
    const platform = r.pick(PLATFORMS)
    const complainant = fakePerson(r)

    // ── Acteurs ──────────────────────────────────────────────────────────────
    const fundKey = r.pick(['kraken', 'coinbase', 'bitstamp'] as const)
    const fundEx = exchange(w, fundKey, 'eth')
    const exV = exchange(w, 'coinhouse', 'eth')
    const cashKey = r.pick(['okx', 'binance'] as const)
    const cashEx = exchange(w, cashKey, 'tron')
    const cn = swapper(w, 'changenow')
    const uni = dex(w, 'uniswap', 'eth')
    const suspect = w.customEntity({ name: `${sp.name} (mis en cause)`, category: 'suspect' })
    const victimE = w.customEntity({ name: complainant.name, category: 'victim' })
    const buyerE = w.customEntity({ name: `@${buyerHandle} (acheteur, non identifié)`, category: 'individual' })

    const sk = createEvmSeedAccounts(w, { count: 5, entity: suspect, label: 'Phrase trouvée dans les notes du téléphone' })
    const [acc0, acc1, acc2, acc3, acc4] = sk.accounts
    const tApp = w.addr('tron', { entity: suspect })
    const buyer = w.addr('tron', { entity: buyerE })

    // ── Préparation : compte principal, compte perso, frais de gas ───────────
    const t0 = w.at(0)
    const fundTx = fundEx.withdraw(acc0, roundAsset('ETH', r.float(0.4, 0.9)), t0 - r.int(14, 25) * DAY, 'ETH')
    const toAcc1 = w.transfer({ time: t0 - r.int(9, 12) * DAY, from: acc0, to: acc1, value: roundAsset('ETH', r.float(0.05, 0.09)), asset: 'ETH' })
    const persoSwap = uni.swap({ trader: acc1, assetIn: 'ETH', amountIn: roundAsset('ETH', r.float(0.02, 0.04)), assetOut: 'USDC', time: toAcc1.time + Math.round(r.float(3, 30) * HOUR) })
    const gas = (to: string, time: number) => w.transfer({ time, from: acc0, to, value: roundAsset('ETH', r.float(0.008, 0.02)), asset: 'ETH' })
    const gasTxs: Tx[] = [gas(acc2, t0 - Math.round(r.float(30, 60) * HOUR)), gas(acc3, t0 - Math.round(r.float(8, 28) * HOUR))]
    const trxTx = cashEx.withdraw(tApp, r.int(150, 400), t0 - r.int(5, 12) * DAY, 'TRX')

    // ── Versements des victimes (USDT ERC-20) ────────────────────────────────
    const nV = r.int(6, 9)
    const targets = r.shuffle([acc2, acc2, acc3, acc3, ...Array.from({ length: nV - 4 }, () => r.pick([acc2, acc3]))])
    const named = r.int(0, 2)
    const pays: { tx: Tx; to: string; value: number; time: number }[] = []
    let t = t0
    for (let i = 0; i < nV; i++) {
      const v = i === named ? w.addr('eth', { entity: victimE }) : w.addr('eth')
      const value = r.int(8, 150) * 100
      exV.withdraw(v, value + r.int(0, 3) * 100, t - Math.round(r.float(3, 40) * HOUR), 'USDT')
      pays.push({ tx: w.transfer({ time: t, from: v, to: targets[i], value, asset: 'USDT' }), to: targets[i], value, time: t })
      t += Math.round(r.float(0.8, 3.5) * DAY)
    }
    const victimPay = pays[named]
    const totalVictims = pays.reduce((s, p) => s + p.value, 0)

    // ── Regroupement sur le compte 4, puis conversion vers Tron (ChangeNOW) ──
    const half = Math.floor(nV / 2)
    const fwdTxs: Tx[] = []
    // Soldes suivis dans l'ordre chronologique (les versements sont déjà tous générés)
    let lastF = -Infinity
    const sweepTo4 = (time: number): number => {
      let moved = 0
      for (const a of [acc2, acc3]) {
        const bal = pays.filter((p) => p.to === a && p.time > lastF && p.time <= time).reduce((s, p) => s + p.value, 0)
        if (bal > 0.5) {
          fwdTxs.push(w.transfer({ time: time + r.int(60, 1800), from: a, to: acc4, value: roundAsset('USDT', bal), asset: 'USDT' }))
          moved += bal
        }
      }
      lastF = time
      return roundAsset('USDT', moved)
    }
    const tF1 = pays[half - 1].time + Math.round(r.float(4, 16) * HOUR)
    gasTxs.push(gas(acc4, tF1 - Math.round(r.float(1, 3) * HOUR)))
    const m1 = sweepTo4(tF1)
    const tO1 = tF1 + Math.round(r.float(2, 8) * HOUR)
    const o1 = cn.order({ from: acc4, value: m1, asset: 'USDT', time: tO1, toChain: 'tron', toAsset: 'USDT', recipient: tApp, delayMin: [8, 35], decoys: r.int(4, 7) })
    const tF2 = pays[nV - 1].time + Math.round(r.float(4, 16) * HOUR)
    const m2 = sweepTo4(tF2)
    // Erreur de cloisonnement : une « part » quitte le compte de regroupement vers le compte « Perso »
    const cut = Math.max(100, r100(m2 * r.float(0.06, 0.12)))
    const persoTx = w.transfer({ time: tF2 + Math.round(r.float(0.6, 1.6) * HOUR), from: acc4, to: acc1, value: cut, asset: 'USDT' })
    const tO2 = tF2 + Math.round(r.float(2, 8) * HOUR)
    const o2 = cn.order({ from: acc4, value: roundAsset('USDT', m2 - cut), asset: 'USDT', time: tO2, toChain: 'tron', toAsset: 'USDT', recipient: tApp, delayMin: [8, 35], decoys: r.int(4, 7) })
    // Le compte « Perso » dépose cette part sur la plateforme qui a fourni l'ETH du compte principal
    const persoDep = fundEx.receive(acc1, cut, persoTx.time + Math.round(r.float(20, 80) * HOUR), { asset: 'USDT', sweepDelayH: r.float(0.3, 3) })
    // Autres clients de l'échangeur (dépôts USDT sur Ethereum)
    for (let i = 0; i < r.int(4, 6); i++) {
      const toChain = r.pick(['tron', 'btc'] as const)
      cn.order({ from: w.addr('eth'), value: roundAsset('USDT', r.float(400, 18000)), asset: 'USDT', time: Math.round(r.float(t0 - 5 * DAY, tO2 + 5 * DAY)), toChain, toAsset: toChain === 'tron' ? 'USDT' : 'BTC', recipient: w.addr(toChain), decoys: r.int(1, 3) })
    }

    // ── Revente de gré à gré (Telegram) puis dépôt du reliquat ───────────────
    const p1 = o1.payoutValue
    const p2 = o2.payoutValue
    const d1 = Math.min(r100(p1 * r.float(0.55, 0.8)), Math.floor(p1 / 100) * 100)
    const tD1 = o1.payoutTx.time + Math.round(r.float(5, 30) * HOUR)
    const deal1 = w.transfer({ time: tD1, from: tApp, to: buyer, value: d1, asset: 'USDT' })
    const d2 = r100((p1 + p2 - d1) * r.float(0.35, 0.5))
    const d2ask = d2 + r.int(10, 25) * 100
    const tD2 = o2.payoutTx.time + Math.round(r.float(5, 30) * HOUR)
    const deal2 = w.transfer({ time: tD2, from: tApp, to: buyer, value: d2, asset: 'USDT' })
    const rest = roundAsset('USDT', w.balanceOf(tApp, 'USDT'))
    const cashDep = cashEx.receive(tApp, rest, tD2 + Math.round(r.float(6, 30) * HOUR), { asset: 'USDT', sweepDelayH: r.float(0.3, 3) })
    // L'acheteur achète aussi à d'autres vendeurs
    for (let i = 0; i < r.int(2, 4); i++) w.transfer({ time: Math.round(r.float(t0, tD2 + 3 * DAY)), from: w.addr('tron'), to: buyer, value: r100(r.float(2000, 15000)), asset: 'USDT' })

    // ── Bruit ────────────────────────────────────────────────────────────────
    fundEx.noise(10, t0 - 30 * DAY, tD2 + 10 * DAY, 'ETH')
    exV.noise(8, t0 - 30 * DAY, tD2 + 10 * DAY, 'USDT')
    cashEx.noise(14, t0 - 10 * DAY, tD2 + 10 * DAY, 'USDT')
    uni.noise(10, t0 - 20 * DAY, tD2 + 5 * DAY)

    const tSeize = cashDep.tx.time + Math.round(r.float(4, 15) * DAY)
    const tExtract = tSeize + Math.round(r.float(2, 6) * DAY)
    const sold = d1 + d2
    const priceEur = (0.9 + r.int(0, 4) / 100).toFixed(2).replace('.', ',')
    const hidden = [acc2, acc3, acc4]
    const nOnAcc2 = pays.filter((p) => p.to === acc2).length
    const fundName = fundEx.entity.name

    return {
      world: w,
      title: `Exploitation d'un téléphone — « ${platform} » (${city})`,
      briefing:
        `Une fausse plateforme de trading, « ${platform} », a démarché des épargnants par téléphone : après un premier « investissement » modeste et des gains fictifs affichés sur le site, les victimes étaient incitées à verser des montants croissants en USDT (réseau Ethereum) sur des « adresses de dépôt » communiquées par leur gestionnaire de compte.\n\n` +
        `${sp.name}, ${ge('soupçonné', 'soupçonnée')} d'être l'un de ces gestionnaires, a été ${ge('interpellé', 'interpellée')} à ${city}. Son téléphone a été placé sous scellé et exploité par la cellule d'appui numérique. L'application de portefeuille ne montre que deux comptes Ethereum et une adresse Tron, sans lien apparent avec les versements des victimes.\n\n` +
        `Exploitez les pièces issues du téléphone : identifiez les comptes réellement contrôlés, chiffrez les versements, suivez les fonds jusqu'à Tron et jusqu'à leur revente, vérifiez que le compte « Perso » est resté étanche, et désignez les plateformes à requérir. Gardez à l'esprit ce que chaque élément prouve… et ce qu'il ne prouve pas.`,
      evidence: [
        {
          id: 'plainte', type: 'plainte', title: 'Procès-verbal de plainte (extrait)', date: victimPay.time + Math.round(r.float(10, 30) * DAY), author: complainant.name,
          body:
            `« Mon gestionnaire chez ${platform} m'appelait plusieurs fois par semaine. Il m'a fait acheter des USDT sur Coinhouse et les envoyer sur l'adresse de dépôt de mon compte de trading : ${A(w, victimPay.to)}. ` +
            `J'ai envoyé ${usdt(victimPay.value)} le ${fmtDate(victimPay.time)} (transaction ${victimPay.tx.hash}). Quand j'ai voulu retirer mes gains, on m'a réclamé des « frais de déblocage ». »`,
        },
        {
          id: 'extraction', type: 'extraction', title: 'Rapport d\'extraction du téléphone — application de portefeuille', date: tExtract, author: 'Cellule d\'appui numérique',
          body:
            `Téléphone placé en mode avion et en pochette d'isolement dès la saisie (${fmtDate(tSeize)}). Extraction logique avec un outil validé, empreinte SHA-256 de l'image calculée et consignée ; analyse réalisée sur copie.\n\n` +
            `Application de portefeuille multi-chaînes — comptes affichés :\n` +
            `- « Compte principal » (Ethereum) : ${A(w, acc0)}\n` +
            `- « Perso » (Ethereum) : ${A(w, acc1)}\n` +
            `- « TRX » (Tron) : ${A(w, tApp)}\n\n` +
            `Aucun autre compte n'est configuré dans l'application. Historique des notifications : plusieurs « réception USDT » sur le compte Tron.`,
        },
        {
          id: 'notes', type: 'extraction', title: 'Rapport d\'extraction — application de notes', date: tExtract, author: 'Cellule d\'appui numérique',
          body:
            `Note intitulée « sauvegarde ne pas effacer », créée le ${fmtDate(fundTx.time - r.int(2, 20) * DAY, false)} :\n` +
            `${sk.phrase}\n` +
            `« comptes 3-4-5 sur l'extension du PC — gas depuis le principal »\n\n` +
            `Note intitulée « à faire » : « regrouper sur le 5 avant de passer en TRC20 / ne jamais mélanger avec le perso ».\n\n` +
            `NB : la phrase relevée est reproduite telle qu'extraite pour les besoins de l'analyse ; elle n'a été restaurée dans aucun portefeuille.`,
        },
        {
          id: 'telegram', type: 'telegram', title: `Telegram — conversation avec @${buyerHandle} (extraction)`, date: tD2, author: `@${handle}`,
          body:
            `[${fmtDate(tD1 - Math.round(r.float(3, 8) * HOUR))}] @${buyerHandle} : t'as du stock ? je prends à ${priceEur} € cash\n` +
            `[${fmtDate(tD1 - Math.round(r.float(1, 2.5) * HOUR))}] @${handle} : ${d1.toLocaleString('fr-FR')} dispo ce soir\n` +
            `[${fmtDate(tD1 - Math.round(r.float(0.3, 0.9) * HOUR))}] @${buyerHandle} : ok envoie sur ${A(w, buyer)} rdv parking comme d'hab\n` +
            `[${fmtDate(tD1 + Math.round(r.float(5, 20) * 60))}] @${handle} : envoyé\n` +
            `[${fmtDate(tD2 - Math.round(r.float(5, 10) * HOUR))}] @${handle} : j'ai ${d2ask.toLocaleString('fr-FR')} pour toi demain\n` +
            `[${fmtDate(tD2 - Math.round(r.float(3, 4.5) * HOUR))}] @${buyerHandle} : trop pour moi en ce moment, je peux faire moins\n` +
            `[${fmtDate(tD2 - Math.round(r.float(0.5, 2.5) * HOUR))}] @${handle} : ok on fait comme tu peux, même adresse\n` +
            `[${fmtDate(tD2 + Math.round(r.float(5, 20) * 60))}] @${handle} : c'est parti, le reste je le mets sur mon compte`,
        },
      ],
      seeds: [],
      objectives: [
        {
          id: 'o1', type: 'addresses', points: 12,
          prompt: 'Sélectionnez les comptes Ethereum issus de la phrase de récupération qui ont été utilisés mais n\'apparaissent pas dans l\'application de portefeuille.',
          answer: hidden,
          hint: 'La mention « seed de démonstration … » dans les notes ouvre l\'outil « Dérivation HD » : comparez les comptes dérivés utilisés avec la liste de l\'application.',
          explanation: `La dérivation (m/44'/60'/0'/0/i) donne ${sk.accounts.length} comptes utilisés. Les deux premiers sont ceux de l'application ; les trois suivants (${hidden.map((a) => A(w, a)).join(', ')}) n'y figurent pas : la note précise qu'ils sont gérés depuis une extension de navigateur sur un ordinateur. Deux reçoivent les versements des victimes, le troisième les regroupe.`,
        },
        {
          id: 'o2', type: 'number', points: 8, tolerance: 0, unit: 'versements',
          prompt: 'Combien de versements de victimes (en USDT) ces comptes ont-ils reçus ?',
          answer: nV,
          hint: 'Comptez les transferts d\'USDT entrants sur les comptes qui servent d\'« adresses de dépôt ». Les envois d\'ETH (frais de gas) ne sont pas des versements.',
          explanation: `${nV} versements pour ${usdt(totalVictims)} : ${nOnAcc2} sur ${A(w, acc2)} et ${nV - nOnAcc2} sur ${A(w, acc3)}. Une seule victime a porté plainte à ce stade : les autres sont à identifier, notamment par réquisition à la plateforme d'où proviennent leurs USDT.`,
        },
        {
          id: 'o10', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.005,
          prompt: 'Quel montant total d\'USDT les victimes ont-elles versé sur ces comptes ?',
          answer: totalVictims,
          hint: 'Additionnez les transferts d\'USDT entrants sur les deux comptes qui servent d\'« adresses de dépôt », sans compter les mouvements internes vers le compte de regroupement.',
          explanation: `${usdt(totalVictims)} en ${nV} versements, entre le ${fmtDate(pays[0].time, false)} et le ${fmtDate(pays[nV - 1].time, false)}. C'est l'assiette du préjudice établi à ce stade. Chaque adresse émettrice a été alimentée peu avant par un retrait Coinhouse : une réquisition à la plateforme permettra d'identifier les clients concernés, donc d'autres victimes, et de recueillir leurs plaintes.`,
        },
        {
          id: 'o8', type: 'tx', points: 10,
          prompt: 'La note « ne jamais mélanger avec le perso » n\'a pas été respectée : quelle transaction fait passer des fonds des victimes vers le compte « Perso » ?',
          answer: [persoTx.id],
          hint: 'Ouvrez l\'historique du compte « Perso » affiché dans l\'application : en dehors de l\'ETH reçu du compte principal et d\'un swap, une entrée d\'USDT provient d\'un compte issu de la phrase.',
          explanation: `Le ${fmtDate(persoTx.time)}, peu après le second regroupement, le compte de regroupement ${A(w, acc4)} envoie ${usdt(cut)} au compte « Perso » ${A(w, acc1)} (transaction ${persoTx.hash.slice(0, 16)}…). Ces USDT proviennent directement des versements des victimes. C'est une rupture de cloisonnement : le compte que l'utilisateur gardait « propre » reçoit désormais le produit de l'escroquerie.`,
        },
        {
          id: 'o9', type: 'address', points: 10,
          prompt: 'Sur quelle adresse de dépôt d\'exchange le compte « Perso » a-t-il ensuite envoyé ces USDT ?',
          answer: [persoDep.deposit],
          hint: 'Suivez la sortie d\'USDT du compte « Perso » : l\'adresse de destination est étiquetée comme adresse de dépôt et balayée vers un hot wallet.',
          explanation: `Le ${fmtDate(persoDep.tx.time)}, ${A(w, acc1)} dépose ${usdt(cut)} sur ${A(w, persoDep.deposit)}, adresse de dépôt ${fundName}, balayée ensuite vers le hot wallet de la plateforme. C'est la même plateforme que celle d'où provient l'ETH du compte principal (retrait du ${fmtDate(fundTx.time, false)}) : deux flux convergent vers un compte client vraisemblablement ouvert au nom de l'utilisateur. ${procedureFor(fundEx.entity)}`,
        },
        {
          id: 'o12', type: 'choice', points: 8,
          prompt: 'Pourquoi ce passage par le compte « Perso » pèse-t-il dans l\'imputation des faits ?',
          hint: 'Qu\'apporte un compte client chez une plateforme à KYC par rapport à la seule dérivation de la phrase ?',
          ...choice(r,
            'Il relie le produit des versements à un compte affiché dans le téléphone puis à un compte client KYC, ce qui renforce le faisceau d\'imputation',
            [
              'Il prouve à lui seul que le détenteur du téléphone a organisé toute l\'escroquerie',
              'Il est sans portée : un transfert entre deux comptes de la même phrase est un mouvement interne neutre',
              'Il autorise à saisir sans autre formalité tous les avoirs du compte client sur la plateforme',
            ]),
          explanation: `Jusqu'ici, le lien entre les comptes « cachés » et l'utilisateur reposait sur la phrase et sur la conversion vers l'adresse Tron du téléphone. Le transfert vers « Perso », compte configuré dans l'application, puis le dépôt chez ${fundName}, ajoutent un point d'ancrage régulé : la plateforme connaît l'identité, les IP et l'IBAN du titulaire. C'est un élément de plus dans le faisceau, pas une preuve autonome de la direction de l'escroquerie ; et toute mesure sur le compte (gel, saisie) passe par une réquisition et une décision de l'autorité judiciaire.`,
        },
        {
          id: 'o3', type: 'tx', points: 10,
          prompt: 'Identifiez une transaction par laquelle le produit de la conversion des USDT Ethereum arrive sur Tron.',
          answer: [o1.payoutTx.id, o2.payoutTx.id],
          hint: 'Le compte qui regroupe les fonds les dépose chez un échangeur instantané. Corrélateur : émetteur ChangeNOW, chaîne Tron, à partir de l\'heure du dépôt, fenêtre d\'environ 1 h, tolérance de quelques %.',
          explanation: `Deux commandes ChangeNOW : ${usdt(w.flowIn(o1.depositTx, o1.deposit)[0].value)} déposés le ${fmtDate(o1.depositTx.time)}, payés ${usdt(p1)} sur ${A(w, tApp)} ${Math.round((o1.payoutTx.time - o1.depositTx.time) / 60)} min plus tard ; puis ${usdt(w.flowIn(o2.depositTx, o2.deposit)[0].value)} payés ${usdt(p2)}. L'adresse bénéficiaire est celle de l'application du téléphone : la conversion relie les comptes « cachés » à l'appareil. Les autres paiements de ChangeNOW dans la même fenêtre vont à d'autres clients.`,
        },
        {
          id: 'o4', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.005,
          prompt: 'Quel montant total d\'USDT a été remis à l\'acheteur de gré à gré ?',
          answer: sold,
          hint: 'Ne vous fiez pas aux montants annoncés dans la conversation : relevez les transferts réellement envoyés depuis l\'adresse Tron du téléphone vers l\'adresse donnée par l\'acheteur.',
          explanation: `${usdt(d1)} le ${fmtDate(tD1)} puis ${usdt(d2)} le ${fmtDate(tD2)}, soit ${usdt(sold)}. Le second échange avait été proposé à ${d2ask.toLocaleString('fr-FR')} USDT puis renégocié à la baisse : seule la blockchain fait foi. Les autres USDT reçus par l'acheteur viennent d'autres vendeurs, sans lien établi avec l'affaire. L'acheteur paie en espèces : son identification passe par la téléphonie et la surveillance des rendez-vous, et sa propre activité relève du blanchiment.`,
        },
        {
          id: 'o5', type: 'entity', points: 10,
          prompt: 'Sur quelle plateforme le reliquat des USDT a-t-il été déposé ?',
          answer: [cashKey],
          hint: 'Suivez la dernière sortie de l\'adresse Tron du téléphone.',
          explanation: `${usdt(rest)} sont déposés le ${fmtDate(cashDep.tx.time)} sur une adresse de dépôt ${cashEx.entity.name} (« le reste je le mets sur mon compte »). Indice convergent : les TRX de frais de cette même adresse Tron proviennent d'un retrait ${cashEx.entity.name} (${fmtDate(trxTx.time, false)}). Réquisition : identité, IP, IBAN de retrait, solde, avec demande de blocage. ${procedureFor(cashEx.entity)}`,
        },
        {
          id: 'o11', type: 'amount', points: 10, unit: 'USDT', tolerance: 0.005,
          prompt: 'Quel montant d\'USDT le reliquat déposé sur cette plateforme représente-t-il (montant susceptible d\'être bloqué sur le compte client) ?',
          answer: rest,
          hint: 'C\'est la dernière sortie de l\'adresse Tron du téléphone, vers une adresse de dépôt : relevez son montant.',
          explanation: `${usdt(rest)} déposés le ${fmtDate(cashDep.tx.time)} sur ${A(w, cashDep.deposit)}. Ce montant est désormais sous la garde de ${cashEx.entity.name} : s'il n'a pas été converti et retiré, une demande de gel sur le compte client peut le préserver. La réquisition cite l'adresse de dépôt, le hash du dépôt et la période ; elle demande aussi l'historique des retraits (IBAN) pour savoir si les fonds sont déjà sortis.`,
        },
        {
          id: 'o6', type: 'choice', points: 10,
          prompt: 'Quelle pratique garantit l\'exploitabilité de cette extraction devant la juridiction ?',
          ...choice(r,
            'Isoler l\'appareil du réseau, extraire avec un outil validé, calculer l\'empreinte et analyser une copie',
            [
              'Ouvrir l\'application de portefeuille du téléphone saisi pour relever les soldes à jour',
              'Restaurer la phrase dans le portefeuille du service pour lister les comptes qu\'elle contient',
              'Laisser le téléphone connecté pour recevoir les derniers messages Telegram de l\'acheteur',
            ]),
          explanation: `L'isolement (mode avion, pochette ou cage de Faraday) empêche toute modification ou tout effacement à distance ; l'outil validé et l'empreinte (hash) de l'image garantissent l'intégrité et la reproductibilité ; l'analyse se fait sur copie. Manipuler l'application saisie ou laisser l'appareil en ligne modifie les données. Restaurer la phrase n'est pas nécessaire pour lister les comptes (la dérivation suffit) et constitue un acte de disposition à réserver à la saisie, sur instruction du magistrat. Tout acte sur le support est décrit au procès-verbal.`,
        },
        {
          id: 'o7', type: 'choice', points: 12,
          prompt: 'Que démontre le fait que ces comptes dérivent de la phrase trouvée dans le téléphone ?',
          ...choice(r,
            'Qu\'ils relèvent d\'une même phrase ; leur imputation au détenteur reste à étayer',
            [
              'Que le détenteur du téléphone a lui-même signé chacune de ces transactions',
              'Rien : une phrase recopiée dans des notes n\'a aucune valeur pour l\'enquête',
              'Que les fonds de ces comptes peuvent être saisis sans décision d\'un magistrat',
            ]),
          explanation: `La dérivation établit un lien technique certain entre la phrase et les comptes : qui détient la phrase contrôle les comptes. Elle ne dit pas qui a agi : la phrase a pu être partagée ou recopiée. L'imputation au détenteur s'appuie sur un faisceau : la note (« comptes 3-4-5 sur l'extension du PC »), le paiement des frais de gas depuis le compte principal de l'application, la conversion vers l'adresse Tron du téléphone, les conversations Telegram, l'exploitation de l'ordinateur et les réponses des plateformes. Toute saisie des fonds suppose une décision ou une instruction de l'autorité judiciaire.`,
        },
      ],
      truth: {
        path: [
          fundTx.id, ...pays.map((p) => p.tx.id), ...gasTxs.map((x) => x.id), ...fwdTxs.map((x) => x.id),
          o1.depositTx.id, o1.payoutTx.id, o2.depositTx.id, o2.payoutTx.id, trxTx.id, deal1.id, deal2.id, cashDep.tx.id, ...(cashDep.sweep ? [cashDep.sweep.id] : []),
          toAcc1.id, persoSwap.tx.id, persoTx.id, persoDep.tx.id, ...(persoDep.sweep ? [persoDep.sweep.id] : []),
        ],
        addresses: [acc2, acc3, acc4, acc0, acc1, tApp, buyer, o1.deposit, o2.deposit, cashDep.deposit, persoDep.deposit],
        debrief:
          `1. Le compte principal ${A(w, acc0)} est alimenté en ETH par un retrait ${fundEx.entity.name} ; il finance le compte « Perso » et, surtout, les frais de gas des comptes 3, 4 et 5 de la même phrase.\n` +
          `2. ${nV} victimes versent ${usdt(totalVictims)} sur ${A(w, acc2)} et ${A(w, acc3)}, présentés comme des « adresses de dépôt » de la plateforme.\n` +
          `3. Les USDT sont regroupés sur ${A(w, acc4)}, puis convertis en deux fois chez ChangeNOW en USDT-TRC20, payés sur l'adresse Tron de l'application (${usdt(p1)} et ${usdt(p2)}). Entre les deux, ${usdt(cut)} partent vers le compte « Perso », qui les dépose chez ${fundName} : l'erreur de cloisonnement que la note voulait éviter.\n` +
          `4. ${usdt(sold)} sont revendus à @${buyerHandle} contre des espèces (deux remises), et ${usdt(rest)} sont déposés chez ${cashEx.entity.name}.\n\n` +
          `À retenir : l'application d'un téléphone ne montre que ce que l'utilisateur y a configuré. Une phrase de récupération découverte lors de l'exploitation permet de dériver tous les comptes (ici, trois comptes absents de l'application), sans la restaurer dans un portefeuille. L'extraction doit être conduite dans les règles (isolement, outil validé, empreinte, copie) et chaque conclusion présentée à sa juste force : la dérivation prouve le lien entre la phrase et les comptes ; l'imputation à une personne repose sur un faisceau d'éléments.`,
      },
      hints: [
        'Dans les notes du téléphone, la mention « seed de démonstration … » est cliquable : elle ouvre l\'outil de dérivation sur cette phrase.',
        'Comparez les comptes dérivés utilisés avec la liste de l\'application : ceux qui manquent sont gérés depuis un autre appareil.',
        'Le compte qui regroupe les USDT les envoie chez un échangeur instantané : corrélez sur Tron (USDT) à partir de l\'heure du dépôt.',
        'Pour la revente, comparez la conversation Telegram aux transferts réels : seule la blockchain fait foi sur les montants.',
        'Le compte « Perso » de l\'application n\'est pas resté étanche : examinez ses entrées et sorties d\'USDT.',
      ],
    }
  },
}
