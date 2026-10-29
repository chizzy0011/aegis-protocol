#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, String,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum SettlementError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    AnchorNotRegistered = 3,
    SettlementNotFound = 4,
    AlreadyConfirmed = 5,
    InvalidAmount = 6,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct AnchorSettlement {
    pub id: u64,
    pub facility_id: u64,
    pub anchor_address: Address,
    pub fiat_currency: String,
    pub amount_usdc: i128,
    pub recipient_info: String,
    pub timestamp: u64,
    pub confirmed: bool,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    CreditContract,
    SettlementCount,
    Settlement(u64),
    RegisteredAnchor(Address),
}

#[contract]
pub struct AegisSettlementContract;

#[contractimpl]
impl AegisSettlementContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        credit_contract: Address,
    ) -> Result<(), SettlementError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(SettlementError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::CreditContract, &credit_contract);
        env.storage()
            .instance()
            .set(&DataKey::SettlementCount, &0u64);

        Ok(())
    }

    pub fn register_anchor(
        env: Env,
        admin: Address,
        anchor_address: Address,
        fiat_currency: String,
    ) -> Result<(), SettlementError> {
        admin.require_auth();

        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(SettlementError::Unauthorized)?;

        if admin != stored_admin {
            return Err(SettlementError::Unauthorized);
        }

        env.storage()
            .persistent()
            .set(&DataKey::RegisteredAnchor(anchor_address), &fiat_currency);

        Ok(())
    }

    pub fn dispatch_payout(
        env: Env,
        caller: Address,
        facility_id: u64,
        anchor_address: Address,
        amount_usdc: i128,
        recipient_info: String,
    ) -> Result<u64, SettlementError> {
        caller.require_auth();

        if amount_usdc <= 0 {
            return Err(SettlementError::InvalidAmount);
        }

        let fiat_currency: String = env
            .storage()
            .persistent()
            .get(&DataKey::RegisteredAnchor(anchor_address.clone()))
            .ok_or(SettlementError::AnchorNotRegistered)?;

        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::SettlementCount)
            .unwrap_or(0);
        count += 1;

        let record = AnchorSettlement {
            id: count,
            facility_id,
            anchor_address,
            fiat_currency,
            amount_usdc,
            recipient_info,
            timestamp: env.ledger().timestamp(),
            confirmed: false,
        };

        env.storage()
            .instance()
            .set(&DataKey::Settlement(count), &record);
        env.storage().instance().set(&DataKey::SettlementCount, &count);

        Ok(count)
    }

    pub fn confirm_settlement(
        env: Env,
        anchor_address: Address,
        settlement_id: u64,
    ) -> Result<(), SettlementError> {
        anchor_address.require_auth();

        let mut record: AnchorSettlement = env
            .storage()
            .instance()
            .get(&DataKey::Settlement(settlement_id))
            .ok_or(SettlementError::SettlementNotFound)?;

        if record.anchor_address != anchor_address {
            return Err(SettlementError::Unauthorized);
        }

        if record.confirmed {
            return Err(SettlementError::AlreadyConfirmed);
        }

        record.confirmed = true;
        env.storage()
            .instance()
            .set(&DataKey::Settlement(settlement_id), &record);

        Ok(())
    }

    pub fn get_settlement(
        env: Env,
        settlement_id: u64,
    ) -> Result<AnchorSettlement, SettlementError> {
        env.storage()
            .instance()
            .get(&DataKey::Settlement(settlement_id))
            .ok_or(SettlementError::SettlementNotFound)
    }
}

#[cfg(test)]
mod test;
