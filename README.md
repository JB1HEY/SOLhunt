# SOLhunt - Decentralized Freelance Bounty Platform

A decentralized bounty platform on Solana where companies post tasks with SOL rewards, and freelance "hunters" compete to complete them.

## 🎯 Overview

**SOLhunt** is a trustless freelance marketplace built on Solana that enables:
- **Companies**: Post bounties with escrowed SOL prizes
- **Hunters**: Build reputation by completing bounties
- **Platform**: Sustainable 1% fee model

### Key Features
- ✅ **Trustless Escrow**: Prize SOL locked in smart contract
- ✅ **Automatic Expiry**: Bounties expire after 6 months if no winner selected
- ✅ **On-Chain Reputation**: Hunter completion stats stored on-chain
- ✅ **Low Fees**: 0.001 SOL to post, 1% on completion
- ✅ **Full-Stack Platform**: Next.js frontend with Supabase backend
- ✅ **User Profiles**: Rich off-chain profiles with skills, bio, and portfolio
- ✅ **Dark Theme**: Modern Silver & Blue aesthetic

## 🛠️ Tech Stack

### Smart Contract
- **Framework**: Anchor 0.32.1
- **Language**: Rust
- **Blockchain**: Solana
- **Program ID**: `G5MSUKpKWNzGoHbpphuPS3QsKXUD7EPa54oRDapXxSQ8`

### Frontend
- **Framework**: Next.js 14
- **Wallet**: Solana Wallet Adapter (Phantom, Solflare)
- **Database**: Supabase (profiles, submissions, bounties)
- **Styling**: Tailwind CSS with custom dark theme
- **Language**: TypeScript

## 📦 Prerequisites

- Rust 1.75+
- Solana CLI 1.18+
- Anchor CLI 0.32.1
- Node.js 18+
- Supabase account (for database)

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
cd OpenBounty
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

### 4. Deploy Smart Contract

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

### 5. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local with your Supabase credentials
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
EOF

# Run development server
npm run dev
```

### 6. Run Tests

```bash
anchor test
```

## 🏗️ Architecture

### On-Chain (Smart Contract)

The smart contract handles:
- **Escrow**: Locks prize SOL until winner selected or expiry (6 months)
- **Reputation**: Tracks hunter completion count
- **Fees**: Collects creation fee (0.001 SOL) + platform fee (1%)
- **Expiry**: Allows reclaiming expired bounty funds to treasury

### Off-Chain (Frontend + Database)

The frontend/database stores:
- **Bounty Details**: Full descriptions, requirements, deliverables
- **Hunter Profiles**: Skills, bio, college, portfolio, avatar
- **Submissions**: GitHub links, demo URLs, video demos
- **Metadata**: Categories, tags, submission counts

**Why hybrid?**
- Smart contract = expensive but immutable (money & reputation)
- Database = cheap and flexible (rich data & search)
- Best of both worlds

## 🔧 Core Instructions

### 1. `initialize_treasury`
One-time setup, creates treasury account.

**Who can call**: Anyone (only works once)

```rust
pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()>
```

**PDA Seeds**: `["treasury_v1"]`

---

### 2. `create_bounty`
Company posts a new bounty with escrowed prize.

**Parameters:**
- `description_hash: String` - Hash of full bounty details
- `prize_amount: u64` - SOL to award winner (in lamports)
- `deadline_timestamp: Option<i64>` - Optional Unix timestamp deadline

**Fees:**
- 0.001 SOL creation fee (to treasury)
- `prize_amount` escrowed in bounty PDA

**What it does:**
1. Validates inputs
2. Transfers 0.001 SOL to treasury
3. Escrows prize SOL in bounty PDA
4. Sets expiry timestamp (6 months from creation)
5. Creates bounty account
6. Updates treasury stats

---

### 3. `create_hunter_profile`
Hunter creates their profile (required before winning).

**Who can call**: Any hunter

**What it stores on-chain:**
- Hunter wallet address
- Bounties completed (reputation)
- Creation timestamp

**Note**: Full profile (skills, bio, avatar, etc.) stored off-chain in Supabase.

---

### 4. `select_winner`
Company selects bounty winner and distributes prize.

**Parameters:**
- `submission_hash: String` - Hash of winning submission

**Who can call**: Only the company that created the bounty

**Fees:**
- 1% platform fee (to treasury)
- 99% to winner

**What it does:**
1. Verifies caller is bounty creator
2. Verifies bounty not completed or expired
3. Checks expiry timestamp (must be within 6 months)
4. Calculates fees (1% platform, 99% winner)
5. Transfers SOL from bounty → winner & treasury
6. Marks bounty as completed
7. Increments winner's reputation count
8. Updates treasury stats

---

### 5. `reclaim_expired_bounty`
Reclaims funds from expired bounties (6+ months old).

**Who can call**: Anyone

**What it does:**
1. Verifies bounty has expired (6 months passed)
2. Verifies bounty not already completed
3. Transfers all escrowed funds to treasury
4. Marks bounty as expired
5. Updates treasury stats

---

## 💰 Economics

### Fee Structure
```
Bounty Creation:  0.001 SOL (flat fee)
Bounty Completion: 1% of prize (deducted from prize)
Bounty Expiry:     6 months (180 days)
```

### Example: 10 SOL Bounty
```
Company pays:     10.001 SOL (10 prize + 0.001 creation fee)
Escrowed:         10 SOL
Platform fee:     0.1 SOL (1% of 10)
Winner receives:  9.9 SOL (99% of 10)
```

### Expiry System
- Bounties expire after 6 months if no winner selected
- Expired funds are reclaimed to treasury
- Prevents indefinite fund locking
- Encourages timely winner selection

## 📊 Account Structures

### Treasury
```rust
pub struct Treasury {
    pub authority: Pubkey,                  // Protocol owner
    pub total_fees_collected: u64,          // All-time fees
    pub total_bounties_created: u32,        // Total bounties
    pub total_bounties_completed: u32,      // Completed bounties
    pub total_volume: u64,                  // Total SOL prizes
    pub total_expired_funds_reclaimed: u64, // Reclaimed from expired bounties
    pub bump: u8,
}
```

**PDA Seeds**: `["treasury_v1"]`

---

### Bounty
```rust
pub struct Bounty {
    pub company: Pubkey,                // Bounty creator
    pub description_hash: String,       // Hash (max 64 chars)
    pub prize_amount: u64,              // Prize in lamports
    pub deadline_timestamp: Option<i64>,// Optional deadline
    pub winner: Option<Pubkey>,         // Winner wallet (if selected)
    pub completed: bool,                // Completion status
    pub created_at: i64,                // Unix timestamp
    pub completed_at: Option<i64>,      // Completion timestamp
    pub submission_hash: Option<String>,// Winner's submission
    pub expiry_timestamp: i64,          // When escrow expires (6 months)
    pub expired: bool,                  // Whether bounty has expired
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

---

## 🌐 Frontend Features

### User Profiles
- **Avatar Upload**: Base64 image storage
- **Skills**: Comma-separated tags
- **Bio**: 500 character limit
- **Social Links**: GitHub, LinkedIn, Twitter, Portfolio
- **College/University**: Educational background
- **Location**: Geographic info
- **On-Chain Stats**: Bounties won, total submissions

### Bounty Management
- **Create Bounty**: Rich form with title, description, requirements, deliverables
- **Edit Bounty**: Update metadata (off-chain only)
- **Browse Bounties**: Filter by category, search, sort
- **View Submissions**: Review hunter submissions with links
- **Select Winner**: One-click winner selection with automatic payment

### Submission System
- **Submit Work**: Description, GitHub URL, demo URL, video URL
- **File Uploads**: Support for screenshots and documents
- **Status Tracking**: Pending, Accepted, Rejected
- **Submission History**: View all past submissions

### Dashboard
- **Company View**: Posted bounties, active submissions
- **Hunter View**: Submitted work, won bounties
- **Stats**: Completion rate, total earnings, reputation

### Search & Discovery
- **User Search**: Find hunters by name or wallet
- **Bounty Filters**: Category, status, prize amount
- **Sort Options**: Newest, highest prize, most submissions

## 🔒 Security Features

### Access Control
- Only company can select winner for their bounty
- No one can cancel or modify bounty after creation
- Winner selection is one-time only
- Expiry reclamation available to anyone after 6 months

### Safety Checks
- Prize amount must be > 0
- Description hash max 64 characters
- Checked math (no overflows)
- Double-completion prevention
- Expiry timestamp validation

### Economic Security
- Prize fully escrowed on creation
- Company can't get money back (aligned incentives)
- Platform fee automatically deducted
- Expired funds reclaimed to treasury
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
# ✅ Expiry system
# ✅ Expired bounty reclamation
# ✅ Full lifecycle test
```

## 🚨 Error Codes

```rust
DescriptionHashTooLong     // Hash > 64 chars
InvalidPrizeAmount         // Prize = 0
MathOverflow              // Arithmetic error
BountyAlreadyCompleted    // Can't select winner twice
UnauthorizedCompany       // Not bounty creator
BountyExpired             // 6 months passed without winner
BountyNotExpired          // Can't reclaim before 6 months
BountyAlreadyExpired      // Already marked as expired
```

## 📈 Current Status

### ✅ Completed
- [x] Smart contract with escrow
- [x] Hunter reputation system
- [x] Winner selection
- [x] Fee distribution
- [x] Expiry system (6 months)
- [x] Expired bounty reclamation
- [x] Comprehensive tests
- [x] Next.js frontend
- [x] Wallet integration (Phantom, Solflare)
- [x] User profiles with Supabase
- [x] Bounty creation & editing
- [x] Submission system
- [x] Company & hunter dashboards
- [x] User search
- [x] Dark theme (Silver & Blue)
- [x] Profile persistence

### 🚧 In Progress
- [ ] Rating system (company ↔ hunter)
- [ ] Notifications
- [ ] Advanced filtering

### 🔮 Future
- [ ] Dispute resolution
- [ ] Multi-winner bounties
- [ ] Milestone-based payments
- [ ] Mobile app
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
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)

---

**Built with ⚓ Anchor on Solana**