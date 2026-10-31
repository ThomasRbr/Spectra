// Détails « explorateur » d'une transaction : appel de contrat décodé,
// journaux d'événements, transactions internes, gas et nonce (modèle à
// comptes) ; scripts, témoins, poids, OP_RETURN et inscriptions (Bitcoin) ;
// clé de staking, multisig et contrat (adresse).
import { useMemo, useState } from 'react'
import { CHAINS, fmtAsset } from '../../engine/chains'
import { shortAddr } from '../../engine/addressgen'
import { LEG_KIND_LABEL, accountNonce, argDisplay, calldata, callOf, describeCall, fnName, gasOf, hasAbi, internalCalls, legKind, paramTypes, txLogs, FUNCTIONS, type LegKind } from '../../engine/evm'
import { isBitcoinLike, lockScript, txSize, unlockOf } from '../../engine/script'
import { stakeSiblings } from '../../engine/cardano'
import type { Transfer, Tx, World } from '../../engine/world'
import { useGame } from '../../store/game'
import { CopyButton, Icon } from '../common'
import { AddrLine } from './Inspector'

const LEG_STYLE: Record<LegKind, string> = {
  value: 'bg-sky-500/10 text-sky-200',
  internal: 'bg-amber-400/10 text-amber-200',
  token: 'bg-emerald-500/10 text-emerald-300',
  mint: 'bg-fuchsia-500/10 text-fuchsia-200',
  burn: 'bg-rose-500/10 text-rose-200',
}

const LEG_SHORT: Record<LegKind, string> = { value: 'valeur', internal: 'interne', token: 'événement', mint: 'mint', burn: 'burn' }

/** Pastille indiquant la nature d'une jambe de transaction (valeur, interne, événement de jeton, mint, burn). */
export function LegChip({ w, tx, t }: { w: World; tx: Tx; t: Transfer }) {
  if (!hasAbi(tx.chain)) return null
  const k = legKind(w, tx, t)
  return <span className={`chip !py-0 text-[10px] ${LEG_STYLE[k]}`} title={LEG_KIND_LABEL[k]}>{LEG_SHORT[k]}</span>
}

function Card({ icon, title, tone = 'ink', children, right }: { icon: string; title: string; tone?: 'ink' | 'violet' | 'amber' | 'rose' | 'cyan' | 'fuchsia'; children: React.ReactNode; right?: React.ReactNode }) {
  const tones: Record<string, string> = {
    ink: 'border-ink-700/70 bg-ink-850/40',
    violet: 'border-violet-400/30 bg-violet-400/5',
    amber: 'border-amber-400/30 bg-amber-400/5',
    rose: 'border-rose-400/35 bg-rose-400/5',
    cyan: 'border-cyan-400/30 bg-cyan-400/5',
    fuchsia: 'border-fuchsia-400/30 bg-fuchsia-400/5',
  }
  return (
    <div className={`mt-3 rounded-xl border p-3 ${tones[tone]}`}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-white">
        <Icon name={icon} size={13} className="text-ink-200" /> <span className="flex-1">{title}</span> {right}
      </div>
      {children}
    </div>
  )
}

const mono = 'font-mono text-[10.5px] leading-4 break-all'

// ── Modèle à comptes ────────────────────────────────────────────────────────

export function EvmDetails({ w, tx }: { w: World; tx: Tx }) {
  const cv = useMemo(() => callOf(w, tx), [w, tx])
  const logs = useMemo(() => txLogs(w, tx), [w, tx])
  const internals = useMemo(() => internalCalls(w, tx), [w, tx])
  const gas = useMemo(() => gasOf(w, tx), [w, tx])
  const nonce = useMemo(() => accountNonce(w, tx), [w, tx])
  const [raw, setRaw] = useState(false)
  if (!hasAbi(tx.chain) || tx.model !== 'account') return null
  const native = CHAINS[tx.chain].native
  const input = cv.call ? calldata(w, tx.chain, cv.call) : '0x'
  const fn = cv.call ? FUNCTIONS[cv.call.sig] : undefined
  const types = cv.call ? paramTypes(cv.call.sig) : []

  return (
    <>
      {tx.status === 'reverted' && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-[12px] text-rose-100">
          <Icon name="OctagonX" size={16} className="mt-0.5 shrink-0 text-rose-300" />
          <div>
            <div className="font-semibold">Échec (reverted){tx.revertReason ? ` : « ${tx.revertReason} »` : ''}</div>
            <div className="mt-0.5 text-[11.5px] leading-relaxed text-rose-100/80">La transaction figure dans un bloc et les frais sont payés, mais aucun transfert n'a été exécuté. Elle ne déplace pas de fonds : ne la comptez pas dans un flux. Elle renseigne en revanche sur l'intention et l'activité du signataire.</div>
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        <Meta label="Nonce" value={nonce ?? '—'} hint="Nombre de transactions déjà signées par ce compte" />
        <Meta label="Gas utilisé" value={gas ? `${gas.gasUsed.toLocaleString('fr-FR')}` : '—'} hint={gas ? `Limite ${gas.gasLimit.toLocaleString('fr-FR')}` : undefined} />
        <Meta label="Prix du gas" value={gas ? `${gas.priceGwei.toLocaleString('fr-FR', { maximumFractionDigits: gas.priceGwei < 1 ? 3 : 1 })} gwei` : '—'} />
      </div>

      <Card icon="FileCode2" title="Appel de contrat" tone="violet" right={cv.call ? <span className="font-mono text-[10.5px] text-violet-200">{cv.selector}</span> : undefined}>
        {cv.call ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`chip font-mono ${cv.known ? 'bg-violet-500/20 text-violet-100' : 'bg-ink-700 text-ink-200'}`}>{cv.known ? cv.call.sig : `fonction inconnue (${cv.selector})`}</span>
              {cv.value > 0 && <span className="chip bg-sky-500/10 text-sky-200">+ {fmtAsset(cv.value, native)} envoyés avec l'appel</span>}
            </div>
            <div className="mt-1.5 text-[11.5px] leading-relaxed text-ink-200">{describeCall(w, tx)}</div>
            <div className="mt-1 text-[11px] text-ink-400">Contrat appelé :</div>
            <AddrLine w={w} id={cv.call.to} compact />
            {cv.known && cv.call.args.length > 0 && (
              <div className="mt-1.5 space-y-0.5 rounded-lg bg-ink-950/50 p-2">
                {cv.call.args.map((a, i) => {
                  const d = argDisplay(w, tx.chain, types[i], a)
                  return (
                    <div key={i} className="text-[11px]">
                      <span className="text-ink-400">{(cv.call!.names ?? fn?.names)?.[i] ?? `arg${i}`}</span>
                      <span className="ml-1 text-ink-500">({types[i]})</span>
                      {d.addr ? <AddrLine w={w} id={d.addr} compact /> : <div className={`${mono} text-ink-100`}>{d.text}</div>}
                    </div>
                  )
                })}
              </div>
            )}
            <button className="mt-1.5 text-[11px] text-violet-200 hover:text-white" onClick={() => setRaw(!raw)}>
              <Icon name={raw ? 'ChevronUp' : 'ChevronDown'} size={11} className="mr-0.5 inline" /> Données d'entrée brutes ({(input.length - 2) / 2} octets)
            </button>
            {raw && (
              <div className="mt-1 rounded-lg bg-ink-950/70 p-2">
                <div className="flex items-start gap-1">
                  <div className={`${mono} flex-1 text-ink-100`}>
                    <div><span className="text-violet-300">{input.slice(0, 10)}</span> <span className="text-ink-500">← sélecteur = keccak256("{cv.call.sig}")[0..4]</span></div>
                    {(input.slice(10).match(/.{1,64}/g) ?? []).map((wd, i) => (
                      <div key={i}><span className="text-ink-500">[{i}]</span> {wd}</div>
                    ))}
                  </div>
                  <CopyButton text={input} />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-[11.5px] text-ink-300">{describeCall(w, tx)} <span className="font-mono text-ink-400">Input data : 0x</span></div>
        )}
        {tx.creates?.length ? (
          <div className="mt-2 rounded-lg border border-violet-400/25 p-2 text-[11px] text-ink-200">
            <div className="mb-0.5 text-violet-200">Contrat(s) déployé(s) par cette transaction</div>
            {tx.creates.map((c) => <AddrLine key={c} w={w} id={c} compact />)}
            <div className="mt-1 text-[10.5px] text-ink-400">Une adresse CREATE2 est calculable d'avance (fabrique + sel + code) : elle peut recevoir des fonds avant que le contrat n'existe.</div>
          </div>
        ) : null}
      </Card>

      {internals.length > 0 && (
        <Card icon="CornerDownRight" title={`Transactions internes (${internals.length})`} tone="amber">
          <div className="mb-1 text-[11px] leading-relaxed text-ink-300">De l'{native} déplacé par un contrat pendant l'exécution. Ces mouvements n'émettent aucun événement et n'apparaissent pas dans la liste « normale » des transactions du bénéficiaire sur un explorateur.</div>
          <div className="space-y-1">
            {internals.map((c, i) => (
              <div key={i} className="rounded-lg border border-amber-400/15 p-1">
                <AddrLine w={w} id={c.from} compact />
                <div className="flex items-center gap-1.5 px-2 text-[11px]">
                  <span className="font-mono text-ink-500">{'↳'.repeat(c.depth)} CALL</span>
                  <span className="font-mono font-semibold text-amber-100">{fmtAsset(c.value, native)}</span>
                </div>
                <AddrLine w={w} id={c.to} compact />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card icon="ScrollText" title={`Journaux d'événements (${logs.length})`} tone="cyan">
        {logs.length ? (
          <div className="space-y-1.5">
            {logs.map((l) => <LogRow key={l.index} w={w} log={l} />)}
          </div>
        ) : (
          <div className="text-[11.5px] text-ink-300">{tx.status === 'reverted' ? 'Aucun événement : une transaction échouée n\'en émet pas.' : 'Aucun événement émis (simple envoi d\'actif natif).'}</div>
        )}
      </Card>
    </>
  )
}

function Meta({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-ink-700/60 bg-ink-850/40 px-1.5 py-1" title={hint}>
      <div className="text-[9.5px] uppercase tracking-wide text-ink-400">{label}</div>
      <div className="font-mono text-[11.5px] text-ink-100">{value}</div>
    </div>
  )
}

function LogRow({ w, log }: { w: World; log: ReturnType<typeof txLogs>[number] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-cyan-400/15 bg-ink-950/40 p-1.5">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] text-ink-500">#{log.index}</span>
        <span className="chip bg-cyan-500/15 font-mono text-cyan-100">{log.name}</span>
        <span className="min-w-0 flex-1 truncate text-[10.5px] text-ink-300">émis par</span>
        <button className="text-[10.5px] text-cyan-200 hover:text-white" onClick={() => setOpen(!open)}>{open ? 'décodé' : 'brut'}</button>
      </div>
      <AddrLine w={w} id={log.emitter} compact />
      {!open ? (
        <div className="space-y-0.5 px-1">
          {log.params.map((p) => (
            <div key={p.name} className="text-[11px]">
              <span className="text-ink-400">{p.name}</span>
              {p.indexed && <span className="ml-1 text-[9.5px] text-cyan-300">indexé</span>}
              {p.addr ? <AddrLine w={w} id={p.addr} compact /> : <div className={`${mono} text-ink-100`}>{p.text}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className={`${mono} space-y-0.5 px-1 text-ink-200`}>
          {log.topics.map((t, i) => (
            <div key={i}><span className="text-ink-500">topic{i}</span> {t}{i === 0 && <span className="text-ink-500"> ← keccak256("{log.sig}")</span>}</div>
          ))}
          <div><span className="text-ink-500">data</span> {log.data === '0x' ? '0x (vide)' : log.data}</div>
        </div>
      )}
    </div>
  )
}

// ── Bitcoin : scripts, témoins, poids ───────────────────────────────────────

export function UtxoDetails({ w, tx }: { w: World; tx: Tx }) {
  const size = useMemo(() => txSize(w, tx), [w, tx])
  const [open, setOpen] = useState(false)
  if (tx.model !== 'utxo') return null
  const datums = tx.outputs.filter((o) => o.datum)
  return (
    <>
      {tx.ord && <OrdCard w={w} tx={tx} />}
      {tx.opReturn && (
        <Card icon="FileText" title="Sortie OP_RETURN (données, 0 BTC)" tone="fuchsia">
          {tx.opReturn.text && <div className="text-[11.5px] text-fuchsia-100">{tx.opReturn.text}</div>}
          <div className={`${mono} mt-1 text-ink-300`}>{tx.opReturn.hex}</div>
          <div className="mt-1 text-[10.5px] leading-relaxed text-ink-400">{tx.opReturn.protocol === 'runes' ? 'Runestone (OP_RETURN OP_13) : instruction qui attribue des soldes de runes aux sorties de la transaction. Les runes suivent les UTXO, pas les adresses.' : 'Sortie non dépensable qui publie des données dans la chaîne.'}</div>
        </Card>
      )}
      {datums.length > 0 && (
        <Card icon="Database" title="Datums (eUTXO)" tone="cyan">
          <div className="mb-1 text-[11px] leading-relaxed text-ink-300">Sur Cardano, une sortie envoyée à une adresse de script porte une donnée (datum) que le contrat lira : propriétaire, adresse de retour, conditions. C'est souvent elle qui révèle à qui reviennent les fonds.</div>
          {datums.map((o) => (
            <div key={o.n} className="rounded-lg border border-cyan-400/15 p-1.5">
              <div className="text-[10.5px] text-ink-400">Sortie {o.n}</div>
              <AddrLine w={w} id={o.address} compact />
              <pre className={`${mono} mt-1 whitespace-pre-wrap rounded bg-ink-950/60 p-1.5 text-cyan-100`}>{o.datum}</pre>
            </div>
          ))}
        </Card>
      )}
      {size && (
        <Card icon="Scale" title="Taille et poids">
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <Meta label="Taille" value={`${size.size} o`} hint="Octets sérialisés, témoin compris" />
            <Meta label="Poids" value={`${size.weight} WU`} hint="Hors témoin × 4 + témoin × 1" />
            <Meta label="Taille virt." value={`${size.vsize} vB`} hint="Poids / 4 : base du calcul des frais" />
          </div>
          <div className="mt-1.5 text-[11px] leading-relaxed text-ink-300">
            Taux : <span className="font-mono text-ink-100">{size.feeRate.toLocaleString('fr-FR')} sat/vB</span>.
            {size.witnessBytes > 0 ? <> Témoin : {size.witnessBytes} octets comptés au quart : la remise SegWit économise {Math.round((1 - size.vsize / size.vsizeWithoutDiscount) * 100)} % sur les frais.</> : <> Aucun témoin : transaction entièrement « legacy », sans remise.</>}
          </div>
        </Card>
      )}
      {isBitcoinLike(tx) && (
        <Card icon="Code" title="Scripts et témoins" right={<button className="text-[11px] text-accent" onClick={() => setOpen(!open)}>{open ? 'Masquer' : 'Afficher'}</button>}>
          {!open ? (
            <div className="text-[11px] text-ink-400">{[...new Set(tx.inputs.map((_, n) => unlockOf(w, tx, n).type))].join(' · ')}</div>
          ) : (
            <div className="space-y-2">
              {tx.inputs.map((inp, n) => {
                const u = unlockOf(w, tx, n)
                return (
                  <div key={n} className="rounded-lg border border-ink-700/60 p-1.5">
                    <div className="flex items-center gap-1.5 text-[11px]"><span className="text-ink-400">Entrée {n}</span><span className="chip bg-ink-700 text-ink-100">{u.type}</span></div>
                    <AddrLine w={w} id={inp.address} compact />
                    {u.multisig && (
                      <div className="my-1 rounded-md bg-amber-400/10 p-1.5 text-[11px] text-amber-100">
                        Multisig {u.multisig.m}-sur-{u.multisig.n} · ont signé : {u.multisig.signed.map((k) => `clé n° ${k}`).join(', ')}
                        <div className="mt-0.5 space-y-0.5">
                          {u.multisig.pubkeys.map((k, i) => (
                            <div key={i} className={`${mono} ${u.multisig!.signed.includes(i + 1) ? 'text-amber-100' : 'text-ink-500'}`}>clé {i + 1} : {k}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {u.scriptSig.length > 0 && <Items title="scriptSig" items={u.scriptSig} />}
                    {u.witness.length > 0 && <Items title={`Témoin (${u.witness.length} éléments)`} items={u.witness} />}
                    <div className="mt-1 text-[10.5px] leading-relaxed text-ink-400">{u.explain}</div>
                  </div>
                )
              })}
              {tx.outputs.map((o) => {
                const s = lockScript(w, o.address)
                return (
                  <div key={`o${o.n}`} className="rounded-lg border border-ink-700/60 p-1.5">
                    <div className="flex items-center gap-1.5 text-[11px]"><span className="text-ink-400">Sortie {o.n}</span><span className="chip bg-ink-700 text-ink-100">{s.type}</span></div>
                    <div className={`${mono} text-ink-200`}>{s.asm}</div>
                    <div className="text-[10.5px] text-ink-400">{s.help}</div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}
    </>
  )
}

function Items({ title, items }: { title: string; items: { label: string; hex: string; bytes: number }[] }) {
  return (
    <div className="mt-1">
      <div className="text-[10.5px] text-ink-400">{title}</div>
      {items.map((it, i) => (
        <div key={i} className="mt-0.5 rounded bg-ink-950/60 p-1">
          <div className="text-[10.5px] text-ink-200">{it.label} <span className="text-ink-500">({it.bytes} o)</span></div>
          {it.hex && <div className={`${mono} text-ink-400`}>{it.hex.length > 120 ? `${it.hex.slice(0, 120)}…` : it.hex}</div>}
        </div>
      ))}
    </div>
  )
}

function OrdCard({ w, tx }: { w: World; tx: Tx }) {
  const o = tx.ord!
  const carrier = o.carrier !== undefined ? tx.outputs[o.carrier] : undefined
  const title: Record<string, string> = {
    commit: 'Commit d\'inscription',
    reveal: 'Révélation d\'une inscription ordinale',
    transfer: 'Transfert d\'inscription',
    sale: 'Vente d\'inscription (PSBT)',
    'rune-etch': 'Création d\'une rune',
    'rune-mint': 'Frappe de runes',
    'rune-transfer': 'Transfert de runes',
  }
  return (
    <Card icon="Gem" title={title[o.kind]} tone="fuchsia">
      <div className="space-y-0.5 text-[11.5px] text-ink-200">
        {o.id && (
          <div>
            <div><span className="text-ink-400">Inscription</span>{o.number !== undefined && <span className="text-ink-400"> · n° {o.number.toLocaleString('fr-FR')}</span>}</div>
            <div className="flex items-start gap-1"><span className={`${mono} flex-1 text-fuchsia-100`}>{o.id}</span><CopyButton text={o.id} /></div>
          </div>
        )}
        {o.contentType && <div><span className="text-ink-400">Type de contenu</span> <span className="font-mono">{o.contentType}</span>{o.size ? ` · ${o.size.toLocaleString('fr-FR')} octets` : ''}</div>}
        {o.content && <pre className={`${mono} whitespace-pre-wrap rounded bg-ink-950/60 p-1.5 text-fuchsia-100`}>{o.content}</pre>}
        {o.rune && <div><span className="text-ink-400">Rune</span> <span className="font-mono text-fuchsia-100">{o.rune}</span> × {o.runeAmount?.toLocaleString('fr-FR')}</div>}
        {o.price !== undefined && <div><span className="text-ink-400">Prix payé au vendeur</span> <span className="font-mono">{fmtAsset(o.price, 'BTC')}</span>{o.marketplace && <span className="text-ink-400"> · via {o.marketplace}</span>}</div>}
        {carrier && (
          <div className="mt-1">
            <span className="text-ink-400">Portée par la sortie {o.carrier} ({Math.round(carrier.value * 1e8).toLocaleString('fr-FR')} sats) :</span>
            <AddrLine w={w} id={carrier.address} compact />
          </div>
        )}
      </div>
      <div className="mt-1.5 text-[10.5px] leading-relaxed text-ink-400">
        {o.kind === 'commit' && 'Première moitié de la création : des fonds partent vers une adresse Taproot qui engage (sans le montrer) le script contenant l\'inscription.'}
        {o.kind === 'reveal' && 'Le contenu est publié dans le témoin de l\'entrée (dépense Taproot par script). L\'inscription s\'attache au premier satoshi de la sortie 0.'}
        {o.kind === 'transfer' && 'L\'inscription suit son satoshi : première entrée → première sortie. Les frais sont payés par une autre entrée, dont le reste part en rendu.'}
        {o.kind === 'sale' && 'Vente par transaction partiellement signée : le vendeur signe son entrée et sa sortie (le prix), l\'acheteur complète. La petite entrée « tampon » de l\'acheteur décale l\'inscription en sortie 1.'}
        {o.kind.startsWith('rune') && 'Les runes sont des soldes attachés aux UTXO. La petite sortie de 546 sats qui les porte n\'est pas un rendu.'}
      </div>
    </Card>
  )
}

// ── Adresse : contrat, staking, multisig ────────────────────────────────────

export function AddressExtra({ w, id }: { w: World; id: string }) {
  const a = w.get(id)
  const created = useMemo(() => (a.contract ? [...w.txs.values()].find((t) => t.creates?.includes(id) && w.visible(t)) : undefined), [w, id, a.contract])
  const siblings = useMemo(() => (a.stake ? stakeSiblings(w, id).filter((x) => x !== id) : []), [w, id, a.stake])
  if (!a.contract && !a.stake && !a.multisig && !a.tags.includes('null')) return null
  return (
    <div className="mt-2.5 space-y-1.5">
      {a.tags.includes('null') && (
        <div className="rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/5 p-2 text-[11px] leading-relaxed text-ink-200">Adresse nulle : personne n'en détient la clé. Les jetons « reçus de » cette adresse viennent d'être créés (mint) ; ceux « envoyés » vers elle sont détruits (burn). Ce n'est jamais une destination de fonds.</div>
      )}
      {a.contract && (
        <div className="rounded-lg border border-indigo-400/25 bg-indigo-400/5 p-2 text-[11px] text-ink-200">
          <div className="flex items-center gap-1.5">
            <Icon name="FileCode2" size={12} className="text-indigo-300" />
            <span className="font-semibold text-white">{a.contract.name}</span>
            <span className={`chip !py-0 ${a.contract.verified ? 'bg-emerald-500/10 text-emerald-300' : 'bg-ink-700 text-ink-300'}`}>{a.contract.verified ? 'code vérifié' : 'non vérifié'}</span>
          </div>
          <div className="mt-0.5 text-ink-300">{CONTRACT_HELP[a.contract.type] ?? ''}</div>
          {created && (
            <button className="mt-1 text-[10.5px] text-indigo-200 hover:text-white" onClick={() => useGame.getState().select({ kind: 'tx', id: created.id })}>
              <Icon name="Hammer" size={11} className="mr-0.5 inline" /> Déployé par la transaction {shortAddr(created.hash, 8)}
            </button>
          )}
        </div>
      )}
      {a.stake && (
        <div className="rounded-lg border border-blue-400/25 bg-blue-400/5 p-2 text-[11px] text-ink-200">
          <div className="text-ink-400">Clé de staking</div>
          <div className={`${mono} text-blue-100`}>{a.stake}</div>
          <div className="mt-1 text-ink-300">La partie staking est encodée en fin d'adresse : <span className="font-mono text-blue-200">…{a.addr.slice(-45, -6)}</span><span className="font-mono text-ink-500">{a.addr.slice(-6)}</span>. {siblings.length ? `${siblings.length} autre(s) adresse(s) connue(s) la partagent : même portefeuille.` : 'Aucune autre adresse connue ne la partage pour l\'instant.'}</div>
          {siblings.slice(0, 6).map((s) => <AddrLine key={s} w={w} id={s} compact />)}
        </div>
      )}
      {a.multisig && (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 p-2 text-[11px] text-ink-200">Script multisignature {a.multisig.m}-sur-{a.multisig.n} : {a.multisig.n} clés, {a.multisig.m} signatures requises. Les clés et les signataires ne sont visibles qu'au moment d'une dépense (témoin de l'entrée).</div>
      )}
    </div>
  )
}

const CONTRACT_HELP: Record<string, string> = {
  router: 'Routeur de DEX : reçoit l\'actif de départ et orchestre le swap avec les pools.',
  pool: 'Pool de liquidité : détient les deux actifs d\'une paire ; c\'est aussi le contrat des parts de pool (LP).',
  aggregator: 'Agrégateur : découpe et enchaîne les swaps sur plusieurs pools en un seul appel.',
  wrapper: 'Contrat d\'enveloppe : 1 jeton enveloppé = 1 unité de l\'actif natif déposé.',
  lending: 'Pool de prêt : reçoit les garanties, crée les jetons de reçu (aTokens) et verse les emprunts.',
  forwarder: 'Contrat de dépôt d\'une plateforme : propre à un client, il reverse ce qu\'il reçoit au portefeuille principal.',
  factory: 'Fabrique : déploie des contrats (ici les contrats de dépôt) à des adresses CREATE2 calculées d\'avance.',
  splitter: 'Contrat de répartition : redistribue immédiatement ce qu\'il reçoit selon des parts fixes (transactions internes).',
  token: 'Contrat de jeton : tient le registre des soldes ; les transferts sont des événements Transfer qu\'il émet.',
  bridge: 'Contrat de bridge : verrouille l\'actif et publie l\'événement que les relais exécutent sur l\'autre chaîne.',
  mixer: 'Pool de confidentialité : dépôts et retraits à dénomination fixe.',
  multisig: 'Coffre multisignature : chaque opération exige un nombre minimal de signatures de ses propriétaires.',
  exploit: 'Contrat malveillant ou d\'attaque.',
  escrow: 'Contrat de séquestre ou d\'ordre : les fonds y attendent une condition (datum, signature, délai).',
  vault: 'Coffre de rendement.',
  nft: 'Collection NFT (ERC-721).',
}
