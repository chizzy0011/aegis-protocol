#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, vec, Address, Env, IntoVal,
    String, Symbol,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;
const RECORD_BUMP: u32 = 120 * DAY_IN_LEDGERS;
const RECORD_THRESHOLD: u32 = RECORD_BUMP - DAY_IN_LEDGERS;

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
    NotInitialized = 7,
    FacilityNotDrawn = 8,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct AnchorSettlement {
    pub id: u64,
    pub facility_id: u64,
    pub borrower: Address,
    pub anchor_address: Address,
    pub fiat_currency: String,
    pub amount_usdc: i128,
    /// The anchor's SEP-24 transaction id. Bank details never go on-chain.
    pub anchor_tx_id: String,
    pub timestamp: u64,
    pub confirmed: bool,
}

/// Mirror of the fields of `aegis_credit::CreditFacility` this contract reads.
/// Field names and order must match for the cross-contract decode.
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
    pub status: u32,
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

/// On-chain record of a drawn facility being paid out through a fiat anchor.
/// No funds move here: the borrower records the off-ramp, and only the
/// registered anchor's key can confirm it.
#[contract]
pub struct AegisSettlementContract;

#[contractimpl]
impl AegisSettlementContract {
    pub fn initialize(env: Env, admin: Address, credit_contract: Address) -> Result<(), SettlementError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(SettlementError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::CreditContract, &credit_contract);
        env.storage().instance().set(&DataKey::SettlementCount, &0u64);
        Self::bump_instance(&env);
        Ok(())
    }

    pub fn register_anchor(
        env: Env,
        admin: Address,
        anchor_address: Address,
        fiat_currency: String,
    ) -> Result<(), SettlementError> {
        admin.require_auth();
        let stored: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(SettlementError::NotInitialized)?;
        if admin != stored {
            return Err(SettlementError::Unauthorized);
        }

        let key = DataKey::RegisteredAnchor(anchor_address.clone());
        env.storage().persistent().set(&key, &fiat_currency);
        env.storage()
            .persistent()
            .extend_ttl(&key, RECORD_THRESHOLD, RECORD_BUMP);
        env.events()
            .publish((symbol_short!("anchor"), anchor_address), fiat_currency);
        Ok(())
    }

    /// The facility's borrower records an off-ramp of drawn funds through a registered anchor
    pub fn record_payout(
        env: Env,
        borrower: Address,
        facility_id: u64,
        anchor_address: Address,
        amount_usdc: i128,
        anchor_tx_id: String,
    ) -> Result<u64, SettlementError> {
        borrower.require_auth();
        if amount_usdc <= 0 {
            return Err(SettlementError::InvalidAmount);
        }

        let fiat_currency: String = env
            .storage()
            .persistent()
            .get(&DataKey::RegisteredAnchor(anchor_address.clone()))
            .ok_or(SettlementError::AnchorNotRegistered)?;

        let credit: Address = env
            .storage()
            .instance()
            .get(&DataKey::CreditContract)
            .ok_or(SettlementError::NotInitialized)?;
        let facility: CreditFacility = env.invoke_contract(
            &credit,
            &Symbol::new(&env, "get_facility"),
            vec![&env, facility_id.into_val(&env)],
        );
        if facility.borrower != borrower {
            return Err(SettlementError::Unauthorized);
        }
        // Active (1), Repaid (2) or Defaulted (3): funds have been drawn
        if !(1..=3).contains(&facility.status) {
            return Err(SettlementError::FacilityNotDrawn);
        }
        if amount_usdc > facility.senior_target + facility.junior_target {
            return Err(SettlementError::InvalidAmount);
        }

        let id: u64 = env.storage().instance().get(&DataKey::SettlementCount).unwrap_or(0) + 1;
        let record = AnchorSettlement {
            id,
            facility_id,
            borrower,
            anchor_address,
            fiat_currency,
            amount_usdc,
            anchor_tx_id,
            timestamp: env.ledger().timestamp(),
            confirmed: false,
        };
        Self::save(&env, &record);
        env.storage().instance().set(&DataKey::SettlementCount, &id);
        Self::bump_instance(&env);
        env.events()
            .publish((symbol_short!("payout"), facility_id), (id, amount_usdc));
        Ok(id)
    }

    /// Only the anchor named in the record can confirm it
    pub fn confirm_settlement(env: Env, anchor_address: Address, settlement_id: u64) -> Result<(), SettlementError> {
        anchor_address.require_auth();
        let mut record = Self::get_settlement(env.clone(), settlement_id)?;
        if record.anchor_address != anchor_address {
            return Err(SettlementError::Unauthorized);
        }
        if record.confirmed {
            return Err(SettlementError::AlreadyConfirmed);
        }
        record.confirmed = true;
        Self::save(&env, &record);
        env.events()
            .publish((symbol_short!("confirm"), record.facility_id), settlement_id);
        Ok(())
    }

    pub fn get_settlement(env: Env, settlement_id: u64) -> Result<AnchorSettlement, SettlementError> {
        env.storage()
            .persistent()
            .get(&DataKey::Settlement(settlement_id))
            .ok_or(SettlementError::SettlementNotFound)
    }

    pub fn settlement_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::SettlementCount).unwrap_or(0)
    }

    fn save(env: &Env, record: &AnchorSettlement) {
        let key = DataKey::Settlement(record.id);
        env.storage().persistent().set(&key, record);
        env.storage()
            .persistent()
            .extend_ttl(&key, RECORD_THRESHOLD, RECORD_BUMP);
    }

    fn bump_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
    }
}

#[cfg(test)]
mod test;
