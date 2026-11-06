#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, vec, Address, Env,
    String, Symbol,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;
const RECORD_BUMP: u32 = 120 * DAY_IN_LEDGERS;
const RECORD_THRESHOLD: u32 = RECORD_BUMP - DAY_IN_LEDGERS;

const SECONDS_PER_YEAR: i128 = 31_536_000;
const MIN_DURATION_SECONDS: u64 = 60;
const MAX_DURATION_SECONDS: u64 = 3 * 365 * 24 * 60 * 60;
const MAX_APR_BPS: u32 = 10_000;
/// A facility can be marked defaulted this long after its due date
pub const DEFAULT_GRACE_SECONDS: u64 = 7 * 24 * 60 * 60;

pub const SENIOR: u32 = 0;
pub const JUNIOR: u32 = 1;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CreditError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    FacilityNotFound = 3,
    InvalidStatus = 4,
    TrancheFull = 5,
    NotFullyFunded = 6,
    InvalidAmount = 7,
    NotInitialized = 8,
    InvalidTerms = 9,
    NotEligible = 10,
    NotDue = 11,
    NothingToClaim = 12,
    InvalidTranche = 13,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum FacilityStatus {
    Fundraising = 0,
    Active = 1,
    Repaid = 2,
    Defaulted = 3,
    Cancelled = 4,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct CreditFacility {
    pub id: u64,
    pub borrower: Address,
    pub invoice_ref: String,
    pub currency_token: Address,
    pub senior_target: i128,
    pub junior_target: i128,
    pub senior_funded: i128,
    pub junior_funded: i128,
    pub senior_apr_bps: u32,
    pub junior_apr_bps: u32,
    pub duration_seconds: u64,
    pub due_timestamp: u64,
    pub repaid_amount: i128,
    pub status: FacilityStatus,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct CreditConfig {
    pub admin: Address,
    pub compliance: Address,
    /// Minimum compliance tier for borrowers and investors (0 = no check)
    pub required_tier: u32,
}

/// An investor's position in one facility
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Position {
    pub senior: i128,
    pub junior: i128,
    pub claimed: i128,
    pub claimable: i128,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Config,
    FacilityCount,
    Facility(u64),
    SeniorDeposit(u64, Address),
    JuniorDeposit(u64, Address),
    Claimed(u64, Address),
}

/// Two-tranche trade-credit facility. Investors fund senior and junior
/// tranches; once both are full the borrower draws the USDC. Repayments are
/// distributed senior-first: senior principal plus interest is covered before
/// junior receives anything, so junior absorbs losses first.
#[contract]
pub struct AegisCreditContract;

#[contractimpl]
impl AegisCreditContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        compliance_contract: Address,
        required_tier: u32,
    ) -> Result<(), CreditError> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(CreditError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(
            &DataKey::Config,
            &CreditConfig { admin, compliance: compliance_contract, required_tier },
        );
        env.storage().instance().set(&DataKey::FacilityCount, &0u64);
        Self::bump_instance(&env);
        Ok(())
    }

    pub fn get_config(env: Env) -> Result<CreditConfig, CreditError> {
        Self::config(&env)
    }

    /// Admin: change the minimum compliance tier (0 disables the check)
    pub fn set_required_tier(env: Env, required_tier: u32) -> Result<(), CreditError> {
        let mut config = Self::config(&env)?;
        config.admin.require_auth();
        config.required_tier = required_tier;
        env.storage().instance().set(&DataKey::Config, &config);
        Self::bump_instance(&env);
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_facility(
        env: Env,
        borrower: Address,
        invoice_ref: String,
        currency_token: Address,
        senior_target: i128,
        junior_target: i128,
        senior_apr_bps: u32,
        junior_apr_bps: u32,
        duration_seconds: u64,
    ) -> Result<u64, CreditError> {
        borrower.require_auth();
        let config = Self::config(&env)?;
        Self::require_eligible(&env, &config, &borrower)?;

        if senior_target <= 0 || junior_target <= 0 {
            return Err(CreditError::InvalidAmount);
        }
        if senior_apr_bps > MAX_APR_BPS
            || junior_apr_bps > MAX_APR_BPS
            || duration_seconds < MIN_DURATION_SECONDS
            || duration_seconds > MAX_DURATION_SECONDS
        {
            return Err(CreditError::InvalidTerms);
        }

        let id: u64 = env.storage().instance().get(&DataKey::FacilityCount).unwrap_or(0) + 1;
        let facility = CreditFacility {
            id,
            borrower: borrower.clone(),
            invoice_ref,
            currency_token,
            senior_target,
            junior_target,
            senior_funded: 0,
            junior_funded: 0,
            senior_apr_bps,
            junior_apr_bps,
            duration_seconds,
            due_timestamp: 0,
            repaid_amount: 0,
            status: FacilityStatus::Fundraising,
        };

        Self::save(&env, &facility);
        env.storage().instance().set(&DataKey::FacilityCount, &id);
        Self::bump_instance(&env);
        env.events()
            .publish((symbol_short!("created"), id), (borrower, senior_target, junior_target));
        Ok(id)
    }

    /// Fund a tranche (0 = senior, 1 = junior) while the facility is raising
    pub fn deposit(
        env: Env,
        investor: Address,
        facility_id: u64,
        tranche: u32,
        amount: i128,
    ) -> Result<(), CreditError> {
        investor.require_auth();
        let config = Self::config(&env)?;
        Self::require_eligible(&env, &config, &investor)?;
        if amount <= 0 {
            return Err(CreditError::InvalidAmount);
        }

        let mut facility = Self::load(&env, facility_id)?;
        if facility.status != FacilityStatus::Fundraising {
            return Err(CreditError::InvalidStatus);
        }

        let key = match tranche {
            SENIOR => {
                if facility.senior_funded + amount > facility.senior_target {
                    return Err(CreditError::TrancheFull);
                }
                facility.senior_funded += amount;
                DataKey::SeniorDeposit(facility_id, investor.clone())
            }
            JUNIOR => {
                if facility.junior_funded + amount > facility.junior_target {
                    return Err(CreditError::TrancheFull);
                }
                facility.junior_funded += amount;
                DataKey::JuniorDeposit(facility_id, investor.clone())
            }
            _ => return Err(CreditError::InvalidTranche),
        };

        token::Client::new(&env, &facility.currency_token).transfer(
            &investor,
            &env.current_contract_address(),
            &amount,
        );

        Self::save(&env, &facility);
        let previous: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        Self::save_amount(&env, &key, previous + amount);
        env.events()
            .publish((symbol_short!("deposit"), facility_id), (investor, tranche, amount));
        Ok(())
    }

    /// Borrower withdraws a facility that hasn't been drawn; investors can then refund
    pub fn cancel_facility(env: Env, borrower: Address, facility_id: u64) -> Result<(), CreditError> {
        borrower.require_auth();
        let mut facility = Self::load(&env, facility_id)?;
        if facility.borrower != borrower {
            return Err(CreditError::Unauthorized);
        }
        if facility.status != FacilityStatus::Fundraising {
            return Err(CreditError::InvalidStatus);
        }
        facility.status = FacilityStatus::Cancelled;
        Self::save(&env, &facility);
        env.events().publish((symbol_short!("cancel"), facility_id), borrower);
        Ok(())
    }

    /// Return an investor's deposits from a cancelled facility
    pub fn refund(env: Env, investor: Address, facility_id: u64) -> Result<i128, CreditError> {
        investor.require_auth();
        let mut facility = Self::load(&env, facility_id)?;
        if facility.status != FacilityStatus::Cancelled {
            return Err(CreditError::InvalidStatus);
        }

        let senior_key = DataKey::SeniorDeposit(facility_id, investor.clone());
        let junior_key = DataKey::JuniorDeposit(facility_id, investor.clone());
        let senior: i128 = env.storage().persistent().get(&senior_key).unwrap_or(0);
        let junior: i128 = env.storage().persistent().get(&junior_key).unwrap_or(0);
        let total = senior + junior;
        if total == 0 {
            return Err(CreditError::NothingToClaim);
        }

        Self::save_amount(&env, &senior_key, 0);
        Self::save_amount(&env, &junior_key, 0);
        facility.senior_funded -= senior;
        facility.junior_funded -= junior;
        Self::save(&env, &facility);

        token::Client::new(&env, &facility.currency_token).transfer(
            &env.current_contract_address(),
            &investor,
            &total,
        );
        env.events().publish((symbol_short!("refund"), facility_id), (investor, total));
        Ok(total)
    }

    pub fn drawdown(env: Env, borrower: Address, facility_id: u64) -> Result<i128, CreditError> {
        borrower.require_auth();
        let mut facility = Self::load(&env, facility_id)?;

        if facility.status != FacilityStatus::Fundraising {
            return Err(CreditError::InvalidStatus);
        }
        if facility.borrower != borrower {
            return Err(CreditError::Unauthorized);
        }
        if facility.senior_funded < facility.senior_target
            || facility.junior_funded < facility.junior_target
        {
            return Err(CreditError::NotFullyFunded);
        }

        let total = facility.senior_funded + facility.junior_funded;
        facility.due_timestamp = env.ledger().timestamp() + facility.duration_seconds;
        facility.status = FacilityStatus::Active;
        Self::save(&env, &facility);

        token::Client::new(&env, &facility.currency_token).transfer(
            &env.current_contract_address(),
            &borrower,
            &total,
        );
        env.events().publish((symbol_short!("drawn"), facility_id), (borrower, total));
        Ok(total)
    }

    /// Anyone can repay. Payments are capped at what is still owed, so nothing
    /// is ever stranded in the contract. Repaying after a default is allowed and
    /// flows to investors through the same waterfall.
    pub fn repay(env: Env, payer: Address, facility_id: u64, amount: i128) -> Result<i128, CreditError> {
        payer.require_auth();
        if amount <= 0 {
            return Err(CreditError::InvalidAmount);
        }
        let mut facility = Self::load(&env, facility_id)?;
        if facility.status != FacilityStatus::Active && facility.status != FacilityStatus::Defaulted {
            return Err(CreditError::InvalidStatus);
        }

        let remaining = Self::total_owed(&facility) - facility.repaid_amount;
        let paid = if amount > remaining { remaining } else { amount };

        token::Client::new(&env, &facility.currency_token).transfer(
            &payer,
            &env.current_contract_address(),
            &paid,
        );
        facility.repaid_amount += paid;
        if facility.repaid_amount >= Self::total_owed(&facility) {
            facility.status = FacilityStatus::Repaid;
        }
        Self::save(&env, &facility);
        env.events().publish((symbol_short!("repaid"), facility_id), (payer, paid));
        Ok(paid)
    }

    /// Mark an unpaid facility as defaulted once the grace period has passed
    pub fn mark_default(env: Env, facility_id: u64) -> Result<(), CreditError> {
        let mut facility = Self::load(&env, facility_id)?;
        if facility.status != FacilityStatus::Active {
            return Err(CreditError::InvalidStatus);
        }
        if env.ledger().timestamp() <= facility.due_timestamp + DEFAULT_GRACE_SECONDS {
            return Err(CreditError::NotDue);
        }
        facility.status = FacilityStatus::Defaulted;
        Self::save(&env, &facility);
        env.events()
            .publish((symbol_short!("default"), facility_id), facility.repaid_amount);
        Ok(())
    }

    /// Pay out everything the investor is owed so far under the waterfall
    pub fn claim(env: Env, investor: Address, facility_id: u64) -> Result<i128, CreditError> {
        investor.require_auth();
        let facility = Self::load(&env, facility_id)?;
        let position = Self::position(&env, &facility, &investor);
        if position.claimable <= 0 {
            return Err(CreditError::NothingToClaim);
        }

        let key = DataKey::Claimed(facility_id, investor.clone());
        Self::save_amount(&env, &key, position.claimed + position.claimable);

        token::Client::new(&env, &facility.currency_token).transfer(
            &env.current_contract_address(),
            &investor,
            &position.claimable,
        );
        env.events()
            .publish((symbol_short!("claim"), facility_id), (investor, position.claimable));
        Ok(position.claimable)
    }

    pub fn get_facility(env: Env, facility_id: u64) -> Result<CreditFacility, CreditError> {
        Self::load(&env, facility_id)
    }

    pub fn facility_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::FacilityCount).unwrap_or(0)
    }

    /// Principal plus interest owed to each tranche: (senior, junior)
    pub fn amounts_owed(env: Env, facility_id: u64) -> Result<(i128, i128), CreditError> {
        let f = Self::load(&env, facility_id)?;
        Ok((Self::senior_owed(&f), Self::junior_owed(&f)))
    }

    pub fn get_position(env: Env, facility_id: u64, investor: Address) -> Result<Position, CreditError> {
        let facility = Self::load(&env, facility_id)?;
        Ok(Self::position(&env, &facility, &investor))
    }

    fn interest(principal: i128, apr_bps: u32, seconds: u64) -> i128 {
        (principal * apr_bps as i128 * seconds as i128) / (10_000 * SECONDS_PER_YEAR)
    }

    fn senior_owed(f: &CreditFacility) -> i128 {
        f.senior_target + Self::interest(f.senior_target, f.senior_apr_bps, f.duration_seconds)
    }

    fn junior_owed(f: &CreditFacility) -> i128 {
        f.junior_target + Self::interest(f.junior_target, f.junior_apr_bps, f.duration_seconds)
    }

    fn total_owed(f: &CreditFacility) -> i128 {
        Self::senior_owed(f) + Self::junior_owed(f)
    }

    fn position(env: &Env, facility: &CreditFacility, investor: &Address) -> Position {
        let id = facility.id;
        let senior: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::SeniorDeposit(id, investor.clone()))
            .unwrap_or(0);
        let junior: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::JuniorDeposit(id, investor.clone()))
            .unwrap_or(0);
        let claimed: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Claimed(id, investor.clone()))
            .unwrap_or(0);

        // Only a drawn facility distributes repayments
        let distributing = matches!(
            facility.status,
            FacilityStatus::Active | FacilityStatus::Repaid | FacilityStatus::Defaulted
        );
        let entitled = if distributing {
            let senior_owed = Self::senior_owed(facility);
            let repaid = facility.repaid_amount;
            let senior_pool = if repaid < senior_owed { repaid } else { senior_owed };
            let junior_pool = repaid - senior_pool;
            senior_pool * senior / facility.senior_target + junior_pool * junior / facility.junior_target
        } else {
            0
        };

        Position { senior, junior, claimed, claimable: entitled - claimed }
    }

    fn config(env: &Env) -> Result<CreditConfig, CreditError> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(CreditError::NotInitialized)
    }

    fn require_eligible(env: &Env, config: &CreditConfig, account: &Address) -> Result<(), CreditError> {
        if config.required_tier == 0 {
            return Ok(());
        }
        let tier: u32 = env.invoke_contract(
            &config.compliance,
            &Symbol::new(env, "tier_of"),
            vec![env, account.to_val()],
        );
        if tier < config.required_tier {
            return Err(CreditError::NotEligible);
        }
        Ok(())
    }

    fn load(env: &Env, facility_id: u64) -> Result<CreditFacility, CreditError> {
        env.storage()
            .persistent()
            .get(&DataKey::Facility(facility_id))
            .ok_or(CreditError::FacilityNotFound)
    }

    fn save(env: &Env, facility: &CreditFacility) {
        let key = DataKey::Facility(facility.id);
        env.storage().persistent().set(&key, facility);
        env.storage()
            .persistent()
            .extend_ttl(&key, RECORD_THRESHOLD, RECORD_BUMP);
    }

    fn save_amount(env: &Env, key: &DataKey, amount: i128) {
        env.storage().persistent().set(key, &amount);
        env.storage()
            .persistent()
            .extend_ttl(key, RECORD_THRESHOLD, RECORD_BUMP);
    }

    fn bump_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
    }
}

#[cfg(test)]
mod test;
