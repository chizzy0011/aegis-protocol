#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    Address, Env, String,
};

#[test]
fn test_anchor_settlement_dispatch() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let credit_contract = Address::generate(&env);
    let anchor_cowrie = Address::generate(&env);

    let contract_id = env.register(AegisSettlementContract, ());
    let client = AegisSettlementContractClient::new(&env, &contract_id);

    client.initialize(&admin, &credit_contract);

    // Register Cowrie NGN anchor
    let currency_ngn = String::from_str(&env, "NGN");
    client.register_anchor(&admin, &anchor_cowrie, &currency_ngn);

    // Dispatch payout for facility #1
    let recipient_bank = String::from_str(&env, "0123456789-AccessBank-NG");
    let settlement_id = client.dispatch_payout(
        &credit_contract,
        &1,
        &anchor_cowrie,
        &50_000_000_000,
        &recipient_bank,
    );
    assert_eq!(settlement_id, 1);

    let record = client.get_settlement(&settlement_id);
    assert_eq!(record.confirmed, false);
    assert_eq!(record.fiat_currency, currency_ngn);

    // Anchor confirms off-ramp completed
    client.confirm_settlement(&anchor_cowrie, &settlement_id);

    let confirmed_record = client.get_settlement(&settlement_id);
    assert_eq!(confirmed_record.confirmed, true);
}
