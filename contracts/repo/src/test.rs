#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

#[test]
fn test_repo_dvp_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let compliance = Address::generate(&env);
    let borrower = Address::generate(&env);
    let lender = Address::generate(&env);

    let contract_id = env.register(AegisRepoContract, ());
    let client = AegisRepoContractClient::new(&env, &contract_id);

    client.initialize(&admin, &compliance);

    // Mock token contracts
    let collateral_admin = Address::generate(&env);
    let collateral_id = env.register_stellar_asset_contract_v2(collateral_admin);
    let collateral_token = token::Client::new(&env, &collateral_id.address());
    let collateral_stellar = token::StellarAssetClient::new(&env, &collateral_id.address());

    let cash_admin = Address::generate(&env);
    let cash_id = env.register_stellar_asset_contract_v2(cash_admin);
    let cash_token = token::Client::new(&env, &cash_id.address());
    let cash_stellar = token::StellarAssetClient::new(&env, &cash_id.address());

    // Mint collateral to borrower ($100,000 of Spiko T-Bills)
    collateral_stellar.mint(&borrower, &100_000_000_000);
    // Mint cash to lender ($100,000 USDC)
    cash_stellar.mint(&lender, &100_000_000_000);

    // 1. Borrower proposes 7-day repo with 5.2% repo rate and 2% haircut
    // Collateral: $50,000; Borrowing: $49,000
    let repo_id = client.propose_repo(
        &borrower,
        &collateral_id.address(),
        &50_000_000_000,
        &cash_id.address(),
        &49_000_000_000,
        &520, // 5.20%
        &604_800, // 7 days
        &200, // 2% haircut
    );
    assert_eq!(repo_id, 1);

    // 2. Lender executes atomic DvP
    client.execute_dvp(&lender, &repo_id);

    let agreement = client.get_agreement(&repo_id);
    assert_eq!(agreement.status, RepoStatus::Active);
    assert_eq!(agreement.lender, Some(lender.clone()));
    assert_eq!(collateral_token.balance(&contract_id), 50_000_000_000);
    assert_eq!(cash_token.balance(&borrower), 49_000_000_000);

    // Mint extra cash to borrower to cover interest payment
    cash_stellar.mint(&borrower, &1_000_000_000);

    // 3. Borrower repays and settles repurchase
    client.settle_repurchase(&borrower, &repo_id);

    let settled = client.get_agreement(&repo_id);
    assert_eq!(settled.status, RepoStatus::Closed);
    assert_eq!(collateral_token.balance(&contract_id), 0);
    assert_eq!(collateral_token.balance(&borrower), 100_000_000_000);
}

#[test]
fn test_default_liquidation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let compliance = Address::generate(&env);
    let borrower = Address::generate(&env);
    let lender = Address::generate(&env);

    let contract_id = env.register(AegisRepoContract, ());
    let client = AegisRepoContractClient::new(&env, &contract_id);
    client.initialize(&admin, &compliance);

    let collateral_admin = Address::generate(&env);
    let collateral_id = env.register_stellar_asset_contract_v2(collateral_admin);
    let collateral_token = token::Client::new(&env, &collateral_id.address());
    let collateral_stellar = token::StellarAssetClient::new(&env, &collateral_id.address());

    let cash_admin = Address::generate(&env);
    let cash_id = env.register_stellar_asset_contract_v2(cash_admin);
    let cash_stellar = token::StellarAssetClient::new(&env, &cash_id.address());

    collateral_stellar.mint(&borrower, &50_000_000_000);
    cash_stellar.mint(&lender, &50_000_000_000);

    let repo_id = client.propose_repo(
        &borrower,
        &collateral_id.address(),
        &50_000_000_000,
        &cash_id.address(),
        &48_000_000_000,
        &500,
        &86_400, // 1 day
        &400,
    );

    client.execute_dvp(&lender, &repo_id);

    // Fast-forward time past maturity
    env.ledger().set_timestamp(100_000);

    // Lender liquidates default
    client.liquidate_default(&lender, &repo_id);

    let agreement = client.get_agreement(&repo_id);
    assert_eq!(agreement.status, RepoStatus::Liquidated);
    assert_eq!(collateral_token.balance(&lender), 50_000_000_000);
}
