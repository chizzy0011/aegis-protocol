#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    Address, Env,
};

#[test]
fn test_compliance_and_sep8_verification() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let institutional_investor = Address::generate(&env);
    let retail_investor = Address::generate(&env);

    let contract_id = env.register(AegisComplianceContract, ());
    let client = AegisComplianceContractClient::new(&env, &contract_id);

    client.initialize(&admin);

    let future_time = 10_000_000;
    // Onboard institutional investor (Tier 3, US = 840)
    client.set_investor_tier(&admin, &institutional_investor, &3, &840, &future_time);
    // Onboard retail investor (Tier 1)
    client.set_investor_tier(&admin, &retail_investor, &1, &840, &future_time);

    // Verify institutional access
    assert_eq!(
        client.verify_institutional_access(&institutional_investor),
        true
    );
    assert_eq!(
        client.verify_institutional_access(&retail_investor),
        false
    );

    // Verify SEP-8 compliance check
    let sep8_ok = client.check_sep8_compliance(
        &institutional_investor,
        &retail_investor,
        &1_000_000,
    );
    assert_eq!(sep8_ok, true);

    // Sanction check
    client.set_sanction_status(&admin, &institutional_investor, &true);
    let result = client.try_verify_institutional_access(&institutional_investor);
    assert!(result.is_err());
}
