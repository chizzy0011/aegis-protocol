import { CreditFacilityInfo } from './types.js';

export const SAMPLE_STRUCTURED_FACILITIES: CreditFacilityInfo[] = [
  {
    id: 'fac-101',
    borrower: 'GDV4ZLAGOSCOCOA7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    exporterName: 'Prime Agro Commodities Ltd',
    commodityType: 'Export Grade Cocoa Beans (FairTrade)',
    originCountry: 'Nigeria',
    invoiceReference: 'INV-2026-COCOA-ROTTERDAM-08',
    principalAmountUsdc: '250000',
    seniorTrancheTarget: '200000',
    juniorTrancheTarget: '50000',
    seniorFunded: '200000',
    juniorFunded: '50000',
    seniorApr: '8.50%',
    juniorApr: '16.50%',
    durationDays: 90,
    status: 'Active',
    fiatAnchor: 'Cowrie Integrated Systems (NGN)',
    fiatCurrency: 'NGN',
  },
  {
    id: 'fac-102',
    borrower: 'GAF5SANTOSSOYABEANJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC7K67VZ75',
    exporterName: 'Santos Grain Logistics SA',
    commodityType: 'Verified Non-GMO Soya Grain',
    originCountry: 'Brazil',
    invoiceReference: 'INV-2026-BRAZIL-SOYA-CHINA-44',
    principalAmountUsdc: '500000',
    seniorTrancheTarget: '400000',
    juniorTrancheTarget: '100000',
    seniorFunded: '320000',
    juniorFunded: '100000',
    seniorApr: '8.25%',
    juniorApr: '17.00%',
    durationDays: 120,
    status: 'Fundraising',
    fiatAnchor: 'Mercado Bitcoin / BRL Anchor',
    fiatCurrency: 'BRL',
  },
  {
    id: 'fac-103',
    borrower: 'GBM3NAIROBIHORTICULTURE7VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHG',
    exporterName: 'Rift Valley Fresh Produce',
    commodityType: 'Air-Freight Cut Flowers & Avocados',
    originCountry: 'Kenya',
    invoiceReference: 'INV-2026-NAIROBI-HEATHROW-19',
    principalAmountUsdc: '150000',
    seniorTrancheTarget: '120000',
    juniorTrancheTarget: '30000',
    seniorFunded: '120000',
    juniorFunded: '30000',
    seniorApr: '9.00%',
    juniorApr: '18.00%',
    durationDays: 60,
    status: 'Active',
    fiatAnchor: 'ClickPesa East Africa (KES)',
    fiatCurrency: 'KES',
  },
];

export class AegisCreditClient {
  public calculateTrancheReturns(
    principal: number,
    seniorRatio: number,
    seniorApr: number,
    juniorApr: number,
    days: number
  ) {
    const seniorAmount = principal * seniorRatio;
    const juniorAmount = principal * (1 - seniorRatio);

    const yearFraction = days / 365;
    const seniorInterest = seniorAmount * (seniorApr / 100) * yearFraction;
    const juniorInterest = juniorAmount * (juniorApr / 100) * yearFraction;

    return {
      seniorAmount,
      juniorAmount,
      seniorInterest,
      juniorInterest,
      totalInterest: seniorInterest + juniorInterest,
      effectiveBlendedCostOfCapital:
        ((seniorInterest + juniorInterest) / principal / yearFraction) * 100,
    };
  }
}
