#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, String,
};

mod compliance_wasm {
    soroban_sdk::contractimport!(file = "../../target/wasm32v1-none/release/aegis_compliance.wasm");
}

const YEAR: u64 = 31_536_000;

struct Setup<'a> {
    env: Env,
    admin: Address,
    credit: AegisCreditContractClient<'a>,
    credit_id: Address,
    compliance: compliance_wasm::Client<'a>,
    usdc: TokenClient<'a>,
    usdc_admin: StellarAssetClient<'a>,
    borrower: Address,
    senior_a: Address,
    senior_b: Address,
    junior: Address,
}

fn setup<'a>(required_tier: u32) -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| li.timestamp = 1_000);

    let admin = Address::generate(&env);
    let compliance_id = env.register(compliance_wasm::WASM, ());
    let compliance = compliance_wasm::Client::new(&env, &compliance_id);
    compliance.initialize(&admin);

    let credit_id = env.register(AegisCreditContract, ());
    let credit = AegisCreditContractClient::new(&env, &credit_id);
    credit.initialize(&admin, &compliance_id, &required_tier);

    let usdc_addr = env.register_stellar_asset_contract_v2(Address::generate(&env)).address();
    let usdc_admin = StellarAssetClient::new(&env, &usdc_addr);
    let (borrower, senior_a, senior_b, junior) = (
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    );
    for who in [&senior_a, &senior_b, &junior] {
        usdc_admin.mint(who, &1_000_000);
    }

    Setup {
        usdc: TokenClient::new(&env, &usdc_addr),
        usdc_admin,
        env,
        admin,
        credit,
        credit_id,
        compliance,
        borrower,
        senior_a,
        senior_b,
        junior,
    }
}

/// Senior 800,000 at 10% APR, junior 200,000 at 20% APR, one year:
/// senior is owed 880,000, junior 240,000, 1,120,000 in total.
fn funded_facility(s: &Setup) -> u64 {
    let id = s.credit.create_facility(
        &s.borrower,
        &String::from_str(&s.env, "INV-2026-0042"),
        &s.usdc.address,
        &800_000,
        &200_000,
        &1_000,
        &2_000,
        &YEAR,
    );
    s.credit.deposit(&s.senior_a, &id, &SENIOR, &600_000);
    s.credit.deposit(&s.senior_b, &id, &SENIOR, &200_000);
    s.credit.deposit(&s.junior, &id, &JUNIOR, &200_000);
    id
}

#[test]
fn test_full_lifecycle_pays_both_tranches_with_interest() {
    let s = setup(0);
    let id = funded_facility(&s);
    assert_eq!(s.credit.amounts_owed(&id), (880_000, 240_000));

    assert_eq!(s.credit.drawdown(&s.borrower, &id), 1_000_000);
    assert_eq!(s.usdc.balance(&s.borrower), 1_000_000);

    s.usdc_admin.mint(&s.borrower, &120_000);
    s.credit.repay(&s.borrower, &id, &1_120_000);
    assert_eq!(s.credit.get_facility(&id).status, FacilityStatus::Repaid);

    assert_eq!(s.credit.claim(&s.senior_a, &id), 660_000); // 600k + 10%
    assert_eq!(s.credit.claim(&s.senior_b, &id), 220_000);
    assert_eq!(s.credit.claim(&s.junior, &id), 240_000); // 200k + 20%
    assert_eq!(s.usdc.balance(&s.credit_id), 0);
    assert_eq!(s.credit.try_claim(&s.junior, &id), Err(Ok(CreditError::NothingToClaim)));
}

#[test]
fn test_waterfall_pays_senior_first_and_junior_absorbs_losses() {
    let s = setup(0);
    let id = funded_facility(&s);
    s.credit.drawdown(&s.borrower, &id);

    // Only 700,000 comes back: all of it belongs to senior, junior gets nothing
    s.credit.repay(&s.borrower, &id, &700_000);
    assert_eq!(s.credit.get_position(&id, &s.junior).claimable, 0);
    assert_eq!(s.credit.claim(&s.senior_a, &id), 525_000); // 600/800 of 700k
    assert_eq!(s.credit.claim(&s.senior_b, &id), 175_000);
    assert_eq!(s.credit.try_claim(&s.junior, &id), Err(Ok(CreditError::NothingToClaim)));

    // Default after the grace period; a late recovery still flows down the waterfall
    s.env.ledger().with_mut(|li| li.timestamp = 1_000 + YEAR + DEFAULT_GRACE_SECONDS + 1);
    s.credit.mark_default(&id);
    assert_eq!(s.credit.get_facility(&id).status, FacilityStatus::Defaulted);

    s.usdc_admin.mint(&s.borrower, &300_000);
    s.credit.repay(&s.borrower, &id, &300_000); // senior needs 180k more, junior gets 120k
    assert_eq!(s.credit.claim(&s.senior_a, &id), 135_000); // incremental claim
    assert_eq!(s.credit.claim(&s.senior_b, &id), 45_000);
    assert_eq!(s.credit.claim(&s.junior, &id), 120_000);
    assert_eq!(s.usdc.balance(&s.credit_id), 0);
}

#[test]
fn test_repayment_is_capped_at_amount_owed() {
    let s = setup(0);
    let id = funded_facility(&s);
    s.credit.drawdown(&s.borrower, &id);

    s.usdc_admin.mint(&s.borrower, &500_000);
    assert_eq!(s.credit.repay(&s.borrower, &id, &1_500_000), 1_120_000);
    assert_eq!(s.usdc.balance(&s.borrower), 380_000);
    assert_eq!(s.credit.try_repay(&s.borrower, &id, &1), Err(Ok(CreditError::InvalidStatus)));
}

#[test]
fn test_cancel_and_refund_before_drawdown() {
    let s = setup(0);
    let id = s.credit.create_facility(
        &s.borrower, &String::from_str(&s.env, "INV-7"), &s.usdc.address, &800_000, &200_000, &1_000, &2_000, &YEAR,
    );
    s.credit.deposit(&s.senior_a, &id, &SENIOR, &300_000);
    s.credit.deposit(&s.junior, &id, &JUNIOR, &50_000);
    assert_eq!(s.credit.try_drawdown(&s.borrower, &id), Err(Ok(CreditError::NotFullyFunded)));

    let stranger = Address::generate(&s.env);
    assert_eq!(s.credit.try_cancel_facility(&stranger, &id), Err(Ok(CreditError::Unauthorized)));
    assert_eq!(s.credit.try_refund(&s.senior_a, &id), Err(Ok(CreditError::InvalidStatus)));

    s.credit.cancel_facility(&s.borrower, &id);
    assert_eq!(s.credit.refund(&s.senior_a, &id), 300_000);
    assert_eq!(s.credit.refund(&s.junior, &id), 50_000);
    assert_eq!(s.usdc.balance(&s.senior_a), 1_000_000);
    assert_eq!(s.usdc.balance(&s.credit_id), 0);
    assert_eq!(s.credit.try_refund(&s.junior, &id), Err(Ok(CreditError::NothingToClaim)));
    assert_eq!(
        s.credit.try_deposit(&s.senior_b, &id, &SENIOR, &1),
        Err(Ok(CreditError::InvalidStatus))
    );
}

#[test]
fn test_tranche_limits_terms_and_access() {
    let s = setup(0);
    let id = funded_facility(&s);
    // Fully funded but not yet drawn: still raising, so the tranche cap applies
    assert_eq!(s.credit.try_deposit(&s.senior_a, &id, &SENIOR, &1), Err(Ok(CreditError::TrancheFull)));

    let open = s.credit.create_facility(
        &s.borrower, &String::from_str(&s.env, "INV-8"), &s.usdc.address, &100, &100, &0, &0, &86_400,
    );
    assert_eq!(s.credit.try_deposit(&s.senior_a, &open, &SENIOR, &101), Err(Ok(CreditError::TrancheFull)));
    assert_eq!(s.credit.try_deposit(&s.senior_a, &open, &2, &10), Err(Ok(CreditError::InvalidTranche)));
    assert_eq!(s.credit.try_deposit(&s.senior_a, &open, &SENIOR, &0), Err(Ok(CreditError::InvalidAmount)));
    assert_eq!(s.credit.try_drawdown(&s.senior_a, &id), Err(Ok(CreditError::Unauthorized)));

    assert_eq!(
        s.credit.try_create_facility(
            &s.borrower, &String::from_str(&s.env, "x"), &s.usdc.address, &100, &100, &10_001, &0, &86_400,
        ),
        Err(Ok(CreditError::InvalidTerms))
    );
    assert_eq!(s.credit.try_mark_default(&id), Err(Ok(CreditError::InvalidStatus)));
}

#[test]
fn test_compliance_tier_gates_borrowers_and_investors() {
    let s = setup(1);
    let invoice = String::from_str(&s.env, "INV-9");
    assert_eq!(
        s.credit.try_create_facility(&s.borrower, &invoice, &s.usdc.address, &100, &100, &0, &0, &86_400),
        Err(Ok(CreditError::NotEligible))
    );

    s.compliance.set_investor_tier(&s.admin, &s.borrower, &3, &566, &1_000_000);
    let id = s.credit.create_facility(&s.borrower, &invoice, &s.usdc.address, &100, &100, &0, &0, &86_400);
    assert_eq!(s.credit.try_deposit(&s.senior_a, &id, &SENIOR, &100), Err(Ok(CreditError::NotEligible)));

    s.compliance.set_investor_tier(&s.admin, &s.senior_a, &1, &566, &1_000_000);
    s.credit.deposit(&s.senior_a, &id, &SENIOR, &100);
}
