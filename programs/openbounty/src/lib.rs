use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("G5MSUKpKWNzGoHbpphuPS3QsKXUD7EPa54oRDapXxSQ8");

// Constants
pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
pub const BOUNTY_CREATION_FEE: u64 = 1_000_000; // 0.001 SOL
pub const PLATFORM_FEE_BPS: u16 = 100; // 1% = 100 basis points
pub const MAX_DESCRIPTION_HASH_LEN: usize = 64; // For IPFS CID or hash
pub const ESCROW_EXPIRY_SECONDS: i64 = 15_552_000; // 6 months (180 days)

#[program]
pub mod openbounty {
    use super::*;

    /// Initialize the platform treasury (one-time setup)
    pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;
        treasury.authority = ctx.accounts.authority.key();
        treasury.total_fees_collected = 0;
        treasury.total_bounties_created = 0;
        treasury.total_bounties_completed = 0;
        treasury.total_volume = 0;
        treasury.total_expired_funds_reclaimed = 0;
        treasury.bump = ctx.bumps.treasury;
        
        msg!("Treasury initialized");
        Ok(())
    }

    /// Create a new bounty
    /// - Company pays creation fee (0.001 SOL)
    /// - Prize amount is escrowed in bounty account
    /// - description_hash: IPFS CID or hash of full bounty details stored off-chain
    /// - Bounty expires after 6 months if no winner is selected
    pub fn create_bounty(
        ctx: Context<CreateBounty>,
        description_hash: String,
        prize_amount: u64,
        deadline_timestamp: Option<i64>,
    ) -> Result<()> {
        require!(
            description_hash.len() <= MAX_DESCRIPTION_HASH_LEN,
            ErrorCode::DescriptionHashTooLong
        );
        require!(prize_amount > 0, ErrorCode::InvalidPrizeAmount);
    
        // Get account infos BEFORE mutable borrows
        let treasury_info = ctx.accounts.treasury.to_account_info();
        let bounty_info = ctx.accounts.bounty.to_account_info();
        
        let bounty = &mut ctx.accounts.bounty;
        let treasury = &mut ctx.accounts.treasury;
    
        // Transfer creation fee to treasury
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.company.to_account_info(),
                    to: treasury_info,
                },
            ),
            BOUNTY_CREATION_FEE,
        )?;
    
        // Transfer prize to bounty escrow
        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.company.to_account_info(),
                    to: bounty_info,
                },
            ),
            prize_amount,
        )?;

        let current_time = Clock::get()?.unix_timestamp;

        // Initialize bounty
        bounty.company = ctx.accounts.company.key();
        bounty.description_hash = description_hash;
        bounty.prize_amount = prize_amount;
        bounty.deadline_timestamp = deadline_timestamp;
        bounty.winner = None;
        bounty.completed = false;
        bounty.created_at = current_time;
        bounty.expiry_timestamp = current_time + ESCROW_EXPIRY_SECONDS; // 6 months from now
        bounty.expired = false;
        bounty.bump = ctx.bumps.bounty;

        // Update treasury stats
        treasury.total_fees_collected = treasury
            .total_fees_collected
            .checked_add(BOUNTY_CREATION_FEE)
            .ok_or(ErrorCode::MathOverflow)?;
        treasury.total_bounties_created = treasury
            .total_bounties_created
            .checked_add(1)
            .unwrap();
        treasury.total_volume = treasury
            .total_volume
            .checked_add(prize_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        msg!("Bounty created with prize: {} SOL", prize_amount as f64 / LAMPORTS_PER_SOL as f64);
        msg!("Bounty will expire on: {}", bounty.expiry_timestamp);
        Ok(())
    }

    /// Select winner and distribute prize
    /// - Only company can select winner
    /// - 1% platform fee deducted from prize
    /// - 99% goes to winner
    /// - Winner's reputation updated
    /// - Can only be called before expiry
    pub fn select_winner(
        ctx: Context<SelectWinner>,
        submission_hash: String,
    ) -> Result<()> {
        // Get account infos BEFORE any mutable borrows
        let bounty_info = ctx.accounts.bounty.to_account_info();
        let treasury_info = ctx.accounts.treasury.to_account_info();
        let winner_info = ctx.accounts.winner.to_account_info();
        
        let bounty = &mut ctx.accounts.bounty;
        let treasury = &mut ctx.accounts.treasury;
        let winner_profile = &mut ctx.accounts.winner_profile;
    
        require!(!bounty.completed, ErrorCode::BountyAlreadyCompleted);
        require!(!bounty.expired, ErrorCode::BountyExpired);
        require!(
            ctx.accounts.company.key() == bounty.company,
            ErrorCode::UnauthorizedCompany
        );

        // Check if bounty has expired (6 months passed)
        let current_time = Clock::get()?.unix_timestamp;
        require!(
            current_time < bounty.expiry_timestamp,
            ErrorCode::BountyExpired
        );

        // Calculate fees
        let platform_fee = bounty
            .prize_amount
            .checked_mul(PLATFORM_FEE_BPS as u64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::MathOverflow)?;

        let winner_payout = bounty
            .prize_amount
            .checked_sub(platform_fee)
            .ok_or(ErrorCode::MathOverflow)?;

        // Transfer platform fee to treasury
        **bounty_info.try_borrow_mut_lamports()? -= platform_fee;
        **treasury_info.try_borrow_mut_lamports()? += platform_fee;

        // Transfer winner payout
        **bounty_info.try_borrow_mut_lamports()? -= winner_payout;
        **winner_info.try_borrow_mut_lamports()? += winner_payout;

        // Update bounty
        bounty.winner = Some(ctx.accounts.winner.key());
        bounty.completed = true;
        bounty.completed_at = Some(current_time);
        bounty.submission_hash = Some(submission_hash);

        // Update winner's profile (increment completions)
        winner_profile.bounties_completed = winner_profile
            .bounties_completed
            .checked_add(1)
            .unwrap();

        // Update treasury stats
        treasury.total_bounties_completed = treasury
            .total_bounties_completed
            .checked_add(1)
            .unwrap();
        treasury.total_fees_collected = treasury
            .total_fees_collected
            .checked_add(platform_fee)
            .ok_or(ErrorCode::MathOverflow)?;

        msg!(
            "Winner selected! Paid {} SOL (platform fee: {} SOL)",
            winner_payout as f64 / LAMPORTS_PER_SOL as f64,
            platform_fee as f64 / LAMPORTS_PER_SOL as f64
        );

        Ok(())
    }

    /// Reclaim expired bounty funds to treasury
    /// - Can be called by anyone after 6 months
    /// - Returns all escrowed funds to treasury
    /// - Marks bounty as expired
    pub fn reclaim_expired_bounty(ctx: Context<ReclaimExpiredBounty>) -> Result<()> {
        let bounty_info = ctx.accounts.bounty.to_account_info();
        let treasury_info = ctx.accounts.treasury.to_account_info();
        
        let bounty = &mut ctx.accounts.bounty;
        let treasury = &mut ctx.accounts.treasury;

        require!(!bounty.completed, ErrorCode::BountyAlreadyCompleted);
        require!(!bounty.expired, ErrorCode::BountyAlreadyExpired);

        // Check if 6 months have passed
        let current_time = Clock::get()?.unix_timestamp;
        require!(
            current_time >= bounty.expiry_timestamp,
            ErrorCode::BountyNotExpired
        );

        // Get the current bounty balance (should be prize_amount + rent)
        let bounty_balance = bounty_info.lamports();
        let rent = Rent::get()?.minimum_balance(bounty_info.data_len());
        let reclaimable_amount = bounty_balance.saturating_sub(rent);

        // Transfer all escrowed funds to treasury
        **bounty_info.try_borrow_mut_lamports()? -= reclaimable_amount;
        **treasury_info.try_borrow_mut_lamports()? += reclaimable_amount;

        // Mark bounty as expired
        bounty.expired = true;
        bounty.completed_at = Some(current_time);

        // Update treasury stats
        treasury.total_expired_funds_reclaimed = treasury
            .total_expired_funds_reclaimed
            .checked_add(reclaimable_amount)
            .ok_or(ErrorCode::MathOverflow)?;

        msg!(
            "Expired bounty reclaimed! {} SOL returned to treasury",
            reclaimable_amount as f64 / LAMPORTS_PER_SOL as f64
        );
        msg!(
            "Bounty created at: {}, expired at: {}, reclaimed at: {}",
            bounty.created_at,
            bounty.expiry_timestamp,
            current_time
        );

        Ok(())
    }

    /// Create hunter profile
    /// - Just tracks wallet + on-chain reputation
    /// - Full profile (skills, bio, etc.) stored off-chain
    pub fn create_hunter_profile(ctx: Context<CreateHunterProfile>) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        profile.hunter = ctx.accounts.hunter.key();
        profile.bounties_completed = 0;
        profile.created_at = Clock::get()?.unix_timestamp;
        profile.bump = ctx.bumps.profile;

        msg!("Hunter profile created");
        Ok(())
    }
}

// ============================================================================
// Account Contexts
// ============================================================================

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Treasury::INIT_SPACE,
        seeds = [b"treasury_v1"],
        bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(description_hash: String)]
pub struct CreateBounty<'info> {
    #[account(
        init,
        payer = company,
        space = 8 + Bounty::INIT_SPACE,
        seeds = [
            b"bounty",
            company.key().as_ref(),
            description_hash.as_bytes()
        ],
        bump
    )]
    pub bounty: Account<'info, Bounty>,

    #[account(
        mut,
        seeds = [b"treasury_v1"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(mut)]
    pub company: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SelectWinner<'info> {
    #[account(mut)]
    pub bounty: Account<'info, Bounty>,

    #[account(
        mut,
        seeds = [b"treasury_v1"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(
        init_if_needed,
        payer = company,
        space = 8 + HunterProfile::INIT_SPACE,
        seeds = [b"profile", winner.key().as_ref()],
        bump
    )]
    pub winner_profile: Account<'info, HunterProfile>,

    /// CHECK: Winner wallet, receives prize
    #[account(mut)]
    pub winner: UncheckedAccount<'info>,

    #[account(mut)]
    pub company: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReclaimExpiredBounty<'info> {
    #[account(mut)]
    pub bounty: Account<'info, Bounty>,

    #[account(
        mut,
        seeds = [b"treasury_v1"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,

    /// CHECK: Can be called by anyone
    pub caller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateHunterProfile<'info> {
    #[account(
        init,
        payer = hunter,
        space = 8 + HunterProfile::INIT_SPACE,
        seeds = [b"profile", hunter.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, HunterProfile>,

    #[account(mut)]
    pub hunter: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================================================
// Account Structures
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub authority: Pubkey,
    pub total_fees_collected: u64,
    pub total_bounties_created: u32,
    pub total_bounties_completed: u32,
    pub total_volume: u64,
    pub total_expired_funds_reclaimed: u64, // NEW: Track reclaimed funds
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Bounty {
    pub company: Pubkey,
    #[max_len(64)]
    pub description_hash: String, // IPFS CID or hash
    pub prize_amount: u64,
    pub deadline_timestamp: Option<i64>,
    pub winner: Option<Pubkey>,
    pub completed: bool,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    #[max_len(64)]
    pub submission_hash: Option<String>, // Winner's submission hash
    pub expiry_timestamp: i64, // NEW: When escrow expires (6 months)
    pub expired: bool, // NEW: Whether bounty has expired
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct HunterProfile {
    pub hunter: Pubkey,
    pub bounties_completed: u32, // On-chain reputation metric
    pub created_at: i64,
    pub bump: u8,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Description hash is too long (max 64 characters)")]
    DescriptionHashTooLong,
    
    #[msg("Prize amount must be greater than 0")]
    InvalidPrizeAmount,
    
    #[msg("Math overflow occurred")]
    MathOverflow,
    
    #[msg("Bounty has already been completed")]
    BountyAlreadyCompleted,
    
    #[msg("Only the company that created the bounty can select a winner")]
    UnauthorizedCompany,

    #[msg("Bounty has expired (6 months passed without winner selection)")]
    BountyExpired,

    #[msg("Bounty has not expired yet (must wait 6 months)")]
    BountyNotExpired,

    #[msg("Bounty has already been marked as expired")]
    BountyAlreadyExpired,
}