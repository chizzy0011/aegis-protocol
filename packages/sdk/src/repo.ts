import { RepoQuoteRequest, RepoQuoteResponse } from './types.js';

export const SUPPORTED_REPO_COLLATERAL: Record<string, { name: string; issuer: string; defaultHaircutBps: number; benchmarkAprBps: number }> = {
  'spiko-eutbl': {
    name: 'Spiko Euro T-Bills (eurSAFO)',
    issuer: 'Spiko / CACEIS Custody',
    defaultHaircutBps: 200, // 2.0%
    benchmarkAprBps: 385, // 3.85%
  },
  'benji-ustbl': {
    name: 'Franklin Templeton BENJI OnChain US Govt Money Fund',
    issuer: 'Franklin Templeton',
    defaultHaircutBps: 200, // 2.0%
    benchmarkAprBps: 495, // 4.95%
  },
  'wisdomtree-gov': {
    name: 'WisdomTree Short-Term Treasury Digital Fund',
    issuer: 'WisdomTree Prime',
    defaultHaircutBps: 250, // 2.5%
    benchmarkAprBps: 510, // 5.10%
  },
};

export class AegisRepoClient {
  public calculateQuote(request: RepoQuoteRequest): RepoQuoteResponse {
    const collateralInfo = SUPPORTED_REPO_COLLATERAL[request.collateralToken] || {
      name: 'Generic Sovereign RWA',
      issuer: 'Verified Issuer',
      defaultHaircutBps: 300,
      benchmarkAprBps: 520,
    };

    const collateralNum = parseFloat(request.collateralAmount);
    const haircutDec = collateralInfo.defaultHaircutBps / 10000;
    const maxBorrowable = collateralNum * (1 - haircutDec);

    const requestedNum = parseFloat(request.cashRequested);
    if (requestedNum > maxBorrowable) {
      throw new Error(`Requested amount $${requestedNum} exceeds maximum borrowable capacity $${maxBorrowable} after haircut`);
    }

    const termSeconds = request.termDays * 86400;
    const rateBps = collateralInfo.benchmarkAprBps;
    const annualRate = rateBps / 10000;
    const interestUsdc = (requestedNum * annualRate * termSeconds) / 31536000;
    const totalRepurchase = requestedNum + interestUsdc;

    const maturity = new Date(Date.now() + termSeconds * 1000).toISOString();

    return {
      collateralValueUsd: collateralNum.toFixed(2),
      haircutPercentage: haircutDec * 100,
      maxBorrowableCash: maxBorrowable.toFixed(2),
      effectiveRepoRateBps: rateBps,
      effectiveRepoApr: `${(annualRate * 100).toFixed(2)}%`,
      estimatedInterestUsdc: interestUsdc.toFixed(2),
      totalRepurchaseAmountUsdc: totalRepurchase.toFixed(2),
      maturityDate: maturity,
      isEligibleForDvp: true,
    };
  }
}
