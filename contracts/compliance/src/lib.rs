#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;
const PROFILE_BUMP: u32 = 120 * DAY_IN_LEDGERS;
const PROFILE_THRESHOLD: u32 = PROFILE_BUMP - DAY_IN_LEDGERS;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ComplianceError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    InvestorNotFound = 3,
    SanctionedAddress = 4,
    KycExpired = 5,
    InsufficientTier = 6,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum ComplianceTier {
    Retail = 1,
    Accredited = 2,
    Institutional = 3,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct InvestorProfile {
    pub address: Address,
    pub tier: ComplianceTier,
    pub country_code: u32,
    pub is_sanctioned: bool,
    pub valid_until: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Investor(Address),
}

/// Investor registry kept by the admin (the KYC provider). The repo and credit
/// contracts call `tier_of` to gate participation by a minimum tier.
#[contract]
pub struct AegisComplianceContract;

#[contractimpl]
impl AegisComplianceContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), ComplianceError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ComplianceError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        Self::bump_instance(&env);
        Ok(())
    }

    pub fn set_investor_tier(
        env: Env,
        admin: Address,
        investor: Address,
        tier: u32,
        country_code: u32,
        valid_until: u64,
    ) -> Result<(), ComplianceError> {
        Self::require_admin(&env, &admin)?;

        let parsed_tier = match tier {
            1 => ComplianceTier::Retail,
            2 => ComplianceTier::Accredited,
            3 => ComplianceTier::Institutional,
            _ => return Err(ComplianceError::InsufficientTier),
        };

        let profile = InvestorProfile {
            address: investor.clone(),
            tier: parsed_tier,
            country_code,
            is_sanctioned: false,
            valid_until,
        };
        Self::store(&env, &investor, &profile);
        env.events()
            .publish((symbol_short!("tier"), investor), (tier, country_code, valid_until));

        Ok(())
    }

    pub fn set_sanction_status(
        env: Env,
        admin: Address,
        investor: Address,
        is_sanctioned: bool,
    ) -> Result<(), ComplianceError> {
        Self::require_admin(&env, &admin)?;

        let mut profile = Self::get_profile(env.clone(), investor.clone())?;
        profile.is_sanctioned = is_sanctioned;
        Self::store(&env, &investor, &profile);
        env.events()
            .publish((symbol_short!("sanction"), investor), is_sanctioned);

        Ok(())
    }

    /// Effective tier: 0 for unknown, sanctioned or expired accounts, otherwise
    /// 1 (Retail), 2 (Accredited) or 3 (Institutional). Never fails, so other
    /// contracts can gate on `tier_of(account) >= required_tier`.
    pub fn tier_of(env: Env, account: Address) -> u32 {
        let profile: Option<InvestorProfile> =
            env.storage().persistent().get(&DataKey::Investor(account));
        match profile {
            Some(p) if !p.is_sanctioned && env.ledger().timestamp() <= p.valid_until => p.tier as u32,
            _ => 0,
        }
    }

    pub fn verify_institutional_access(
        env: Env,
        investor: Address,
    ) -> Result<bool, ComplianceError> {
        let profile = Self::get_profile(env.clone(), investor)?;
        Self::check_profile(&env, &profile)?;
        Ok(profile.tier == ComplianceTier::Institutional)
    }

    /// Both sides of a transfer must be registered, unsanctioned and unexpired
    pub fn check_transfer(
        env: Env,
        from: Address,
        to: Address,
    ) -> Result<bool, ComplianceError> {
        let from_profile = Self::get_profile(env.clone(), from)?;
        let to_profile = Self::get_profile(env.clone(), to)?;
        Self::check_profile(&env, &from_profile)?;
        Self::check_profile(&env, &to_profile)?;
        Ok(true)
    }

    pub fn get_profile(env: Env, investor: Address) -> Result<InvestorProfile, ComplianceError> {
        env.storage()
            .persistent()
            .get(&DataKey::Investor(investor))
            .ok_or(ComplianceError::InvestorNotFound)
    }

    fn check_profile(env: &Env, profile: &InvestorProfile) -> Result<(), ComplianceError> {
        if profile.is_sanctioned {
            return Err(ComplianceError::SanctionedAddress);
        }
        if env.ledger().timestamp() > profile.valid_until {
            return Err(ComplianceError::KycExpired);
        }
        Ok(())
    }

    fn require_admin(env: &Env, admin: &Address) -> Result<(), ComplianceError> {
        admin.require_auth();
        let stored: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ComplianceError::Unauthorized)?;
        if *admin != stored {
            return Err(ComplianceError::Unauthorized);
        }
        Ok(())
    }

    fn store(env: &Env, investor: &Address, profile: &InvestorProfile) {
        let key = DataKey::Investor(investor.clone());
        env.storage().persistent().set(&key, profile);
        env.storage()
            .persistent()
            .extend_ttl(&key, PROFILE_THRESHOLD, PROFILE_BUMP);
        Self::bump_instance(env);
    }

    fn bump_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
    }
}

#[cfg(test)]
mod test;
