import { useState } from 'react'
import { Icon, ChainBadge } from '../../ui/common'
import { ASSETS, fmtUsd, type AssetId, type ChainId } from '../../engine/chains'
import { Box, C, Explain, Instr, Seg } from './kit'

type Tab = 'btc' | 'eth' | 'token'

interface Unit {
  id: string
  label: string
  exp: number // puissance de 10 par rapport à l'unité de base on-chain
  note: string
}

const BTC_UNITS: Unit[] = [
  { id: 'BTC', label: 'BTC', exp: 8, note: '1 BTC = 100 000 000 sats' },
  { id: 'mBTC', label: 'mBTC', exp: 5, note: 'milli-bitcoin, 1/1 000 BTC' },
  { id: 'bits', label: 'bits (µBTC)', exp: 2, note: 'micro-bitcoin, 100 sats' },
  { id: 'sat', label: 'satoshis', exp: 0, note: 'unité indivisible stockée on-chain' },
]
const ETH_UNITS: Unit[] = [
  { id: 'ETH', label: 'ETH', exp: 18, note: '1 ETH = 10¹⁸ wei' },
  { id: 'gwei', label: 'gwei', exp: 9, note: 'unité des prix du gas, 10⁹ wei' },
  { id: 'wei', label: 'wei', exp: 0, note: 'unité indivisible stockée on-chain' },
]

const TOKENS: { id: string; asset: AssetId; chain: ChainId; std: string; decimals: number }[] = [
  { id: 'usdt-eth', asset: 'USDT', chain: 'eth', std: 'ERC-20', decimals: 6 },
  { id: 'usdt-tron', asset: 'USDT', chain: 'tron', std: 'TRC-20', decimals: 6 },
  { id: 'usdt-bsc', asset: 'USDT', chain: 'bsc', std: 'BEP-20', decimals: 18 },
  { id: 'usdc-eth', asset: 'USDC', chain: 'eth', std: 'ERC-20', decimals: 6 },
  { id: 'dai-eth', asset: 'DAI', chain: 'eth', std: 'ERC-20', decimals: 18 },
  { id: 'wbtc-eth', asset: 'WBTC', chain: 'eth', std: 'ERC-20', decimals: 8 },
]

const pow10 = (e: number) => 10n ** BigInt(e)

function parseUnits(text: string, exp: number): { v: bigint; truncated: boolean } | null {
  const t = text.replace(/[\s  ]/g, '').replace(',', '.')
  if (t === '' || t === '.') return { v: 0n, truncated: false }
  if (!/^\d*\.?\d*$/.test(t)) return null
  const [i, f = ''] = t.split('.')
  const truncated = f.replace(/0+$/, '').length > exp
  const frac = f.slice(0, exp).padEnd(exp, '0')
  return { v: BigInt(i || '0') * pow10(exp) + BigInt(frac || '0'), truncated }
}

function formatUnits(v: bigint, exp: number): string {
  const p = pow10(exp)
  const int = (v / p).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  if (exp === 0) return int
  const frac = (v % p).toString().padStart(exp, '0').replace(/0+$/, '')
  return frac ? `${int},${frac}` : int
}

function toNumber(v: bigint, exp: number): number {
  return Number(v) / Math.pow(10, exp)
}

export default function UnitConverter() {
  const [tab, setTab] = useState<Tab>('btc')
  const [base, setBase] = useState<Record<Tab, bigint>>({ btc: 1530000n, eth: 250000000000000000n, token: 25000000000n })
  const [tokenId, setTokenId] = useState('usdt-eth')
  const [edit, setEdit] = useState<{ unit: string; text: string; truncated: boolean } | null>(null)

  const token = TOKENS.find((t) => t.id === tokenId)!
  const units: Unit[] =
    tab === 'btc'
      ? BTC_UNITS
      : tab === 'eth'
        ? ETH_UNITS
        : [
            { id: 'human', label: token.asset, exp: token.decimals, note: `valeur affichée par l'explorateur (${token.decimals} décimales)` },
            { id: 'raw', label: 'valeur brute (uint256)', exp: 0, note: 'entier stocké dans le contrat et l\'événement Transfer' },
          ]
  const v = base[tab]
  const asset: AssetId = tab === 'btc' ? 'BTC' : tab === 'eth' ? 'ETH' : token.asset
  const topExp = units[0].exp
  const usdVal = toNumber(v, topExp) * ASSETS[asset].usd

  function onInput(u: Unit, text: string) {
    const r = parseUnits(text, u.exp)
    setEdit({ unit: u.id, text, truncated: !!r?.truncated })
    if (r) setBase((b) => ({ ...b, [tab]: r.v }))
  }

  // Mauvaise lecture des décimales (piège classique USDT BEP-20 = 18 décimales)
  const wrongDec = token.decimals === 18 ? 6 : 18
  const wrongVal = toNumber(v, wrongDec)

  return (
    <div className="space-y-3">
      <Instr>Saisissez un montant dans n'importe quelle unité : les autres se mettent à jour. Sur la blockchain, seul l'entier de l'unité la plus petite est enregistré.</Instr>
      <Seg<Tab>
        value={tab}
        onChange={(t) => {
          setTab(t)
          setEdit(null)
        }}
        options={[
          { id: 'btc', label: 'Bitcoin (sats)' },
          { id: 'eth', label: 'Ethereum (wei / gwei)' },
          { id: 'token', label: 'Jetons (décimales)' },
        ]}
      />

      {tab === 'token' && (
        <div className="flex flex-wrap gap-1.5">
          {TOKENS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTokenId(t.id)
                setEdit(null)
              }}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11.5px] transition ${tokenId === t.id ? 'border-accent/70 bg-ink-800 text-white' : 'border-ink-700 text-ink-300 hover:border-ink-500'}`}
            >
              <span className="font-semibold" style={{ color: ASSETS[t.asset].color }}>
                {t.asset}
              </span>
              <ChainBadge chain={t.chain} compact />
              <span className="font-mono text-[10.5px] text-ink-400">{t.decimals} déc.</span>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {units.map((u) => {
          const shown = edit?.unit === u.id ? edit.text : formatUnits(v, u.exp)
          const invalid = edit?.unit === u.id && parseUnits(edit.text, u.exp) === null
          return (
            <div key={u.id} className="grid items-center gap-2 sm:grid-cols-[150px_1fr]">
              <div>
                <div className="text-[12.5px] font-semibold text-white">{u.label}</div>
                <div className="text-[10.5px] text-ink-400">{u.note}</div>
              </div>
              <input
                className={`input font-mono ${invalid ? '!border-rose-500' : ''} ${u.exp === 0 ? 'text-ink-200' : 'text-white'}`}
                value={shown}
                inputMode="decimal"
                aria-label={`Montant en ${u.label}`}
                onChange={(e) => onInput(u, e.target.value)}
                onBlur={() => setEdit(null)}
              />
            </div>
          )
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Box title="Contre-valeur">
          <div className="text-lg font-semibold text-white">{fmtUsd(usdVal)}</div>
          <div className="text-[11px] text-ink-400">
            au cours indicatif de {ASSETS[asset].usd.toLocaleString('fr-FR')} $ / {asset}
          </div>
        </Box>
        <Box title="Ce qui est écrit on-chain">
          <div className="break-all font-mono text-[12px] text-accent">{v.toString()}</div>
          <div className="text-[11px] text-ink-400">
            entier ÷ 10^{topExp} = {formatUnits(v, topExp)} {asset}
          </div>
        </Box>
      </div>

      {edit?.truncated && (
        <div className="flex items-center gap-2 text-[11.5px] text-orange-300">
          <Icon name="TriangleAlert" size={13} /> Trop de décimales : l'unité minimale ne peut pas être fractionnée, l'excédent est ignoré.
        </div>
      )}

      <Explain tone={tab === 'token' ? 'warn' : 'info'}>
        {tab === 'btc' && (
          <>
            Bitcoin stocke <strong>{v.toLocaleString('fr-FR')} satoshis</strong> ; un explorateur affiche {formatUnits(v, 8)} BTC. En procédure, citez le montant exact en BTC (8 décimales) <strong>et</strong> la contre-valeur à la date des faits : le cours évolue, pas le nombre de sats.
          </>
        )}
        {tab === 'eth' && (
          <>
            Ethereum compte en <strong>wei</strong> (18 décimales). Le <strong>gwei</strong> (10⁹ wei) sert à exprimer le prix du gas : un transfert simple consomme 21 000 gas, soit à 20 gwei {formatUnits(21000n * 20n * 1000000000n, 18)} ETH de frais. Une erreur d'un facteur 10⁹ entre gwei et ETH est vite arrivée dans un tableur.
          </>
        )}
        {tab === 'token' && (
          <>
            Le contrat {token.asset} {token.std} déclare <strong>{token.decimals} décimales</strong> : l'entier brut {v.toString()} vaut {formatUnits(v, token.decimals)} {token.asset}. Lu avec {wrongDec} décimales par erreur, il vaudrait{' '}
            <span className="font-mono" style={{ color: C.rose }}>
              {wrongVal.toLocaleString('fr-FR', { maximumSignificantDigits: 6 })}
            </span>{' '}
            — un écart de 10^{Math.abs(token.decimals - wrongDec)}. Piège réel : l'USDT a 6 décimales sur Ethereum et Tron, mais 18 sur BNB Smart Chain. Vérifiez toujours la fonction <code className="font-mono text-cyan-200">decimals()</code> du contrat.
          </>
        )}
      </Explain>
    </div>
  )
}
