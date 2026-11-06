#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

fn setup<'a>() -> (Env, AegisComplianceContractClient<'a>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| li.timestamp = 1_000);
    let id = env.register(AegisComplianceContract, ());
    let client = AegisComplianceContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, client, admin)
}

#[test]
fn test_tier_of_reflects_registration_sanctions_and_expiry() {
    let (env, client, admin) = setup();
    let investor = Address::generate(&env);

    assert_eq!(client.tier_of(&investor), 0);

    client.set_investor_tier(&admin, &investor, &2, &566, &2_000);
    assert_eq!(client.tier_of(&investor), 2);

    client.set_sanction_status(&admin, &investor, &true);
    assert_eq!(client.tier_of(&investor), 0);
    assert_eq!(
        client.try_check_transfer(&investor, &investor),
        Err(Ok(ComplianceError::SanctionedAddress))
    );

    client.set_sanction_status(&admin, &investor, &false);
    assert_eq!(client.tier_of(&investor), 2);

    env.ledger().with_mut(|li| li.timestamp = 2_001);
    assert_eq!(client.tier_of(&investor), 0);
    assert_eq!(
        client.try_verify_institutional_access(&investor),
        Err(Ok(ComplianceError::KycExpired))
    );
}

#[test]
fn test_institutional_access_and_transfer_checks() {
    let (env, client, admin) = setup();
    let fund = Address::generate(&env);
    let desk = Address::generate(&env);
    let stranger = Address::generate(&env);

    client.set_investor_tier(&admin, &fund, &3, &840, &10_000);
    client.set_investor_tier(&admin, &desk, &1, &566, &10_000);

    assert!(client.verify_institutional_access(&fund));
    assert!(!client.verify_institutional_access(&desk));
    assert!(client.check_transfer(&fund, &desk));
    assert_eq!(
        client.try_check_transfer(&fund, &stranger),
        Err(Ok(ComplianceError::InvestorNotFound))
    );
}

#[test]
fn test_only_admin_can_register_and_tiers_are_validated() {
    let (env, client, admin) = setup();
    let impostor = Address::generate(&env);
    let investor = Address::generate(&env);

    assert_eq!(
        client.try_set_investor_tier(&impostor, &investor, &3, &840, &10_000),
        Err(Ok(ComplianceError::Unauthorized))
    );
    assert_eq!(
        client.try_set_investor_tier(&admin, &investor, &4, &840, &10_000),
        Err(Ok(ComplianceError::InsufficientTier))
    );
    assert_eq!(
        client.try_initialize(&admin),
        Err(Ok(ComplianceError::AlreadyInitialized))
    );
}
