#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, vec, Address, Env,
    Symbol,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;
const RECORD_BUMP: u32 = 120 * DAY_IN_LEDGERS;
const RECORD_THRESHOLD: u32 = RECORD_BUMP - DAY_IN_LEDGERS;

const SECONDS_PER_YEAR: i128 = 31_536_000;
const MIN_TERM_SECONDS: u64 = 60;
const MAX_TERM_SECONDS: u64 = 365 * 24 * 60 * 60;
/// Annual repo rate ceiling (100%)
const MAX_RATE_BPS: u32 = 10_000;

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
    InvalidTerms = 10,
    NotEligible = 11,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum RepoStatus {
    Pending = 0,
    Active = 1,
    Closed = 2,
    Liquidated = 3,
    Cancelled = 4,
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

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct RepoConfig {
    pub admin: Address,
    pub compliance: Address,
    /// Minimum compliance tier for borrowers and lenders (0 = no check)
    pub required_tier: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Config,
    RepoCount,
    Repo(u64),
}

/// Bilateral repo with delivery-versus-payment: the borrower escrows collateral
/// on proposal, a lender funds it atomically, and the borrower repurchases at
/// maturity or the lender takes the collateral after a default.
#[contract]
pub struct AegisRepoContract;

#[contractimpl]
impl AegisRepoContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        compliance_contract: Address,
        required_tier: u32,
    ) -> Result<(), RepoError> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(RepoError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(
            &DataKey::Config,
            &RepoConfig { admin, compliance: compliance_contract, required_tier },
        );
        env.storage().instance().set(&DataKey::RepoCount, &0u64);
        Self::bump_instance(&env);
        Ok(())
    }

    pub fn get_config(env: Env) -> Result<RepoConfig, RepoError> {
        Self::config(&env)
    }

    /// Admin: change the minimum compliance tier (0 disables the check)
    pub fn set_required_tier(env: Env, required_tier: u32) -> Result<(), RepoError> {
        let mut config = Self::config(&env)?;
        config.admin.require_auth();
        config.required_tier = required_tier;
        env.storage().instance().set(&DataKey::Config, &config);
        Self::bump_instance(&env);
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
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
        let config = Self::config(&env)?;
        Self::require_eligible(&env, &config, &borrower)?;

        if collateral_amount <= 0 || cash_requested <= 0 {
            return Err(RepoError::InvalidAmount);
        }
        if haircut_bps >= 10_000
            || repo_rate_bps > MAX_RATE_BPS
            || term_seconds < MIN_TERM_SECONDS
            || term_seconds > MAX_TERM_SECONDS
            || collateral_token == cash_token
        {
            return Err(RepoError::InvalidTerms);
        }

        // Cash requested cannot exceed the collateral amount after the haircut
        let max_borrowable = (collateral_amount * (10_000 - haircut_bps as i128)) / 10_000;
        if cash_requested > max_borrowable {
            return Err(RepoError::HaircutExceeded);
        }

        // Escrow collateral on proposal; it only leaves through settle, cancel or liquidation
        token::Client::new(&env, &collateral_token).transfer(
            &borrower,
            &env.current_contract_address(),
            &collateral_amount,
        );

        let interest =
            (cash_requested * repo_rate_bps as i128 * term_seconds as i128) / (10_000 * SECONDS_PER_YEAR);

        let id: u64 = env.storage().instance().get(&DataKey::RepoCount).unwrap_or(0) + 1;
        let agreement = RepoAgreement {
            id,
            borrower: borrower.clone(),
            lender: None,
            collateral_token,
            collateral_amount,
            cash_token,
            cash_borrowed: cash_requested,
            repurchase_amount: cash_requested + interest,
            repo_rate_bps,
            term_seconds,
            haircut_bps,
            start_timestamp: 0,
            maturity_timestamp: 0,
            status: RepoStatus::Pending,
        };

        Self::save(&env, &agreement);
        env.storage().instance().set(&DataKey::RepoCount, &id);
        Self::bump_instance(&env);
        Self::emit(&env, symbol_short!("proposed"), &agreement);

        Ok(id)
    }

    /// Borrower withdraws an unfunded proposal and gets the collateral back
    pub fn cancel_repo(env: Env, borrower: Address, repo_id: u64) -> Result<(), RepoError> {
        borrower.require_auth();
        let mut agreement = Self::load(&env, repo_id)?;

        if agreement.status != RepoStatus::Pending {
            return Err(RepoError::InvalidStatus);
        }
        if agreement.borrower != borrower {
            return Err(RepoError::Unauthorized);
        }

        agreement.status = RepoStatus::Cancelled;
        Self::save(&env, &agreement);

        token::Client::new(&env, &agreement.collateral_token).transfer(
            &env.current_contract_address(),
            &borrower,
            &agreement.collateral_amount,
        );
        Self::emit(&env, symbol_short!("cancel"), &agreement);
        Ok(())
    }

    /// Lender funds a pending repo: cash goes to the borrower in the same
    /// transaction that locks in the lender's claim on the collateral.
    pub fn execute_dvp(env: Env, lender: Address, repo_id: u64) -> Result<(), RepoError> {
        lender.require_auth();
        let config = Self::config(&env)?;
        Self::require_eligible(&env, &config, &lender)?;

        let mut agreement = Self::load(&env, repo_id)?;
        if agreement.status != RepoStatus::Pending {
            return Err(RepoError::InvalidStatus);
        }
        if agreement.borrower == lender {
            return Err(RepoError::Unauthorized);
        }

        let now = env.ledger().timestamp();
        agreement.lender = Some(lender.clone());
        agreement.start_timestamp = now;
        agreement.maturity_timestamp = now + agreement.term_seconds;
        agreement.status = RepoStatus::Active;
        Self::save(&env, &agreement);

        token::Client::new(&env, &agreement.cash_token).transfer(
            &lender,
            &agreement.borrower,
            &agreement.cash_borrowed,
        );
        Self::emit(&env, symbol_short!("funded"), &agreement);
        Ok(())
    }

    /// Only the original borrower can repurchase. Allowed until the lender
    /// liquidates, including after maturity.
    pub fn settle_repurchase(env: Env, borrower: Address, repo_id: u64) -> Result<(), RepoError> {
        borrower.require_auth();
        let mut agreement = Self::load(&env, repo_id)?;

        if agreement.status != RepoStatus::Active {
            return Err(RepoError::InvalidStatus);
        }
        if agreement.borrower != borrower {
            return Err(RepoError::Unauthorized);
        }
        let lender = agreement.lender.clone().ok_or(RepoError::InvalidStatus)?;

        agreement.status = RepoStatus::Closed;
        Self::save(&env, &agreement);

        token::Client::new(&env, &agreement.cash_token).transfer(
            &borrower,
            &lender,
            &agreement.repurchase_amount,
        );
        token::Client::new(&env, &agreement.collateral_token).transfer(
            &env.current_contract_address(),
            &borrower,
            &agreement.collateral_amount,
        );
        Self::emit(&env, symbol_short!("settled"), &agreement);
        Ok(())
    }

    /// After maturity, the lender of an unsettled repo takes the collateral
    pub fn liquidate_default(env: Env, lender: Address, repo_id: u64) -> Result<(), RepoError> {
        lender.require_auth();
        let mut agreement = Self::load(&env, repo_id)?;

        if agreement.status != RepoStatus::Active {
            return Err(RepoError::InvalidStatus);
        }
        if agreement.lender != Some(lender.clone()) {
            return Err(RepoError::Unauthorized);
        }
        if env.ledger().timestamp() <= agreement.maturity_timestamp {
            return Err(RepoError::TermNotExpired);
        }

        agreement.status = RepoStatus::Liquidated;
        Self::save(&env, &agreement);

        token::Client::new(&env, &agreement.collateral_token).transfer(
            &env.current_contract_address(),
            &lender,
            &agreement.collateral_amount,
        );
        Self::emit(&env, symbol_short!("liquid"), &agreement);
        Ok(())
    }

    pub fn get_agreement(env: Env, repo_id: u64) -> Result<RepoAgreement, RepoError> {
        Self::load(&env, repo_id)
    }

    pub fn repo_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::RepoCount).unwrap_or(0)
    }

    fn config(env: &Env) -> Result<RepoConfig, RepoError> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(RepoError::NotInitialized)
    }

    fn require_eligible(env: &Env, config: &RepoConfig, account: &Address) -> Result<(), RepoError> {
        if config.required_tier == 0 {
            return Ok(());
        }
        let tier: u32 = env.invoke_contract(
            &config.compliance,
            &Symbol::new(env, "tier_of"),
            vec![env, account.to_val()],
        );
        if tier < config.required_tier {
            return Err(RepoError::NotEligible);
        }
        Ok(())
    }

    fn load(env: &Env, repo_id: u64) -> Result<RepoAgreement, RepoError> {
        env.storage()
            .persistent()
            .get(&DataKey::Repo(repo_id))
            .ok_or(RepoError::AgreementNotFound)
    }

    fn save(env: &Env, agreement: &RepoAgreement) {
        let key = DataKey::Repo(agreement.id);
        env.storage().persistent().set(&key, agreement);
        env.storage()
            .persistent()
            .extend_ttl(&key, RECORD_THRESHOLD, RECORD_BUMP);
    }

    fn bump_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
    }

    fn emit(env: &Env, topic: Symbol, agreement: &RepoAgreement) {
        env.events().publish(
            (topic, agreement.id),
            (agreement.borrower.clone(), agreement.cash_borrowed, agreement.status as u32),
        );
    }
}

#[cfg(test)]
mod test;
