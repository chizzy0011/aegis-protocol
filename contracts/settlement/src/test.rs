#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::StellarAssetClient,
    Address, Env, String,
};

// Payouts are checked against the real credit contract. Build it first:
// `cargo build --target wasm32v1-none --release`.
mod credit_wasm {
    soroban_sdk::contractimport!(file = "../../target/wasm32v1-none/release/aegis_credit.wasm");
}

struct Setup<'a> {
    env: Env,
    admin: Address,
    settlement: AegisSettlementContractClient<'a>,
    credit: credit_wasm::Client<'a>,
    borrower: Address,
    anchor: Address,
    facility: u64,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| li.timestamp = 1_000);

    let admin = Address::generate(&env);
    let credit_id = env.register(credit_wasm::WASM, ());
    let credit = credit_wasm::Client::new(&env, &credit_id);
    // Tier 0: the compliance contract is never called
    credit.initialize(&admin, &Address::generate(&env), &0);

    let settlement_id = env.register(AegisSettlementContract, ());
    let settlement = AegisSettlementContractClient::new(&env, &settlement_id);
    settlement.initialize(&admin, &credit_id);

    let usdc = env.register_stellar_asset_contract_v2(Address::generate(&env)).address();
    let investor = Address::generate(&env);
    StellarAssetClient::new(&env, &usdc).mint(&investor, &1_000);

    let borrower = Address::generate(&env);
    let facility = credit.create_facility(
        &borrower, &String::from_str(&env, "INV-1"), &usdc, &600, &400, &0, &0, &86_400,
    );
    credit.deposit(&investor, &facility, &0, &600);
    credit.deposit(&investor, &facility, &1, &400);

    let anchor = Address::generate(&env);
    settlement.register_anchor(&admin, &anchor, &String::from_str(&env, "NGN"));

    Setup { env, admin, settlement, credit, borrower, anchor, facility }
}

fn tx_id(env: &Env) -> String {
    String::from_str(env, "sep24-82fhs729f63dh0v4")
}

#[test]
fn test_borrower_records_payout_after_drawdown_and_anchor_confirms() {
    let s = setup();

    assert_eq!(
        s.settlement.try_record_payout(&s.borrower, &s.facility, &s.anchor, &1_000, &tx_id(&s.env)),
        Err(Ok(SettlementError::FacilityNotDrawn))
    );

    s.credit.drawdown(&s.borrower, &s.facility);
    let id = s.settlement.record_payout(&s.borrower, &s.facility, &s.anchor, &1_000, &tx_id(&s.env));
    let record = s.settlement.get_settlement(&id);
    assert_eq!(record.fiat_currency, String::from_str(&s.env, "NGN"));
    assert!(!record.confirmed);

    let impostor = Address::generate(&s.env);
    assert_eq!(
        s.settlement.try_confirm_settlement(&impostor, &id),
        Err(Ok(SettlementError::Unauthorized))
    );
    s.settlement.confirm_settlement(&s.anchor, &id);
    assert!(s.settlement.get_settlement(&id).confirmed);
    assert_eq!(
        s.settlement.try_confirm_settlement(&s.anchor, &id),
        Err(Ok(SettlementError::AlreadyConfirmed))
    );
    assert_eq!(s.settlement.settlement_count(), 1);
}

#[test]
fn test_only_the_facility_borrower_can_record_payouts() {
    let s = setup();
    s.credit.drawdown(&s.borrower, &s.facility);

    let stranger = Address::generate(&s.env);
    assert_eq!(
        s.settlement.try_record_payout(&stranger, &s.facility, &s.anchor, &500, &tx_id(&s.env)),
        Err(Ok(SettlementError::Unauthorized))
    );
    // More than was drawn
    assert_eq!(
        s.settlement.try_record_payout(&s.borrower, &s.facility, &s.anchor, &1_001, &tx_id(&s.env)),
        Err(Ok(SettlementError::InvalidAmount))
    );
    let unknown_anchor = Address::generate(&s.env);
    assert_eq!(
        s.settlement.try_record_payout(&s.borrower, &s.facility, &unknown_anchor, &500, &tx_id(&s.env)),
        Err(Ok(SettlementError::AnchorNotRegistered))
    );
}

#[test]
fn test_only_admin_registers_anchors() {
    let s = setup();
    let impostor = Address::generate(&s.env);
    assert_eq!(
        s.settlement.try_register_anchor(&impostor, &impostor, &String::from_str(&s.env, "GHS")),
        Err(Ok(SettlementError::Unauthorized))
    );
    assert_eq!(
        s.settlement.try_initialize(&s.admin, &impostor),
        Err(Ok(SettlementError::AlreadyInitialized))
    );
}
