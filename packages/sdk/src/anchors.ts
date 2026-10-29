export interface RegisteredFiatAnchor {
  name: string;
  fiatCode: string;
  country: string;
  issuerPublicKey: string;
  sep24OfframpUrl: string;
  averageSettlementMinutes: number;
}

export const STELLAR_FIAT_ANCHOR_DIRECTORY: Record<string, RegisteredFiatAnchor> = {
  cowrie_ngn: {
    name: 'Cowrie Integrated Systems',
    fiatCode: 'NGN',
    country: 'Nigeria',
    issuerPublicKey: 'GA4BYMUO5D7NYC2WIOECSFI6P5AZA354SEDANVCICCIG46DRDELWEOK7',
    sep24OfframpUrl: 'https://api.cowrie.exchange/sep24',
    averageSettlementMinutes: 3,
  },
  mercado_brl: {
    name: 'Mercado Bitcoin BRL Anchor',
    fiatCode: 'BRL',
    country: 'Brazil',
    issuerPublicKey: 'GDV4Z7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSCLAGOSCOCOA',
    sep24OfframpUrl: 'https://anchor.mercadobitcoin.com.br/sep24',
    averageSettlementMinutes: 5,
  },
  tempo_eur: {
    name: 'Tempo France SAS',
    fiatCode: 'EUR',
    country: 'European Union',
    issuerPublicKey: 'GAP5HOTBXOZVTOTOWEUIIEQRQIOMXFMI4F23WHUMIOQGY4O6TDYGS7FD',
    sep24OfframpUrl: 'https://tempo.eu.com/sep24',
    averageSettlementMinutes: 15,
  },
  clickpesa_kes: {
    name: 'ClickPesa East Africa',
    fiatCode: 'KES',
    country: 'Kenya / Tanzania',
    issuerPublicKey: 'GBK42JVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC7K67VZ75HPJVIEUVNIXF',
    sep24OfframpUrl: 'https://api.clickpesa.com/sep24',
    averageSettlementMinutes: 8,
  },
};
