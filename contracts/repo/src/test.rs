#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

// Gating is tested against the real compliance contract. Build it first:
// `cargo build --target wasm32v1-none --release`.
mod compliance_wasm {
    soroban_sdk::contractimport!(file = "../../target/wasm32v1-none/release/aegis_compliance.wasm");
}

struct Setup<'a> {
    env: Env,
    admin: Address,
    repo: AegisRepoContractClient<'a>,
    repo_id: Address,
    compliance: compliance_wasm::Client<'a>,
    collateral: TokenClient<'a>,
    cash: TokenClient<'a>,
    borrower: Address,
    lender: Address,
}

fn setup<'a>(required_tier: u32) -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| li.timestamp = 1_000);

    let admin = Address::generate(&env);
    let compliance_id = env.register(compliance_wasm::WASM, ());
    let compliance = compliance_wasm::Client::new(&env, &compliance_id);
    compliance.initialize(&admin);

    let repo_id = env.register(AegisRepoContract, ());
    let repo = AegisRepoContractClient::new(&env, &repo_id);
    repo.initialize(&admin, &compliance_id, &required_tier);

    let issuer = Address::generate(&env);
    let collateral_addr = env.register_stellar_asset_contract_v2(issuer.clone()).address();
    let cash_addr = env.register_stellar_asset_contract_v2(issuer).address();

    let borrower = Address::generate(&env);
    let lender = Address::generate(&env);
    StellarAssetClient::new(&env, &collateral_addr).mint(&borrower, &1_000_000);
    StellarAssetClient::new(&env, &cash_addr).mint(&lender, &1_000_000);
    StellarAssetClient::new(&env, &cash_addr).mint(&borrower, &100_000);

    Setup {
        collateral: TokenClient::new(&env, &collateral_addr),
        cash: TokenClient::new(&env, &cash_addr),
        env,
        admin,
        repo,
        repo_id,
        compliance,
        borrower,
        lender,
    }
}

/// 1,000,000 collateral at a 10% haircut backs up to 900,000 cash; 5% for one year
fn propose(s: &Setup) -> u64 {
    s.repo.propose_repo(
        &s.borrower,
        &s.collateral.address,
        &1_000_000,
        &s.cash.address,
        &900_000,
        &500,
        &31_536_000,
        &1_000,
    )
}

#[test]
fn test_repo_dvp_lifecycle() {
    let s = setup(0);
    let id = propose(&s);
    assert_eq!(s.collateral.balance(&s.repo_id), 1_000_000);

    s.repo.execute_dvp(&s.lender, &id);
    let a = s.repo.get_agreement(&id);
    assert_eq!(a.status, RepoStatus::Active);
    assert_eq!(a.repurchase_amount, 945_000);
    assert_eq!(s.cash.balance(&s.borrower), 1_000_000);

    s.repo.settle_repurchase(&s.borrower, &id);
    assert_eq!(s.repo.get_agreement(&id).status, RepoStatus::Closed);
    assert_eq!(s.cash.balance(&s.lender), 100_000 + 945_000);
    assert_eq!(s.collateral.balance(&s.borrower), 1_000_000);
    assert_eq!(s.collateral.balance(&s.repo_id), 0);
}

/// Regression: settle_repurchase used to accept any caller as "borrower", so a
/// third party could pay the debt and take collateral worth more than it.
#[test]
fn test_third_party_cannot_settle_and_take_collateral() {
    let s = setup(0);
    let id = propose(&s);
    s.repo.execute_dvp(&s.lender, &id);

    let attacker = Address::generate(&s.env);
    StellarAssetClient::new(&s.env, &s.cash.address).mint(&attacker, &2_000_000);

    assert_eq!(
        s.repo.try_settle_repurchase(&attacker, &id),
        Err(Ok(RepoError::Unauthorized))
    );
    assert_eq!(s.collateral.balance(&attacker), 0);
    assert_eq!(s.collateral.balance(&s.repo_id), 1_000_000);
}

#[test]
fn test_cancel_returns_collateral_only_while_pending() {
    let s = setup(0);
    let id = propose(&s);
    let stranger = Address::generate(&s.env);

    assert_eq!(s.repo.try_cancel_repo(&stranger, &id), Err(Ok(RepoError::Unauthorized)));
    s.repo.cancel_repo(&s.borrower, &id);
    assert_eq!(s.repo.get_agreement(&id).status, RepoStatus::Cancelled);
    assert_eq!(s.collateral.balance(&s.borrower), 1_000_000);
    assert_eq!(s.repo.try_execute_dvp(&s.lender, &id), Err(Ok(RepoError::InvalidStatus)));

    let funded = propose(&s);
    s.repo.execute_dvp(&s.lender, &funded);
    assert_eq!(s.repo.try_cancel_repo(&s.borrower, &funded), Err(Ok(RepoError::InvalidStatus)));
}

#[test]
fn test_liquidation_only_by_lender_after_maturity() {
    let s = setup(0);
    let id = propose(&s);
    s.repo.execute_dvp(&s.lender, &id);

    assert_eq!(s.repo.try_liquidate_default(&s.lender, &id), Err(Ok(RepoError::TermNotExpired)));

    s.env.ledger().with_mut(|li| li.timestamp = 1_000 + 31_536_000 + 1);
    let stranger = Address::generate(&s.env);
    assert_eq!(s.repo.try_liquidate_default(&stranger, &id), Err(Ok(RepoError::Unauthorized)));

    s.repo.liquidate_default(&s.lender, &id);
    assert_eq!(s.repo.get_agreement(&id).status, RepoStatus::Liquidated);
    assert_eq!(s.collateral.balance(&s.lender), 1_000_000);
    assert_eq!(s.repo.try_settle_repurchase(&s.borrower, &id), Err(Ok(RepoError::InvalidStatus)));
}

#[test]
fn test_terms_are_validated() {
    let s = setup(0);
    let c = s.collateral.address.clone();
    let k = s.cash.address.clone();

    // Above the haircut-adjusted limit
    assert_eq!(
        s.repo.try_propose_repo(&s.borrower, &c, &1_000_000, &k, &900_001, &500, &86_400, &1_000),
        Err(Ok(RepoError::HaircutExceeded))
    );
    // Haircut of 100% or more
    assert_eq!(
        s.repo.try_propose_repo(&s.borrower, &c, &1_000_000, &k, &1, &500, &86_400, &10_000),
        Err(Ok(RepoError::InvalidTerms))
    );
    // Rate above 100% a year, term too short, same token on both legs
    assert_eq!(
        s.repo.try_propose_repo(&s.borrower, &c, &1_000_000, &k, &1, &10_001, &86_400, &1_000),
        Err(Ok(RepoError::InvalidTerms))
    );
    assert_eq!(
        s.repo.try_propose_repo(&s.borrower, &c, &1_000_000, &k, &1, &500, &59, &1_000),
        Err(Ok(RepoError::InvalidTerms))
    );
    assert_eq!(
        s.repo.try_propose_repo(&s.borrower, &c, &1_000_000, &c, &1, &500, &86_400, &1_000),
        Err(Ok(RepoError::InvalidTerms))
    );
    assert_eq!(
        s.repo.try_propose_repo(&s.borrower, &c, &0, &k, &1, &500, &86_400, &1_000),
        Err(Ok(RepoError::InvalidAmount))
    );

    // Borrower can't fund their own repo
    let id = propose(&s);
    assert_eq!(s.repo.try_execute_dvp(&s.borrower, &id), Err(Ok(RepoError::Unauthorized)));
}

#[test]
fn test_compliance_tier_gates_both_sides() {
    let s = setup(2);

    assert_eq!(
        s.repo.try_propose_repo(
            &s.borrower, &s.collateral.address, &1_000_000, &s.cash.address, &900_000, &500, &86_400, &1_000
        ),
        Err(Ok(RepoError::NotEligible))
    );

    // Retail is below the required Accredited tier
    s.compliance.set_investor_tier(&s.admin, &s.borrower, &1, &566, &100_000);
    assert_eq!(
        s.repo.try_propose_repo(
            &s.borrower, &s.collateral.address, &1_000_000, &s.cash.address, &900_000, &500, &86_400, &1_000
        ),
        Err(Ok(RepoError::NotEligible))
    );

    s.compliance.set_investor_tier(&s.admin, &s.borrower, &2, &566, &100_000);
    let id = propose(&s);
    assert_eq!(s.repo.try_execute_dvp(&s.lender, &id), Err(Ok(RepoError::NotEligible)));

    s.compliance.set_investor_tier(&s.admin, &s.lender, &3, &840, &100_000);
    s.repo.execute_dvp(&s.lender, &id);

    // A sanctioned borrower can still settle an existing repo (settlement isn't gated)
    s.compliance.set_sanction_status(&s.admin, &s.borrower, &true);
    s.repo.settle_repurchase(&s.borrower, &id);
    assert_eq!(s.repo.get_agreement(&id).status, RepoStatus::Closed);
}
