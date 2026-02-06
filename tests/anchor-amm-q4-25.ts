import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorAmmQ425 } from "../target/types/anchor_amm_q4_25";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("anchor-amm-q4-25", () => {
  // Configure the client to use the local cluster.
  // anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.anchorAmmQ425 as Program<AnchorAmmQ425>;
  const user = provider.wallet;

  let mintX: anchor.web3.PublicKey;
  let mintY: anchor.web3.PublicKey;

  let userX: any;
  let userY: any;

  let configPda: anchor.web3.PublicKey;
  let vaultX: anchor.web3.PublicKey;
  let vaultY: anchor.web3.PublicKey;
  let mintLp: anchor.web3.PublicKey;

  const seed = new anchor.BN(42);
  const fee = 30; // 0.3%

  before(async () => {
    // 1. Create token mints
    mintX = await createMint(
      provider.connection,
      user.payer,
      user.publicKey,
      null,
      6
    );

    mintY = await createMint(
      provider.connection,
      user.payer,
      user.publicKey,
      null,
      6
    );

    // 2. Create user token accounts
    userX = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user.payer,
      mintX,
      user.publicKey
    );

    userY = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user.payer,
      mintY,
      user.publicKey
    );

    // 3. Mint tokens to user
    await mintTo(
      provider.connection,
      user.payer,
      mintX,
      userX.address,
      user.publicKey,
      1_000_000_000
    );

    await mintTo(
      provider.connection,
      user.payer,
      mintY,
      userY.address,
      user.publicKey,
      1_000_000_000
    );

    // 4. Derive PDAs
    [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config"), seed.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [mintLp] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lp"), configPda.toBuffer()],
      program.programId
    );

    vaultX = await anchor.utils.token.associatedAddress({
      mint: mintX,
      owner: configPda,
    });

    vaultY = await anchor.utils.token.associatedAddress({
      mint: mintY,
      owner: configPda,
    });
  });

  it("Is initialized!", async () => {
    // Add your test here.
    // const tx = await program.methods.initialize().rpc();
    // console.log("Your transaction signature", tx);
    await program.methods
      .initialize(seed, fee, null)
      .accountsPartial({
        initializer: user.publicKey,
        mintX,
        mintY,
        config: configPda,
        mintLp,
        vaultX,
        vaultY,
      })
      .rpc();

    const config = await program.account.config.fetch(configPda);
    assert.ok(config.mintX.equals(mintX));
    assert.ok(config.mintY.equals(mintY));
  });

  it("deposit liquidity", async () => {
    const lpAmount = new anchor.BN(1_000_000);

    await program.methods
      .deposit(lpAmount, lpAmount, lpAmount)
      .accountsPartial({
        user: user.publicKey,
        mintX,
        mintY,
        config: configPda,
        mintLp,
        vaultX,
        vaultY,
        userX: userX.address,
        userY: userY.address,
      })
      .rpc();

    const vaultXAcc = await getAccount(provider.connection, vaultX);
    const vaultYAcc = await getAccount(provider.connection, vaultY);

    assert.ok(Number(vaultXAcc.amount) > 0);
    assert.ok(Number(vaultYAcc.amount) > 0);

  });

  it("swap X -> Y", async () => {
    const vaultXBefore = await getAccount(provider.connection, vaultX);
    const vaultYBefore = await getAccount(provider.connection, vaultY);

    const kBefore =
      Number(vaultXBefore.amount) * Number(vaultYBefore.amount);

    const swapIn = new anchor.BN(100_000);
    const minOut = new anchor.BN(1);

    await program.methods
      .swap(true, swapIn, minOut)
      .accountsPartial({
        user: user.publicKey,
        mintX,
        mintY,
        config: configPda,
        vaultX,
        vaultY,
        userX: userX.address,
        userY: userY.address,
      })
      .rpc();

    const userYAcc = await getAccount(provider.connection, userY.address);
    assert.ok(Number(userYAcc.amount) > 0);

    const vaultXAfter = await getAccount(provider.connection, vaultX);
    const vaultYAfter = await getAccount(provider.connection, vaultY);

    const kAfter =
      Number(vaultXAfter.amount) * Number(vaultYAfter.amount);

    assert.isAtLeast(kAfter, kBefore);
  });

  it("withdraw liquidity", async () => {
    const lpBurn = new anchor.BN(500_000);

    await program.methods
      .withdraw(lpBurn, new anchor.BN(1), new anchor.BN(1))
      .accountsPartial({
        user: user.publicKey,
        mintX,
        mintY,
        config: configPda,
        mintLp,
        vaultX,
        vaultY,
        userX: userX.address,
        userY: userY.address,
      })
      .rpc();

    const userXAcc = await getAccount(provider.connection, userX.address);
    const userYAcc = await getAccount(provider.connection, userY.address);

    assert.ok(Number(userXAcc.amount) > 0);
    assert.ok(Number(userYAcc.amount) > 0);
  });
});
