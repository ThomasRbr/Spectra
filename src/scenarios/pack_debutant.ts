import type { ScenarioTemplate } from './types'
import { debTronUsdt } from './deb_tron_usdt'
import { debLitecoin } from './deb_litecoin'
import { debTonCommentaire } from './deb_ton_commentaire'
import { debSolanaSupport } from './deb_solana_support'
import { debBscAirdrop } from './deb_bsc_airdrop'
import { debCaptureAdresse } from './deb_capture_adresse'
import { debVictimesMultiples } from './deb_victimes_multiples'
import { debPremierSwap } from './deb_premier_swap'

/** Missions débutant (niveau 1, non guidées) : une compétence clé par affaire. */
export const PACK_DEBUTANT: ScenarioTemplate[] = [
  debTronUsdt,
  debLitecoin,
  debTonCommentaire,
  debSolanaSupport,
  debBscAirdrop,
  debCaptureAdresse,
  debVictimesMultiples,
  debPremierSwap,
]
