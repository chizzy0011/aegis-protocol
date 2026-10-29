#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token, Address, Env, String,
};

#[test]
fn test_structured_credit_facility_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let compliance = Address::generate(&env);
    let borrower = Address::generate(&env);
    let senior_lp = Address::generate(&env);
    let junior_lp = Address::generate(&env);

    let contract_id = env.register(AegisCreditContract, ());
    let client = AegisCreditContractClient::new(&env, &contract_id);

    client.initialize(&admin, &compliance);

    // Mock USDC token
    let usdc_admin = Address::generate(&env);
    let usdc_id = env.register_stellar_asset_contract_v2(usdc_admin);
    let usdc_token = token::Client::new(&env, &usdc_id.address());
    let usdc_stellar = token::StellarAssetClient::new(&env, &usdc_id.address());

    // Mint USDC to investors
    usdc_stellar.mint(&senior_lp, &100_000_000_000);
    usdc_stellar.mint(&junior_lp, &100_000_000_000);

    // 1. Borrower creates $100,000 export factoring facility for 90 days (7,776,000 s)
    // Senior Tranche: $80,000 (8.5% APR)
    // Junior Tranche: $20,000 (16.5% APR)
    let invoice_ref = String::from_str(&env, "INV-2026-COCOA-EXPORT-LAGOS");
    let facility_id = client.create_facility(
        &borrower,
        &invoice_ref,
        &usdc_id.address(),
        &80_000_000_000,
        &20_000_000_000,
        &850,
        &1650,
        &7_776_000,
    );
    assert_eq!(facility_id, 1);

    // 2. Investors deposit into tranches
    client.deposit_senior(&senior_lp, &facility_id, &80_000_000_000);
    client.deposit_junior(&junior_lp, &facility_id, &20_000_000_000);

    let facility = client.get_facility(&facility_id);
    assert_eq!(facility.senior_funded, 80_000_000_000);
    assert_eq!(facility.junior_funded, 20_000_000_000);

    // 3. Borrower draws down full $100,000
    client.drawdown(&borrower, &facility_id);
    assert_eq!(usdc_token.balance(&borrower), 100_000_000_000);

    let active_facility = client.get_facility(&facility_id);
    assert_eq!(active_facility.status, FacilityStatus::Active);

    // 4. Borrower repays principal + interest
    usdc_stellar.mint(&borrower, &15_000_000_000); // extra for interest
    client.repay(&borrower, &facility_id, &105_000_000_000);

    let repaid_facility = client.get_facility(&facility_id);
    assert_eq!(repaid_facility.status, FacilityStatus::Repaid);
}
