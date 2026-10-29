export type RepoStatus = 'Pending' | 'Active' | 'Closed' | 'Liquidated';

export interface RepoQuoteRequest {
  collateralToken: string;
  collateralAmount: string;
  cashToken: string;
  cashRequested: string;
  termDays: number;
  borrowerAddress: string;
}

export interface RepoQuoteResponse {
  collateralValueUsd: string;
  haircutPercentage: number;
  maxBorrowableCash: string;
  effectiveRepoRateBps: number;
  effectiveRepoApr: string;
  estimatedInterestUsdc: string;
  totalRepurchaseAmountUsdc: string;
  maturityDate: string;
  isEligibleForDvp: boolean;
}

export type FacilityStatus = 'Fundraising' | 'Active' | 'Repaid' | 'Defaulted';

export interface CreditFacilityInfo {
  id: string;
  borrower: string;
  exporterName: string;
  commodityType: string;
  originCountry: string;
  invoiceReference: string;
  principalAmountUsdc: string;
  seniorTrancheTarget: string;
  juniorTrancheTarget: string;
  seniorFunded: string;
  juniorFunded: string;
  seniorApr: string;
  juniorApr: string;
  durationDays: number;
  status: FacilityStatus;
  fiatAnchor: string;
  fiatCurrency: string;
}

export interface AnchorPayoutRequest {
  facilityId: string;
  anchorAddress: string;
  fiatCurrency: 'NGN' | 'BRL' | 'EUR' | 'KES' | 'TZS';
  amountUsdc: string;
  recipientBankDetails: string;
}
