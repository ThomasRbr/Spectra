import type { DrillDef } from '../model'
import { addressType, chainFromAddress, hashOrAddress } from './addresses'
import { unitConvert, utxoFee } from './units'
import { utxoChange } from './change'
import { ciohClusterDrill, coinjoinSpot } from './cioh'
import { depositVsHot, tokenVsNative, xrpTag } from './accounts'
import { requisitionTarget, riskCategory } from './risk'
import { typology } from './typology'
import { depositPattern, peelRead, poolDemix, swapMatch, taintMethod, walletFingerprint } from './tracing'
import { hdPath, lnChannel } from './hdln'
import { l2Withdrawal, ponziFlow, tonComment, washTrade } from './extra'
import { aggregatorRoute, collateralLink, eventRead, forwarderSpot, legKind, lpTrace, receiptToken, selectorDecode } from './contrats'
import { ordinalCarrierDrill, stakeCluster, vsizeFee, witnessType } from './btcmoderne'

/** Registre des exercices générés. */
export const DRILLS: DrillDef[] = [
  chainFromAddress,
  addressType,
  hashOrAddress,
  unitConvert,
  utxoFee,
  utxoChange,
  tokenVsNative,
  depositVsHot,
  xrpTag,
  ciohClusterDrill,
  coinjoinSpot,
  riskCategory,
  typology,
  requisitionTarget,
  taintMethod,
  depositPattern,
  peelRead,
  swapMatch,
  poolDemix,
  walletFingerprint,
  hdPath,
  lnChannel,
  tonComment,
  ponziFlow,
  l2Withdrawal,
  washTrade,
  legKind,
  eventRead,
  selectorDecode,
  forwarderSpot,
  aggregatorRoute,
  receiptToken,
  collateralLink,
  lpTrace,
  witnessType,
  vsizeFee,
  ordinalCarrierDrill,
  stakeCluster,
]
