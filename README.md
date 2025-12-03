# OpenBounty - Decentralized Freelance Bounty Platform

A decentralized bounty platform on Solana where companies post tasks with SOL rewards, and freelance "hunters" compete to complete them.

## 🎯 Overview

**OpenBounty** is a trustless freelance marketplace built on Solana that enables:
- **Companies**: Post bounties with escrowed SOL prizes
- **Hunters**: Build reputation by completing bounties
- **Platform**: Sustainable 1% fee model

### Key Features
- ✅ **Trustless Escrow**: Prize SOL locked in smart contract
- ✅ **No Cancellation**: Companies can't rugpull once bounty is posted
- ✅ **On-Chain Reputation**: Hunter completion stats stored on-chain
- ✅ **Low Fees**: 0.001 SOL to post, 1% on completion
- ✅ **IPFS Integration**: Bounty descriptions & submissions stored off-chain

## 🛠️ Tech Stack

### Smart Contract
- **Framework**: Anchor 0.32.1
- **Language**: Rust
- **Blockchain**: Solana
- **Program ID**: `BNTYprog11111111111111111111111111111111111`

### Frontend (Coming Soon)
- **Framework**: Next.js 14
- **Wallet**: Solana Wallet Adapter
- **Storage**: IPFS (descriptions), Supabase (profiles)
- **Language**: TypeScript

## 📦 Prerequisites

- Rust 1.75+
- Solana CLI 1.18+
- Anchor CLI 0.32.1
- Node.js 18+

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana
sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.32.1
avm use 0.32.1
```

### 2. Clone and Build

```bash
git clone <your-repo-url>
cd openbounty
anchor build
```

### 3. Configure Solana

```bash
# Set to devnet for testing
solana config set --url devnet

# Create/set your wallet
solana-keygen new

# Get devnet SOL
solana airdrop 2
```

### 4. Deploy

```bash
# Get program ID
anchor keys list

# Update Anchor.toml and lib.rs with your program ID

# Build and deploy
anchor build
anchor deploy

# Initialize treasury
anchor run init-treasury
```

### 5. Run Tests

```bash
anchor test
```

## 🏗️ Architecture

### On-Chain (Smart Contract)

The smart contract handles:
- **Escrow**: Locks prize SOL until winner selected
- **Reputation**: Tracks hunter completion count
- **Fees**: Collects creation fee (0.001 SOL) + platform fee (1%)

### Off-Chain (Frontend + Database)

The frontend/database stores:
- **Bounty Details**: Full descriptions, requirements, examples
- **Hunter Profiles**: Skills, bio, college, portfolio
- **Submissions**: GitHub links, deliverables
- **Reviews**: Company/hunter ratings

**Why hybrid?**
- Smart contract = expensive but immutable (money)
- Database = cheap and flexible (data)
- IPFS = decentralized and permanent (submissions)

## 🔧 Core Instructions

### 1. `initialize_treasury`
One-time setup, creates treasury account.

**Who can call**: Anyone (only works once)

```rust
pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()>
```

---

### 2. `create_bounty`
Company posts a new bounty with escrowed prize.

**Parameters:**
- `description_hash: String` - IPFS CID or hash of full bounty details
- `prize_amount: u64` - SOL to award winner (in lamports)
- `deadline_timestamp: Option<i64>` - Optional Unix timestamp deadline

**Fees:**
- 0.001 SOL creation fee (to treasury)
- `prize_amount` escrowed in bounty PDA

**Example:**
```typescript
await program.methods
  .createBounty(
    "QmAbC123...",           // IPFS hash
    5 * LAMPORTS_PER_SOL,   // 5 SOL prize
    null                     // No deadline
  )
  .accounts({ ... })
  .rpc();
```

**What it does:**
1. Validates inputs
2. Transfers 0.001 SOL to treasury
3. Escrows prize SOL in bounty PDA
4. Creates bounty account
5. Updates treasury stats

---

### 3. `create_hunter_profile`
Hunter creates their profile (required before winning).

**Who can call**: Any hunter

**What it stores on-chain:**
- Hunter wallet address
- Bounties completed (reputation)
- Creation timestamp

**Note**: Full profile (skills, bio, etc.) stored off-chain in database.

---

### 4. `select_winner`
Company selects bounty winner and distributes prize.

**Parameters:**
- `submission_hash: String` - IPFS hash of winning submission

**Who can call**: Only the company that created the bounty

**Fees:**
- 1% platform fee (to treasury)
- 99% to winner

**Example:**
```typescript
await program.methods
  .selectWinner("QmWinningSubmission...")
  .accounts({
    bounty: bountyPda,
    treasury: treasuryPda,
    winnerProfile: hunterProfilePda,
    winner: hunterWallet,
    company: companyWallet,
  })
  .rpc();
```

**What it does:**
1. Verifies caller is bounty creator
2. Verifies bounty not already completed
3. Calculates fees (1% platform, 99% winner)
4. Transfers SOL from bounty → winner & treasury
5. Marks bounty as completed
6. Increments winner's reputation count
7. Updates treasury stats

**Constraints:**
- Only company can call
- Bounty must not be completed
- Creates hunter profile if doesn't exist

---

## 💰 Economics

### Fee Structure
```
Bounty Creation:  0.001 SOL (flat fee)
Bounty Completion: 1% of prize (deducted from prize)
```

### Example: 10 SOL Bounty
```
Company pays:     10.001 SOL (10 prize + 0.001 creation fee)
Escrowed:         10 SOL
Platform fee:     0.1 SOL (1% of 10)
Winner receives:  9.9 SOL (99% of 10)
```

### Why this model?
- **Creation fee**: Prevents spam bounties
- **Low %**: Encourages high-value bounties
- **No middleman**: Direct company → hunter payments
- **No escrow release**: Company can't get money back (prevents rugpulls)

## 📊 Account Structures

### Treasury
```rust
pub struct Treasury {
    pub authority: Pubkey,              // Protocol owner
    pub total_fees_collected: u64,      // All-time fees
    pub total_bounties_created: u32,    // Total bounties
    pub total_bounties_completed: u32,  // Completed bounties
    pub total_volume: u64,              // Total SOL prizes
    pub bump: u8,
}
```

**PDA Seeds**: `["treasury"]`

---

### Bounty
```rust
pub struct Bounty {
    pub company: Pubkey,                // Bounty creator
    pub description_hash: String,       // IPFS CID (max 64 chars)
    pub prize_amount: u64,              // Prize in lamports
    pub deadline_timestamp: Option<i64>,// Optional deadline
    pub winner: Option<Pubkey>,         // Winner wallet (if selected)
    pub completed: bool,                // Completion status
    pub created_at: i64,                // Unix timestamp
    pub completed_at: Option<i64>,      // Completion timestamp
    pub submission_hash: Option<String>,// Winner's IPFS submission
    pub bump: u8,
}
```

**PDA Seeds**: `["bounty", company, description_hash]`

**Holds**: Escrowed prize SOL

---

### HunterProfile
```rust
pub struct HunterProfile {
    pub hunter: Pubkey,             // Hunter wallet
    pub bounties_completed: u32,    // On-chain reputation
    pub created_at: i64,            // Unix timestamp
    pub bump: u8,
}
```

**PDA Seeds**: `["profile", hunter]`

**Note**: Full profile stored off-chain

---

## 🔒 Security Features

### Access Control
- Only company can select winner for their bounty
- No one can cancel or modify bounty after creation
- Winner selection is one-time only

### Safety Checks
- Prize amount must be > 0
- Description hash max 64 characters (IPFS CID)
- Checked math (no overflows)
- Double-completion prevention

### Economic Security
- Prize fully escrowed on creation
- Company can't get money back (aligned incentives)
- Platform fee automatically deducted
- No custody - all SOL in PDAs

## 🧪 Testing

```bash
# Run all tests
anchor test

# Run with detailed output
anchor test -- --nocapture

# Test coverage includes:
# ✅ Treasury initialization
# ✅ Bounty creation with validation
# ✅ Hunter profile creation
# ✅ Winner selection and payouts
# ✅ Fee distribution (1% platform)
# ✅ Reputation updates
# ✅ Access control (unauthorized attempts)
# ✅ Double-completion prevention
# ✅ Full lifecycle test
```

## 🌐 Frontend Integration (Coming Soon)

### Key User Flows

**Company Posts Bounty:**
1. Connect wallet
2. Fill bounty form (title, description, requirements, prize)
3. Upload to IPFS → get `description_hash`
4. Call `create_bounty` with hash + prize
5. Bounty appears on platform

**Hunter Completes Bounty:**
1. Browse bounties
2. Work on task (code, design, etc.)
3. Upload deliverables to IPFS → get `submission_hash`
4. Submit via platform (off-chain)
5. Company reviews

**Company Selects Winner:**
1. Review submissions
2. Choose best one
3. Call `select_winner` with `submission_hash`
4. Winner receives SOL, reputation++

### Profile System

**Hunter Profile (Off-Chain):**
```typescript
interface HunterProfile {
  wallet: string;           // On-chain
  bountiesCompleted: number; // On-chain
  alias: string;            // Off-chain
  skills: string[];         // Off-chain
  college?: string;         // Off-chain
  bio: string;              // Off-chain
  github?: string;          // Off-chain
  portfolio?: string[];     // Off-chain
  joinedAt: Date;           // Off-chain
}
```

**Company Profile (Off-Chain):**
```typescript
interface CompanyProfile {
  wallet: string;
  name: string;
  logo?: string;
  website?: string;
  bountiesPosted: number;
  rating: number;
}
```

## 🚨 Error Codes

```rust
DescriptionHashTooLong     // Hash > 64 chars
InvalidPrizeAmount         // Prize = 0
MathOverflow              // Arithmetic error
BountyAlreadyCompleted    // Can't select winner twice
UnauthorizedCompany       // Not bounty creator
```

## 📈 Roadmap

### Phase 1: MVP (Current)
- [x] Smart contract with escrow
- [x] Hunter reputation system
- [x] Winner selection
- [x] Fee distribution
- [x] Comprehensive tests

### Phase 2: Frontend
- [ ] Next.js web app
- [ ] Company dashboard
- [ ] Hunter profiles
- [ ] Bounty browser
- [ ] IPFS integration
- [ ] Wallet authentication

### Phase 3: Features
- [ ] Bounty categories/tags
- [ ] Search and filters
- [ ] Rating system (company ↔ hunter)
- [ ] Dispute resolution
- [ ] Multi-winner bounties
- [ ] Milestone-based payments

### Phase 4: Scale
- [ ] Mobile app
- [ ] Notification system
- [ ] Analytics dashboard
- [ ] Featured bounties
- [ ] Referral program

## 🤝 Contributing

We welcome contributions! Please:
1. Fork the repo
2. Create a feature branch
3. Add tests for new features
4. Ensure `anchor test` passes
5. Submit a pull request

## 📄 License

MIT

## 🔗 Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Documentation](https://docs.solana.com/)
- [IPFS Documentation](https://docs.ipfs.tech/)

## 📞 Support

- Issues: [GitHub Issues](https://github.com/yourusername/openbounty/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/openbounty/discussions)

---

**Built with ⚓ Anchor on Solana**