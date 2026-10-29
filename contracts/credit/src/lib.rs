#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, String,
};

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
    AlreadyDrawn = 8,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum FacilityStatus {
    Fundraising = 0,
    Active = 1,
    Repaid = 2,
    Defaulted = 3,
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

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    ComplianceContract,
    FacilityCount,
    Facility(u64),
    SeniorDeposit(u64, Address),
    JuniorDeposit(u64, Address),
}

#[contract]
pub struct AegisCreditContract;

#[contractimpl]
impl AegisCreditContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        compliance_contract: Address,
    ) -> Result<(), CreditError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(CreditError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::ComplianceContract, &compliance_contract);
        env.storage().instance().set(&DataKey::FacilityCount, &0u64);

        Ok(())
    }

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

        if senior_target <= 0 || junior_target <= 0 {
            return Err(CreditError::InvalidAmount);
        }

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::FacilityCount)
            .unwrap_or(0);
        count += 1;

        let facility = CreditFacility {
            id: count,
            borrower,
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

        env.storage()
            .instance()
            .set(&DataKey::Facility(count), &facility);
        env.storage().instance().set(&DataKey::FacilityCount, &count);

        Ok(count)
    }

    pub fn deposit_senior(
        env: Env,
        investor: Address,
        facility_id: u64,
        amount: i128,
    ) -> Result<(), CreditError> {
        investor.require_auth();

        let mut facility: CreditFacility = env
            .storage()
            .instance()
            .get(&DataKey::Facility(facility_id))
            .ok_or(CreditError::FacilityNotFound)?;

        if facility.status != FacilityStatus::Fundraising {
            return Err(CreditError::InvalidStatus);
        }

        if facility.senior_funded + amount > facility.senior_target {
            return Err(CreditError::TrancheFull);
        }

        let token_client = token::Client::new(&env, &facility.currency_token);
        token_client.transfer(&investor, &env.current_contract_address(), &amount);

        facility.senior_funded += amount;
        env.storage()
            .instance()
            .set(&DataKey::Facility(facility_id), &facility);

        let prev_deposit: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::SeniorDeposit(facility_id, investor.clone()))
            .unwrap_or(0);
        env.storage().persistent().set(
            &DataKey::SeniorDeposit(facility_id, investor),
            &(prev_deposit + amount),
        );

        Ok(())
    }

    pub fn deposit_junior(
        env: Env,
        investor: Address,
        facility_id: u64,
        amount: i128,
    ) -> Result<(), CreditError> {
        investor.require_auth();

        let mut facility: CreditFacility = env
            .storage()
            .instance()
            .get(&DataKey::Facility(facility_id))
            .ok_or(CreditError::FacilityNotFound)?;

        if facility.status != FacilityStatus::Fundraising {
            return Err(CreditError::InvalidStatus);
        }

        if facility.junior_funded + amount > facility.junior_target {
            return Err(CreditError::TrancheFull);
        }

        let token_client = token::Client::new(&env, &facility.currency_token);
        token_client.transfer(&investor, &env.current_contract_address(), &amount);

        facility.junior_funded += amount;
        env.storage()
            .instance()
            .set(&DataKey::Facility(facility_id), &facility);

        let prev_deposit: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::JuniorDeposit(facility_id, investor.clone()))
            .unwrap_or(0);
        env.storage().persistent().set(
            &DataKey::JuniorDeposit(facility_id, investor),
            &(prev_deposit + amount),
        );

        Ok(())
    }

    pub fn drawdown(env: Env, borrower: Address, facility_id: u64) -> Result<(), CreditError> {
        borrower.require_auth();

        let mut facility: CreditFacility = env
            .storage()
            .instance()
            .get(&DataKey::Facility(facility_id))
            .ok_or(CreditError::FacilityNotFound)?;

        if facility.status != FacilityStatus::Fundraising {
            return Err(CreditError::InvalidStatus);
        }

        if facility.borrower != borrower {
            return Err(CreditError::Unauthorized);
        }

        // Must be fully funded across both tranches
        if facility.senior_funded < facility.senior_target
            || facility.junior_funded < facility.junior_target
        {
            return Err(CreditError::NotFullyFunded);
        }

        let total_drawdown = facility.senior_funded + facility.junior_funded;
        let current_time = env.ledger().timestamp();

        facility.due_timestamp = current_time + facility.duration_seconds;
        facility.status = FacilityStatus::Active;

        let token_client = token::Client::new(&env, &facility.currency_token);
        token_client.transfer(&env.current_contract_address(), &borrower, &total_drawdown);

        env.storage()
            .instance()
            .set(&DataKey::Facility(facility_id), &facility);

        Ok(())
    }

    pub fn repay(
        env: Env,
        payer: Address,
        facility_id: u64,
        amount: i128,
    ) -> Result<(), CreditError> {
        payer.require_auth();

        let mut facility: CreditFacility = env
            .storage()
            .instance()
            .get(&DataKey::Facility(facility_id))
            .ok_or(CreditError::FacilityNotFound)?;

        if facility.status != FacilityStatus::Active {
            return Err(CreditError::InvalidStatus);
        }

        let token_client = token::Client::new(&env, &facility.currency_token);
        token_client.transfer(&payer, &env.current_contract_address(), &amount);

        facility.repaid_amount += amount;

        // Calculate total expected repayment with interest:
        // Senior interest
        let senior_interest = (facility.senior_target
            * facility.senior_apr_bps as i128
            * facility.duration_seconds as i128)
            / (10000 * 31_536_000);
        // Junior interest
        let junior_interest = (facility.junior_target
            * facility.junior_apr_bps as i128
            * facility.duration_seconds as i128)
            / (10000 * 31_536_000);

        let total_required =
            facility.senior_target + senior_interest + facility.junior_target + junior_interest;

        if facility.repaid_amount >= total_required {
            facility.status = FacilityStatus::Repaid;
        }

        env.storage()
            .instance()
            .set(&DataKey::Facility(facility_id), &facility);

        Ok(())
    }

    pub fn get_facility(env: Env, facility_id: u64) -> Result<CreditFacility, CreditError> {
        env.storage()
            .instance()
            .get(&DataKey::Facility(facility_id))
            .ok_or(CreditError::FacilityNotFound)
    }
}

#[cfg(test)]
mod test;
