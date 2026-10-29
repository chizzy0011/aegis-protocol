#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env,
};

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
        admin.require_auth();

        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ComplianceError::Unauthorized)?;

        if admin != stored_admin {
            return Err(ComplianceError::Unauthorized);
        }

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

        env.storage()
            .persistent()
            .set(&DataKey::Investor(investor), &profile);

        Ok(())
    }

    pub fn set_sanction_status(
        env: Env,
        admin: Address,
        investor: Address,
        is_sanctioned: bool,
    ) -> Result<(), ComplianceError> {
        admin.require_auth();

        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ComplianceError::Unauthorized)?;

        if admin != stored_admin {
            return Err(ComplianceError::Unauthorized);
        }

        let mut profile: InvestorProfile = env
            .storage()
            .persistent()
            .get(&DataKey::Investor(investor.clone()))
            .ok_or(ComplianceError::InvestorNotFound)?;

        profile.is_sanctioned = is_sanctioned;
        env.storage()
            .persistent()
            .set(&DataKey::Investor(investor), &profile);

        Ok(())
    }

    pub fn verify_institutional_access(
        env: Env,
        investor: Address,
    ) -> Result<bool, ComplianceError> {
        let profile: InvestorProfile = env
            .storage()
            .persistent()
            .get(&DataKey::Investor(investor))
            .ok_or(ComplianceError::InvestorNotFound)?;

        if profile.is_sanctioned {
            return Err(ComplianceError::SanctionedAddress);
        }

        if env.ledger().timestamp() > profile.valid_until {
            return Err(ComplianceError::KycExpired);
        }

        if profile.tier != ComplianceTier::Institutional {
            return Ok(false);
        }

        Ok(true)
    }

    pub fn check_sep8_compliance(
        env: Env,
        from: Address,
        to: Address,
        _amount: i128,
    ) -> Result<bool, ComplianceError> {
        let from_profile: InvestorProfile = env
            .storage()
            .persistent()
            .get(&DataKey::Investor(from))
            .ok_or(ComplianceError::InvestorNotFound)?;

        let to_profile: InvestorProfile = env
            .storage()
            .persistent()
            .get(&DataKey::Investor(to))
            .ok_or(ComplianceError::InvestorNotFound)?;

        if from_profile.is_sanctioned || to_profile.is_sanctioned {
            return Err(ComplianceError::SanctionedAddress);
        }

        let now = env.ledger().timestamp();
        if now > from_profile.valid_until || now > to_profile.valid_until {
            return Err(ComplianceError::KycExpired);
        }

        Ok(true)
    }

    pub fn get_profile(env: Env, investor: Address) -> Result<InvestorProfile, ComplianceError> {
        env.storage()
            .persistent()
            .get(&DataKey::Investor(investor))
            .ok_or(ComplianceError::InvestorNotFound)
    }
}

#[cfg(test)]
mod test;
