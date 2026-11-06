

export type { AegisNetwork } from './networks.js';
import type { AegisNetwork } from './networks.js';

export type RepoStatus = 'Pending' | 'Active' | 'Closed' | 'Liquidated' | 'Cancelled';
export type FacilityStatus = 'Fundraising' | 'Active' | 'Repaid' | 'Defaulted' | 'Cancelled';

export const REPO_STATUSES: RepoStatus[] = ['Pending', 'Active', 'Closed', 'Liquidated', 'Cancelled'];
export const FACILITY_STATUSES: FacilityStatus[] = ['Fundraising', 'Active', 'Repaid', 'Defaulted', 'Cancelled'];

export const TIER_NAMES: Record<number, string> = {
  0: 'Not verified',
  1: 'Retail',
  2: 'Accredited',
  3: 'Institutional',
};

export const SENIOR = 0;
export const JUNIOR = 1;

/** Mirrors `RepoAgreement` in contracts/repo */
export interface RepoAgreement {
  id: number;
  borrower: string;
  lender?: string;
  collateralToken: string;
  collateralAmount: bigint;
  cashToken: string;
  cashBorrowed: bigint;
  repurchaseAmount: bigint;
  repoRateBps: number;
  termSeconds: number;
  haircutBps: number;
  startTimestamp: number;
  maturityTimestamp: number;
  status: RepoStatus;
}

/** Mirrors `CreditFacility` in contracts/credit */
export interface CreditFacility {
  id: number;
  borrower: string;
  invoiceRef: string;
  currencyToken: string;
  seniorTarget: bigint;
  juniorTarget: bigint;
  seniorFunded: bigint;
  juniorFunded: bigint;
  seniorAprBps: number;
  juniorAprBps: number;
  durationSeconds: number;
  dueTimestamp: number;
  repaidAmount: bigint;
  status: FacilityStatus;
  /** Principal plus interest owed to each tranche */
  seniorOwed: bigint;
  juniorOwed: bigint;
}

export interface CreditPosition {
  senior: bigint;
  junior: bigint;
  claimed: bigint;
  claimable: bigint;
}

export interface GateConfig {
  admin: string;
  compliance: string;
  /** Minimum compliance tier (0 = open) */
  requiredTier: number;
}

export interface AegisDeployment {
  network: AegisNetwork;
  deployedAt: string;
  admin: string;
  contracts: {
    compliance: string;
    repo: string;
    credit: string;
    settlement: string;
  };
  /** Tokens the testnet demo uses on each leg */
  assets: {
    collateral: { code: string; contractId: string };
    cash: { code: string; contractId: string };
  };
  requiredTier: { repo: number; credit: number };
  wasmHashes: Record<string, string>;
  txs: Record<string, string>;
}
