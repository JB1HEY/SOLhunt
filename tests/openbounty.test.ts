import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Openbounty } from "../target/types/openbounty";
import { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("openbounty", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Openbounty as Program<Openbounty>;
  
  let treasuryPda: PublicKey;
  let treasuryBump: number;

  const BOUNTY_CREATION_FEE = 0.001 * LAMPORTS_PER_SOL;
  const PLATFORM_FEE_BPS = 100; // 1%

  // Helper: Get treasury PDA
  function getTreasuryPda() {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );
    return { treasuryPda: pda, bump };
  }

  // Helper: Get bounty PDA
  function getBountyPda(company: PublicKey, descriptionHash: string) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("bounty"),
        company.toBuffer(),
        Buffer.from(descriptionHash),
      ],
      program.programId
    );
    return { bountyPda: pda, bump };
  }

  // Helper: Get hunter profile PDA
  function getProfilePda(hunter: PublicKey) {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), hunter.toBuffer()],
      program.programId
    );
    return { profilePda: pda, bump };
  }

  before(async () => {
    const result = getTreasuryPda();
    treasuryPda = result.treasuryPda;
    treasuryBump = result.bump;

    try {
      await program.methods
        .initializeTreasury()
        .accounts({
          treasury: treasuryPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log("✅ Treasury initialized");
    } catch (err) {
      console.log("Treasury already initialized or error:", err.message);
    }
  });

  describe("Treasury", () => {
    it("Treasury is initialized correctly", async () => {
      const treasury = await program.account.treasury.fetch(treasuryPda);
      
      expect(treasury.authority.toString()).to.equal(
        provider.wallet.publicKey.toString()
      );
      expect(treasury.totalFeesCollected.toNumber()).to.be.at.least(0);
      expect(treasury.totalBountiesCreated).to.be.at.least(0);
    });
  });

  describe("Create Bounty", () => {
    it("Creates a bounty with 5 SOL prize", async () => {
      const company = provider.wallet.publicKey;
      const descriptionHash = `QmTest${Date.now()}`; // Simulated IPFS hash
      const prizeAmount = new anchor.BN(5 * LAMPORTS_PER_SOL);
      const deadline = new anchor.BN(Date.now() / 1000 + 86400 * 7); // 1 week

      const { bountyPda } = getBountyPda(company, descriptionHash);

      const companyBalanceBefore = await provider.connection.getBalance(company);
      const treasuryBefore = await program.account.treasury.fetch(treasuryPda);

      await program.methods
        .createBounty(descriptionHash, prizeAmount, deadline)
        .accounts({
          bounty: bountyPda,
          treasury: treasuryPda,
          company: company,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const companyBalanceAfter = await provider.connection.getBalance(company);
      const bounty = await program.account.bounty.fetch(bountyPda);
      const treasuryAfter = await program.account.treasury.fetch(treasuryPda);

      // Verify bounty data
      expect(bounty.company.toString()).to.equal(company.toString());
      expect(bounty.descriptionHash).to.equal(descriptionHash);
      expect(bounty.prizeAmount.toNumber()).to.equal(prizeAmount.toNumber());
      expect(bounty.completed).to.be.false;
      expect(bounty.winner).to.be.null;

      // Verify SOL was escrowed
      const bountyBalance = await provider.connection.getBalance(bountyPda);
      expect(bountyBalance).to.be.at.least(prizeAmount.toNumber());

      // Verify creation fee was paid
      const feesPaid = treasuryAfter.totalFeesCollected.toNumber() - 
                      treasuryBefore.totalFeesCollected.toNumber();
      expect(feesPaid).to.equal(BOUNTY_CREATION_FEE);

      // Verify company paid fee + prize + rent
      const spent = companyBalanceBefore - companyBalanceAfter;
      expect(spent).to.be.greaterThan(prizeAmount.toNumber() + BOUNTY_CREATION_FEE);

      console.log("✅ Bounty created with 5 SOL prize");
      console.log("   Description hash:", descriptionHash);
      console.log("   Escrowed:", prizeAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   Creation fee:", BOUNTY_CREATION_FEE / LAMPORTS_PER_SOL, "SOL");
    });

    it("Creates bounty with no deadline", async () => {
      const company = provider.wallet.publicKey;
      const descriptionHash = `QmNoDeadline${Date.now()}`;
      const prizeAmount = new anchor.BN(2 * LAMPORTS_PER_SOL);

      const { bountyPda } = getBountyPda(company, descriptionHash);

      await program.methods
        .createBounty(descriptionHash, prizeAmount, null)
        .accounts({
          bounty: bountyPda,
          treasury: treasuryPda,
          company: company,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const bounty = await program.account.bounty.fetch(bountyPda);
      expect(bounty.deadlineTimestamp).to.be.null;

      console.log("✅ Bounty created with no deadline");
    });

    it("Fails with zero prize amount", async () => {
      const company = provider.wallet.publicKey;
      const descriptionHash = `QmZero${Date.now()}`;
      const prizeAmount = new anchor.BN(0);

      const { bountyPda } = getBountyPda(company, descriptionHash);

      try {
        await program.methods
          .createBounty(descriptionHash, prizeAmount, null)
          .accounts({
            bounty: bountyPda,
            treasury: treasuryPda,
            company: company,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        expect.fail("Should have failed with InvalidPrizeAmount");
      } catch (err) {
        expect(err.message).to.include("InvalidPrizeAmount");
        console.log("✅ Correctly rejected zero prize amount");
      }
    });
  });

  describe("Hunter Profiles", () => {
    it("Creates a hunter profile", async () => {
      const hunter = Keypair.generate();
      
      // Airdrop SOL for rent
      const airdropSig = await provider.connection.requestAirdrop(
        hunter.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const { profilePda } = getProfilePda(hunter.publicKey);

      await program.methods
        .createHunterProfile()
        .accounts({
          profile: profilePda,
          hunter: hunter.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([hunter])
        .rpc();

      const profile = await program.account.hunterProfile.fetch(profilePda);
      
      expect(profile.hunter.toString()).to.equal(hunter.publicKey.toString());
      expect(profile.bountiesCompleted).to.equal(0);

      console.log("✅ Hunter profile created");
      console.log("   Hunter wallet:", hunter.publicKey.toString());
    });
  });

  describe("Select Winner", () => {
    let bountyPda: PublicKey;
    let company: PublicKey;
    let hunter: Keypair;
    let profilePda: PublicKey;
    const prizeAmount = new anchor.BN(10 * LAMPORTS_PER_SOL);

    before(async () => {
      company = provider.wallet.publicKey;
      hunter = Keypair.generate();
      
      // Airdrop to hunter
      const airdropSig = await provider.connection.requestAirdrop(
        hunter.publicKey,
        5 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      // Create bounty
      const descriptionHash = `QmWinnerTest${Date.now()}`;
      const result = getBountyPda(company, descriptionHash);
      bountyPda = result.bountyPda;

      await program.methods
        .createBounty(descriptionHash, prizeAmount, null)
        .accounts({
          bounty: bountyPda,
          treasury: treasuryPda,
          company: company,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Get profile PDA
      const profileResult = getProfilePda(hunter.publicKey);
      profilePda = profileResult.profilePda;
    });

    it("Company selects winner and distributes prize", async () => {
      const submissionHash = `QmSubmission${Date.now()}`;

      const hunterBalanceBefore = await provider.connection.getBalance(hunter.publicKey);
      const treasuryBefore = await program.account.treasury.fetch(treasuryPda);

      await program.methods
        .selectWinner(submissionHash)
        .accounts({
          bounty: bountyPda,
          treasury: treasuryPda,
          winnerProfile: profilePda,
          winner: hunter.publicKey,
          company: company,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const hunterBalanceAfter = await provider.connection.getBalance(hunter.publicKey);
      const bounty = await program.account.bounty.fetch(bountyPda);
      const treasuryAfter = await program.account.treasury.fetch(treasuryPda);
      const profile = await program.account.hunterProfile.fetch(profilePda);

      // Verify bounty completed
      expect(bounty.completed).to.be.true;
      expect(bounty.winner.toString()).to.equal(hunter.publicKey.toString());
      expect(bounty.submissionHash).to.equal(submissionHash);

      // Verify platform fee (1% of 10 SOL = 0.1 SOL)
      const expectedPlatformFee = (prizeAmount.toNumber() * PLATFORM_FEE_BPS) / 10000;
      const actualFees = treasuryAfter.totalFeesCollected.toNumber() - 
                        treasuryBefore.totalFeesCollected.toNumber();
      expect(actualFees).to.equal(expectedPlatformFee);

      // Verify hunter received 99% of prize
      const expectedPayout = prizeAmount.toNumber() - expectedPlatformFee;
      const actualPayout = hunterBalanceAfter - hunterBalanceBefore;
      expect(actualPayout).to.equal(expectedPayout);

      // Verify profile updated
      expect(profile.bountiesCompleted).to.equal(1);

      // Verify treasury stats
      expect(treasuryAfter.totalBountiesCompleted).to.be.greaterThan(
        treasuryBefore.totalBountiesCompleted
      );

      console.log("✅ Winner selected and paid");
      console.log("   Prize:", prizeAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   Platform fee:", expectedPlatformFee / LAMPORTS_PER_SOL, "SOL");
      console.log("   Winner payout:", expectedPayout / LAMPORTS_PER_SOL, "SOL");
      console.log("   Hunter completions:", profile.bountiesCompleted);
    });

    it("Fails if non-company tries to select winner", async () => {
      const company2 = provider.wallet.publicKey;
      const hunter2 = Keypair.generate();
      const descriptionHash = `QmUnauth${Date.now()}`;
      
      // Create bounty as company
      const { bountyPda: bounty2Pda } = getBountyPda(company2, descriptionHash);
      await program.methods
        .createBounty(descriptionHash, new anchor.BN(1 * LAMPORTS_PER_SOL), null)
        .accounts({
          bounty: bounty2Pda,
          treasury: treasuryPda,
          company: company2,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Try to select winner as different wallet
      const attacker = Keypair.generate();
      const airdropSig = await provider.connection.requestAirdrop(
        attacker.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const { profilePda: hunter2Profile } = getProfilePda(hunter2.publicKey);

      try {
        await program.methods
          .selectWinner("QmFake")
          .accounts({
            bounty: bounty2Pda,
            treasury: treasuryPda,
            winnerProfile: hunter2Profile,
            winner: hunter2.publicKey,
            company: attacker.publicKey, // Wrong company!
            systemProgram: SystemProgram.programId,
          })
          .signers([attacker])
          .rpc();
        
        expect.fail("Should have failed with UnauthorizedCompany");
      } catch (err) {
        expect(err.message).to.include("UnauthorizedCompany");
        console.log("✅ Correctly rejected unauthorized winner selection");
      }
    });

    it("Fails if trying to select winner twice", async () => {
      const company3 = provider.wallet.publicKey;
      const hunter3 = Keypair.generate();
      const descriptionHash = `QmDouble${Date.now()}`;
      
      // Airdrop to hunter
      const airdropSig = await provider.connection.requestAirdrop(
        hunter3.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      // Create bounty
      const { bountyPda: bounty3Pda } = getBountyPda(company3, descriptionHash);
      await program.methods
        .createBounty(descriptionHash, new anchor.BN(2 * LAMPORTS_PER_SOL), null)
        .accounts({
          bounty: bounty3Pda,
          treasury: treasuryPda,
          company: company3,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const { profilePda: hunter3Profile } = getProfilePda(hunter3.publicKey);

      // Select winner first time
      await program.methods
        .selectWinner("QmFirst")
        .accounts({
          bounty: bounty3Pda,
          treasury: treasuryPda,
          winnerProfile: hunter3Profile,
          winner: hunter3.publicKey,
          company: company3,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Try to select winner again
      try {
        await program.methods
          .selectWinner("QmSecond")
          .accounts({
            bounty: bounty3Pda,
            treasury: treasuryPda,
            winnerProfile: hunter3Profile,
            winner: hunter3.publicKey,
            company: company3,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        expect.fail("Should have failed with BountyAlreadyCompleted");
      } catch (err) {
        expect(err.message).to.include("BountyAlreadyCompleted");
        console.log("✅ Correctly prevented double winner selection");
      }
    });
  });

  describe("Full Bounty Lifecycle", () => {
    it("Complete flow: create bounty -> select winner -> verify reputation", async () => {
      console.log("\n🎯 Running full bounty lifecycle...\n");

      const company = provider.wallet.publicKey;
      const hunter = Keypair.generate();
      const descriptionHash = `QmFullTest${Date.now()}`;
      const prizeAmount = new anchor.BN(20 * LAMPORTS_PER_SOL);

      // 1. Airdrop to hunter
      console.log("1️⃣  Airdropping SOL to hunter...");
      const airdropSig = await provider.connection.requestAirdrop(
        hunter.publicKey,
        5 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);
      console.log("   ✅ Hunter funded");

      // 2. Company creates bounty
      console.log("\n2️⃣  Company creating bounty...");
      const { bountyPda } = getBountyPda(company, descriptionHash);
      const deadline = new anchor.BN(Date.now() / 1000 + 86400 * 30); // 30 days

      await program.methods
        .createBounty(descriptionHash, prizeAmount, deadline)
        .accounts({
          bounty: bountyPda,
          treasury: treasuryPda,
          company: company,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const bounty = await program.account.bounty.fetch(bountyPda);
      console.log("   ✅ Bounty created");
      console.log("   Prize:", bounty.prizeAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   Description hash:", bounty.descriptionHash);

      // 3. Hunter completes work and submits (off-chain)
      console.log("\n3️⃣  Hunter completes work (simulated off-chain)...");
      const submissionHash = `QmSubmission${Date.now()}`;
      console.log("   ✅ Work completed, submission hash:", submissionHash);

      // 4. Company selects winner
      console.log("\n4️⃣  Company selecting winner...");
      const { profilePda } = getProfilePda(hunter.publicKey);
      const hunterBalanceBefore = await provider.connection.getBalance(hunter.publicKey);

      await program.methods
        .selectWinner(submissionHash)
        .accounts({
          bounty: bountyPda,
          treasury: treasuryPda,
          winnerProfile: profilePda,
          winner: hunter.publicKey,
          company: company,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const hunterBalanceAfter = await provider.connection.getBalance(hunter.publicKey);
      const payout = (hunterBalanceAfter - hunterBalanceBefore) / LAMPORTS_PER_SOL;
      
      console.log("   ✅ Winner selected!");
      console.log("   Hunter received:", payout.toFixed(4), "SOL");

      // 5. Verify everything
      console.log("\n5️⃣  Verifying final state...");
      const finalBounty = await program.account.bounty.fetch(bountyPda);
      const profile = await program.account.hunterProfile.fetch(profilePda);
      const treasury = await program.account.treasury.fetch(treasuryPda);

      expect(finalBounty.completed).to.be.true;
      expect(finalBounty.winner.toString()).to.equal(hunter.publicKey.toString());
      expect(profile.bountiesCompleted).to.equal(1);
      
      console.log("   ✅ Bounty marked completed");
      console.log("   ✅ Winner:", hunter.publicKey.toString().slice(0, 8) + "...");
      console.log("   ✅ Hunter reputation: ", profile.bountiesCompleted, "bounties completed");
      console.log("   ✅ Treasury stats:", {
        totalBounties: treasury.totalBountiesCreated,
        totalCompleted: treasury.totalBountiesCompleted,
        totalVolume: treasury.totalVolume.toNumber() / LAMPORTS_PER_SOL + " SOL",
      });

      console.log("\n✅ Full lifecycle test complete!");
    });
  });
});