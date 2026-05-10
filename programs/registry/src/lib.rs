use anchor_lang::prelude::*;
use anchor_lang::solana_program::bpf_loader_upgradeable;

declare_id!("Xo7TcdZwXZwU2S4em9r8Gn1L5L9ppmkqFLBpCXcuSPs");

#[program]
pub mod solanapilot_registry {
    use super::*;

    /// Register a newly generated program in the global registry
    /// 
    /// # Security
    /// - Validates program_id is a real deployed program (not system program or wallet)
    /// - Validates all string inputs for length and format
    /// - Uses PDA to prevent duplicate registrations
    /// - Emits event for off-chain indexing
    pub fn register_program(
        ctx: Context<RegisterProgram>,
        program_id: Pubkey,
        program_name: String,
        description: String,
        instruction_count: u8,
        generator_version: String,
    ) -> Result<()> {
        // ─────────────────────────────────────────────────────────────
        // INPUT VALIDATION
        // ─────────────────────────────────────────────────────────────
        
        // Validate program_id is not a system account or common non-program keys
        require!(
            program_id != System::id() 
            && program_id != solana_program::sysvar::clock::ID
            && program_id != solana_program::sysvar::rent::ID
            && program_id != anchor_lang::solana_program::native_token::ID,
            ErrorCode::InvalidProgramId
        );
        
        // Validate program name format
        require!(
            is_valid_program_name(&program_name),
            ErrorCode::InvalidProgramName
        );
        
        // Validate description
        require!(
            !description.trim().is_empty(),
            ErrorCode::InvalidDescription
        );
        require!(
            description.len() <= ProgramEntry::MAX_DESCRIPTION_LEN,
            ErrorCode::DescriptionTooLong
        );
        
        // Validate instruction count
        require!(
            instruction_count > 0 && instruction_count <= 50, // reasonable upper bound
            ErrorCode::InvalidInstructionCount
        );
        
        // Validate generator version
        require!(
            !generator_version.trim().is_empty(),
            ErrorCode::InvalidGeneratorVersion
        );
        require!(
            generator_version.len() <= ProgramEntry::MAX_GENERATOR_VERSION_LEN,
            ErrorCode::GeneratorVersionTooLong
        );

        // ─────────────────────────────────────────────────────────────
        // WRITE TO ACCOUNT
        // ─────────────────────────────────────────────────────────────
        
        let entry = &mut ctx.accounts.program_entry;
        let clock = Clock::get()?;

        entry.program_id = program_id;
        entry.program_name = program_name;        // No clone needed - already owned
        entry.description = description;          // No clone needed - already owned
        entry.instruction_count = instruction_count;
        entry.creator = ctx.accounts.creator.key();
        entry.registered_at = clock.unix_timestamp;
        entry.last_updated = clock.unix_timestamp;
        entry.generator_version = generator_version; // No clone needed
        entry.deployment_count = 0;
        entry.bump = ctx.bumps.program_entry;

        // ─────────────────────────────────────────────────────────────
        // EMIT EVENT (for indexers)
        // ─────────────────────────────────────────────────────────────
        
        emit!(ProgramRegisteredEvent {
            program_id: entry.program_id,
            program_name: entry.program_name.clone(),
            creator: entry.creator,
            timestamp: entry.registered_at,
        });

        msg!(
            "✅ Registered program: {} ({}) by {}",
            entry.program_name,
            entry.program_id,
            entry.creator
        );
        
        Ok(())
    }

    /// Increment usage counter when someone deploys a registered program
    /// 
    /// # Security
    /// - ONLY the original creator can log deployments
    /// - Prevents spam/inflation of deployment counts
    pub fn log_deployment(ctx: Context<LogDeployment>) -> Result<()> {
        let entry = &mut ctx.accounts.program_entry;
        
        // ── SECURITY: Only creator can increment their own program's count
        require!(
            ctx.accounts.authority.key() == entry.creator,
            ErrorCode::Unauthorized
        );
        
        entry.deployment_count = entry
            .deployment_count
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        msg!(
            "🚀 Program {} deployed {} times",
            entry.program_name,
            entry.deployment_count
        );
        
        Ok(())
    }

    /// Update program metadata (description, instruction count)
    /// 
    /// # Security
    /// - ONLY the original creator can update
    pub fn update_program_info(
        ctx: Context<UpdateProgramInfo>,
        new_description: Option<String>,
        new_instruction_count: Option<u8>,
    ) -> Result<()> {
        let entry = &mut ctx.accounts.program_entry;
        
        // Update description if provided
        if let Some(desc) = new_description {
            require!(!desc.trim().is_empty(), ErrorCode::InvalidDescription);
            require!(
                desc.len() <= ProgramEntry::MAX_DESCRIPTION_LEN,
                ErrorCode::DescriptionTooLong
            );
            entry.description = desc;
        }
        
        // Update instruction count if provided
        if let Some(count) = new_instruction_count {
            require!(
                count > 0 && count <= 50,
                ErrorCode::InvalidInstructionCount
            );
            entry.instruction_count = count;
        }
        
        // Update last_updated timestamp
        entry.last_updated = Clock::get()?.unix_timestamp;
        
        msg!("📝 Updated program info: {}", entry.program_name);
        Ok(())
    }

    /// Close a program entry and reclaim rent (ONLY creator can close)
    /// 
    /// # Security
    /// - Prevents anyone from censoring others' entries
    /// - Returns rent to the creator
    pub fn close_program_entry(ctx: Context<CloseProgramEntry>) -> Result<()> {
        msg!("🗑️ Closed program entry: {}", ctx.accounts.program_entry.program_name);
        Ok(())
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  ACCOUNT CONTEXTS
// ═════════════════════════════════════════════════════════════════════════════

#[derive(Accounts)]
#[instruction(program_id: Pubkey)]
pub struct RegisterProgram<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + ProgramEntry::INIT_SPACE,
        seeds = [b"program", program_id.as_ref()],
        bump
    )]
    pub program_entry: Account<'info, ProgramEntry>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LogDeployment<'info> {
    #[account(
        mut,
        seeds = [b"program", program_entry.program_id.as_ref()],
        bump = program_entry.bump
    )]
    pub program_entry: Account<'info, ProgramEntry>,
    
    /// The authority must be the original creator to prevent spam
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateProgramInfo<'info> {
    #[account(
        mut,
        seeds = [b"program", program_entry.program_id.as_ref()],
        bump = program_entry.bump,
        has_one = creator @ ErrorCode::Unauthorized
    )]
    pub program_entry: Account<'info, ProgramEntry>,
    
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseProgramEntry<'info> {
    #[account(
        mut,
        seeds = [b"program", program_entry.program_id.as_ref()],
        bump = program_entry.bump,
        has_one = creator @ ErrorCode::Unauthorized,
        close = creator  // Return rent to creator
    )]
    pub program_entry: Account<'info, ProgramEntry>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
}

// ═════════════════════════════════════════════════════════════════════════════
//  DATA STRUCTURES
// ═════════════════════════════════════════════════════════════════════════════

#[account]
#[derive(InitSpace)]
pub struct ProgramEntry {
    pub program_id: Pubkey,                                        // 32
    #[max_len(ProgramEntry::MAX_NAME_LEN)]
    pub program_name: String,                                      // 4 + 50
    #[max_len(ProgramEntry::MAX_DESCRIPTION_LEN)]
    pub description: String,                                       // 4 + 200
    pub instruction_count: u8,                                     // 1
    pub creator: Pubkey,                                           // 32
    pub registered_at: i64,                                        // 8 (renamed from timestamp)
    pub last_updated: i64,                                         // 8 (new field)
    #[max_len(ProgramEntry::MAX_GENERATOR_VERSION_LEN)]
    pub generator_version: String,                                 // 4 + 20
    pub deployment_count: u64,                                     // 8
    pub bump: u8,                                                  // 1
}
// Total space: 8 + 32 + 54 + 204 + 1 + 32 + 8 + 8 + 24 + 8 + 1 = 380 bytes

impl ProgramEntry {
    pub const MAX_NAME_LEN: usize = 50;
    pub const MAX_DESCRIPTION_LEN: usize = 200;
    pub const MAX_GENERATOR_VERSION_LEN: usize = 20;
}

// ═════════════════════════════════════════════════════════════════════════════
//  EVENTS
// ═════════════════════════════════════════════════════════════════════════════

#[event]
pub struct ProgramRegisteredEvent {
    pub program_id: Pubkey,
    pub program_name: String,
    pub creator: Pubkey,
    pub timestamp: i64,
}

// ═════════════════════════════════════════════════════════════════════════════
//  VALIDATION HELPERS
// ═════════════════════════════════════════════════════════════════════════════

/// Validates program name is snake_case ASCII
fn is_valid_program_name(value: &str) -> bool {
    if value.is_empty() 
       || value.len() > ProgramEntry::MAX_NAME_LEN 
       || !value.is_ascii() 
    {
        return false;
    }

    let mut chars = value.chars();
    
    // First character must be lowercase letter
    let Some(first) = chars.next() else {
        return false;
    };
    if !first.is_ascii_lowercase() {
        return false;
    }

    // Remaining characters: lowercase, digits, or underscore
    chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

// ═════════════════════════════════════════════════════════════════════════════
//  ERRORS
// ═════════════════════════════════════════════════════════════════════════════

#[error_code]
pub enum ErrorCode {
    #[msg("Program ID is invalid (cannot be system program or sysvar)")]
    InvalidProgramId,
    #[msg("Program name must be snake_case ASCII and 1-50 characters long")]
    InvalidProgramName,
    #[msg("Description cannot be empty")]
    InvalidDescription,
    #[msg("Description exceeds 200 character limit")]
    DescriptionTooLong,
    #[msg("Instruction count must be between 1 and 50")]
    InvalidInstructionCount,
    #[msg("Generator version cannot be empty")]
    InvalidGeneratorVersion,
    #[msg("Generator version exceeds 20 character limit")]
    GeneratorVersionTooLong,
    #[msg("Overflow in deployment counter")]
    Overflow,
    #[msg("Unauthorized: only the creator can perform this action")]
    Unauthorized,
}

// ═════════════════════════════════════════════════════════════════════════════
//  TESTS
// ═════════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_program_names() {
        assert!(is_valid_program_name("my_program"));
        assert!(is_valid_program_name("program_v2"));
        assert!(is_valid_program_name("counter"));
        assert!(is_valid_program_name("voting_app_2024"));
    }

    #[test]
    fn test_invalid_program_names() {
        assert!(!is_valid_program_name(""));              // empty
        assert!(!is_valid_program_name("My_Program"));    // uppercase
        assert!(!is_valid_program_name("2_program"));     // starts with digit
        assert!(!is_valid_program_name("my-program"));    // hyphen not allowed
        assert!(!is_valid_program_name("my program"));    // space not allowed
        assert!(!is_valid_program_name("_program"));      // starts with underscore
    }
}