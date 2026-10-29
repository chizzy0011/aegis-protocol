#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RepoError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    AgreementNotFound = 4,
    InvalidStatus = 5,
    TermNotExpired = 6,
    TermExpired = 7,
    InvalidAmount = 8,
    HaircutExceeded = 9,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum RepoStatus {
    Pending = 0,
    Active = 1,
    Closed = 2,
    Liquidated = 3,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct RepoAgreement {
    pub id: u64,
    pub borrower: Address,
    pub lender: Option<Address>,
    pub collateral_token: Address,
    pub collateral_amount: i128,
    pub cash_token: Address,
    pub cash_borrowed: i128,
    pub repurchase_amount: i128,
    pub repo_rate_bps: u32,
    pub term_seconds: u64,
    pub haircut_bps: u32,
    pub start_timestamp: u64,
    pub maturity_timestamp: u64,
    pub status: RepoStatus,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    ComplianceContract,
    RepoCount,
    Repo(u64),
}

#[contract]
pub struct AegisRepoContract;

#[contractimpl]
impl AegisRepoContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        compliance_contract: Address,
    ) -> Result<(), RepoError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(RepoError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::ComplianceContract, &compliance_contract);
        env.storage().instance().set(&DataKey::RepoCount, &0u64);

        Ok(())
    }

    pub fn propose_repo(
        env: Env,
        borrower: Address,
        collateral_token: Address,
        collateral_amount: i128,
        cash_token: Address,
        cash_requested: i128,
        repo_rate_bps: u32,
        term_seconds: u64,
        haircut_bps: u32,
    ) -> Result<u64, RepoError> {
        borrower.require_auth();

        if collateral_amount <= 0 || cash_requested <= 0 {
            return Err(RepoError::InvalidAmount);
        }

        // Validate haircut: cash requested cannot exceed collateral adjusted for haircut
        let max_borrowable = (collateral_amount * (10000 - haircut_bps as i128)) / 10000;
        if cash_requested > max_borrowable {
            return Err(RepoError::HaircutExceeded);
        }

        // Lock collateral into contract escrow upon proposal
        let collateral_client = token::Client::new(&env, &collateral_token);
        collateral_client.transfer(
            &borrower,
            &env.current_contract_address(),
            &collateral_amount,
        );

        // Calculate repurchase amount with annual repo rate:
        let interest = (cash_requested * repo_rate_bps as i128 * term_seconds as i128)
            / (10000 * 31_536_000);
        let repurchase_amount = cash_requested + interest;

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::RepoCount)
            .unwrap_or(0);
        count += 1;

        let agreement = RepoAgreement {
            id: count,
            borrower: borrower.clone(),
            lender: None,
            collateral_token,
            collateral_amount,
            cash_token,
            cash_borrowed: cash_requested,
            repurchase_amount,
            repo_rate_bps,
            term_seconds,
            haircut_bps,
            start_timestamp: 0,
            maturity_timestamp: 0,
            status: RepoStatus::Pending,
        };

        env.storage().instance().set(&DataKey::Repo(count), &agreement);
        env.storage().instance().set(&DataKey::RepoCount, &count);

        Ok(count)
    }

    pub fn execute_dvp(env: Env, lender: Address, repo_id: u64) -> Result<(), RepoError> {
        lender.require_auth();

        let mut agreement: RepoAgreement = env
            .storage()
            .instance()
            .get(&DataKey::Repo(repo_id))
            .ok_or(RepoError::AgreementNotFound)?;

        if agreement.status != RepoStatus::Pending {
            return Err(RepoError::InvalidStatus);
        }

        let current_time = env.ledger().timestamp();
        agreement.lender = Some(lender.clone());
        agreement.start_timestamp = current_time;
        agreement.maturity_timestamp = current_time + agreement.term_seconds;
        agreement.status = RepoStatus::Active;

        // Atomic DvP Transfer:
        // Transfer cash from lender directly to borrower
        let cash_client = token::Client::new(&env, &agreement.cash_token);
        cash_client.transfer(
            &lender,
            &agreement.borrower,
            &agreement.cash_borrowed,
        );

        env.storage().instance().set(&DataKey::Repo(repo_id), &agreement);

        Ok(())
    }

    pub fn settle_repurchase(env: Env, borrower: Address, repo_id: u64) -> Result<(), RepoError> {
        borrower.require_auth();

        let mut agreement: RepoAgreement = env
            .storage()
            .instance()
            .get(&DataKey::Repo(repo_id))
            .ok_or(RepoError::AgreementNotFound)?;

        if agreement.status != RepoStatus::Active {
            return Err(RepoError::InvalidStatus);
        }

        let lender = agreement.lender.clone().ok_or(RepoError::InvalidStatus)?;

        // 1. Borrower transfers repurchase amount (cash + repo interest) to lender
        let cash_client = token::Client::new(&env, &agreement.cash_token);
        cash_client.transfer(&borrower, &lender, &agreement.repurchase_amount);

        // 2. Contract releases collateral from escrow back to borrower
        let collateral_client = token::Client::new(&env, &agreement.collateral_token);
        collateral_client.transfer(
            &env.current_contract_address(),
            &borrower,
            &agreement.collateral_amount,
        );

        agreement.status = RepoStatus::Closed;
        env.storage().instance().set(&DataKey::Repo(repo_id), &agreement);

        Ok(())
    }

    pub fn liquidate_default(env: Env, lender: Address, repo_id: u64) -> Result<(), RepoError> {
        lender.require_auth();

        let mut agreement: RepoAgreement = env
            .storage()
            .instance()
            .get(&DataKey::Repo(repo_id))
            .ok_or(RepoError::AgreementNotFound)?;

        if agreement.status != RepoStatus::Active {
            return Err(RepoError::InvalidStatus);
        }

        let assigned_lender = agreement.lender.clone().ok_or(RepoError::InvalidStatus)?;
        if lender != assigned_lender {
            return Err(RepoError::Unauthorized);
        }

        // Verify maturity timestamp has passed
        if env.ledger().timestamp() <= agreement.maturity_timestamp {
            return Err(RepoError::TermNotExpired);
        }

        // Default liquidation: contract transfers collateral to lender
        let collateral_client = token::Client::new(&env, &agreement.collateral_token);
        collateral_client.transfer(
            &env.current_contract_address(),
            &lender,
            &agreement.collateral_amount,
        );

        agreement.status = RepoStatus::Liquidated;
        env.storage().instance().set(&DataKey::Repo(repo_id), &agreement);

        Ok(())
    }

    pub fn get_agreement(env: Env, repo_id: u64) -> Result<RepoAgreement, RepoError> {
        env.storage()
            .instance()
            .get(&DataKey::Repo(repo_id))
            .ok_or(RepoError::AgreementNotFound)
    }
}

#[cfg(test)]
mod test;
