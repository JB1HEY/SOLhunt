import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Openbounty } from "../target/types/openbounty";
import { PublicKey, SystemProgram } from "@solana/web3.js";

async function initializeTreasury() {
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Openbounty as Program<Openbounty>;

  console.log("Program ID:", program.programId.toString());
  console.log("Authority:", provider.wallet.publicKey.toString());

  // Get treasury PDA
  const [treasuryPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury")],
    program.programId
  );

  console.log("\nTreasury PDA:", treasuryPda.toString());
  console.log("Bump:", bump);

  // Check if treasury already exists
  try {
    const treasury = await program.account.treasury.fetch(treasuryPda);
    console.log("\n✅ Treasury already initialized!");
    console.log("Authority:", treasury.authority.toString());
    console.log("Total bounties created:", treasury.totalBountiesCreated);
    console.log("Total completed:", treasury.totalBountiesCompleted);
    console.log("Total fees collected:", treasury.totalFeesCollected.toNumber() / 1e9, "SOL");
    return;
  } catch (err) {
    console.log("\n⏳ Treasury not found, initializing...");
  }

  // Initialize treasury
  try {
    const tx = await program.methods
      .initializeTreasury()
      .accounts({
        treasury: treasuryPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("\n✅ Treasury initialized successfully!");
    console.log("Transaction signature:", tx);

    // Fetch and display
    const treasury = await program.account.treasury.fetch(treasuryPda);
    console.log("\nTreasury details:");
    console.log("Authority:", treasury.authority.toString());
    console.log("PDA:", treasuryPda.toString());
    
  } catch (err) {
    console.error("\n❌ Error initializing treasury:", err);
    throw err;
  }
}

initializeTreasury()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });