/**
 * TypeScript client for the lookthrough program (Anchor 1.2.0, @anchor-lang/core).
 * The IDL and its types are copied from target/ by `pnpm idl:sync` after `anchor build`.
 */
import * as anchorNs from "@anchor-lang/core";
import type { Wallet } from "@anchor-lang/core";
import BN from "bn.js";

// @anchor-lang/core ships CJS and ESM; Node's CJS interop exposes the module as `default`, bundlers as the namespace.
const anchor = ((anchorNs as { default?: unknown }).default ?? anchorNs) as typeof anchorNs;
const { AnchorProvider, Program } = anchor;
import type { Connection} from "@solana/web3.js";
import { Keypair, PublicKey, type Commitment, type Transaction, type VersionedTransaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idlJson from "./idl/lookthrough.json" with { type: "json" };
import type { Lookthrough } from "./idl/lookthrough";
import { actionPda, receiptPda, registrationPda, vaultPda } from "./pda";

export const LOOKTHROUGH_IDL = idlJson as Lookthrough;
export const LOOKTHROUGH_PROGRAM_ID = new PublicKey((idlJson as { address: string }).address);

export type ActionKind = "distribution" | "vote";
export type VoteChoice = "for" | "against" | "abstain";

export interface CreateActionInput {
  actionId: Uint8Array;
  kind: ActionKind;
  mint: PublicKey;
  usdcMint: PublicKey;
  snapshotSlot: bigint;
  root: Uint8Array;
  contentHash: Uint8Array;
  metadataUri: string;
  totalEntitlement: bigint;
  amountPerShareMicro?: bigint;
  claimsCloseSlot?: bigint;
  questionHash?: Uint8Array;
  deadlineSlot?: bigint;
}

export interface ActionState {
  address: PublicKey;
  authority: PublicKey;
  mint: PublicKey;
  actionId: Uint8Array;
  kind: ActionKind;
  snapshotSlot: bigint;
  root: Uint8Array;
  contentHash: Uint8Array;
  metadataUri: string;
  totalEntitlement: bigint;
  createdAtSlot: bigint;
  closed: boolean;
  usdcMint: PublicKey;
  vault: PublicKey;
  amountPerShareMicro: bigint;
  claimedTotal: bigint;
  claimsCloseSlot: bigint;
  funded: boolean;
  questionHash: Uint8Array;
  deadlineSlot: bigint;
  forWeight: bigint;
  againstWeight: bigint;
  abstainWeight: bigint;
  voters: number;
}

/** A wallet that never signs, for read-only Program instances (explorer pages). */
export class ReadOnlyWallet implements Wallet {
  readonly payer = Keypair.generate();
  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }
  async signTransaction<T extends Transaction | VersionedTransaction>(): Promise<T> {
    throw new Error("read-only wallet cannot sign");
  }
  async signAllTransactions<T extends Transaction | VersionedTransaction>(): Promise<T[]> {
    throw new Error("read-only wallet cannot sign");
  }
}

const bn = (v: bigint) => new BN(v.toString());
const big = (v: BN | number | string) => BigInt(v.toString());

export class LookthroughClient {
  readonly program: InstanceType<typeof Program<Lookthrough>>;
  readonly provider: InstanceType<typeof AnchorProvider>;
  readonly programId: PublicKey;

  constructor(connection: Connection, wallet: Wallet, opts?: { commitment?: Commitment }) {
    this.provider = new AnchorProvider(connection, wallet, { commitment: opts?.commitment ?? "confirmed" });
    this.program = new Program<Lookthrough>(LOOKTHROUGH_IDL, this.provider);
    this.programId = this.program.programId;
  }

  static readOnly(connection: Connection): LookthroughClient {
    return new LookthroughClient(connection, new ReadOnlyWallet());
  }

  get wallet(): PublicKey {
    return this.provider.wallet.publicKey;
  }

  // PDAs
  registration(mint: PublicKey, wallet = this.wallet): PublicKey {
    return registrationPda(this.programId, mint, wallet);
  }
  action(actionId: Uint8Array): PublicKey {
    return actionPda(this.programId, actionId);
  }
  vault(action: PublicKey): PublicKey {
    return vaultPda(this.programId, action);
  }
  receipt(action: PublicKey, wallet = this.wallet): PublicKey {
    return receiptPda(this.programId, action, wallet);
  }

  /** Register the connected wallet for corporate actions on `mint`. */
  async register(mint: PublicKey): Promise<string> {
    return this.program.methods.register().accountsPartial({ wallet: this.wallet, mint }).rpc();
  }

  async isRegistered(mint: PublicKey, wallet = this.wallet): Promise<{ registered: boolean; slot?: bigint }> {
    const acc = await this.program.account.registration.fetchNullable(this.registration(mint, wallet));
    return acc ? { registered: true, slot: big(acc.registeredAtSlot) } : { registered: false };
  }

  async createAction(input: CreateActionInput): Promise<{ signature: string; action: PublicKey; vault: PublicKey }> {
    const action = this.action(input.actionId);
    const vault = this.vault(action);
    const usdcProgram = await this.tokenProgramOf(input.usdcMint);
    const signature = await this.program.methods
      .createAction({
        actionId: Array.from(input.actionId),
        kind: input.kind === "distribution" ? { distribution: {} } : { vote: {} },
        snapshotSlot: bn(input.snapshotSlot),
        root: Array.from(input.root),
        contentHash: Array.from(input.contentHash),
        metadataUri: input.metadataUri,
        totalEntitlement: bn(input.totalEntitlement),
        amountPerShareMicro: bn(input.amountPerShareMicro ?? 0n),
        claimsCloseSlot: bn(input.claimsCloseSlot ?? 0n),
        questionHash: Array.from(input.questionHash ?? new Uint8Array(32)),
        deadlineSlot: bn(input.deadlineSlot ?? 0n)
      })
      .accountsPartial({ authority: this.wallet, mint: input.mint, usdcMint: input.usdcMint, tokenProgram: usdcProgram })
      .rpc();
    return { signature, action, vault };
  }

  async fundDistribution(actionId: Uint8Array, amount: bigint): Promise<string> {
    const state = await this.fetchAction(actionId);
    if (!state) throw new Error("action not found");
    const usdcProgram = await this.tokenProgramOf(state.usdcMint);
    const funderAta = getAssociatedTokenAddressSync(state.usdcMint, this.wallet, false, usdcProgram);
    return this.program.methods
      .fundDistribution(bn(amount))
      .accountsPartial({ authority: this.wallet, action: state.address, vault: state.vault, funderTokenAccount: funderAta, usdcMint: state.usdcMint, tokenProgram: usdcProgram })
      .rpc();
  }

  /** Claim: creates the wallet's USDC ATA if needed in the same transaction. */
  async claim(actionId: Uint8Array, entitlement: bigint, proof: Uint8Array[]): Promise<string> {
    const state = await this.fetchAction(actionId);
    if (!state) throw new Error("action not found");
    const usdcProgram = await this.tokenProgramOf(state.usdcMint);
    const ata = getAssociatedTokenAddressSync(state.usdcMint, this.wallet, false, usdcProgram);
    return this.program.methods
      .claim(bn(entitlement), proof.map((p) => Array.from(p)))
      .accountsPartial({
        wallet: this.wallet,
        mint: state.mint,
        action: state.address,
        vault: state.vault,
        walletTokenAccount: ata,
        usdcMint: state.usdcMint,
        tokenProgram: usdcProgram
      })
      .preInstructions([createAssociatedTokenAccountIdempotentInstruction(this.wallet, ata, this.wallet, state.usdcMint, usdcProgram)])
      .rpc();
  }

  async castVote(actionId: Uint8Array, entitlement: bigint, proof: Uint8Array[], choice: VoteChoice): Promise<string> {
    const state = await this.fetchAction(actionId);
    if (!state) throw new Error("action not found");
    const choiceArg = choice === "for" ? { for: {} } : choice === "against" ? { against: {} } : { abstain: {} };
    return this.program.methods
      .castVote(bn(entitlement), proof.map((p) => Array.from(p)), choiceArg)
      .accountsPartial({ wallet: this.wallet, mint: state.mint, action: state.address })
      .rpc();
  }

  async closeAction(actionId: Uint8Array): Promise<string> {
    const state = await this.fetchAction(actionId);
    if (!state) throw new Error("action not found");
    const usdcProgram = await this.tokenProgramOf(state.usdcMint);
    const ata = getAssociatedTokenAddressSync(state.usdcMint, this.wallet, false, usdcProgram);
    return this.program.methods
      .closeAction()
      .accountsPartial({ authority: this.wallet, action: state.address, vault: state.vault, authorityTokenAccount: ata, usdcMint: state.usdcMint, tokenProgram: usdcProgram })
      .preInstructions([createAssociatedTokenAccountIdempotentInstruction(this.wallet, ata, this.wallet, state.usdcMint, usdcProgram)])
      .rpc();
  }

  async fetchAction(actionId: Uint8Array): Promise<ActionState | null> {
    const address = this.action(actionId);
    const a = await this.program.account.action.fetchNullable(address);
    if (!a) return null;
    return {
      address,
      authority: a.authority,
      mint: a.mint,
      actionId: new Uint8Array(a.actionId),
      kind: "distribution" in a.kind ? "distribution" : "vote",
      snapshotSlot: big(a.snapshotSlot),
      root: new Uint8Array(a.root),
      contentHash: new Uint8Array(a.contentHash),
      metadataUri: a.metadataUri,
      totalEntitlement: big(a.totalEntitlement),
      createdAtSlot: big(a.createdAtSlot),
      closed: a.closed,
      usdcMint: a.usdcMint,
      vault: a.vault,
      amountPerShareMicro: big(a.amountPerShareMicro),
      claimedTotal: big(a.claimedTotal),
      claimsCloseSlot: big(a.claimsCloseSlot),
      funded: a.funded,
      questionHash: new Uint8Array(a.questionHash),
      deadlineSlot: big(a.deadlineSlot),
      forWeight: big(a.forWeight),
      againstWeight: big(a.againstWeight),
      abstainWeight: big(a.abstainWeight),
      voters: a.voters
    };
  }

  async fetchReceipt(actionId: Uint8Array, wallet = this.wallet): Promise<{ entitlement: bigint; amountPaid: bigint; choice: VoteChoice | null; slot: bigint } | null> {
    const r = await this.program.account.claimReceipt.fetchNullable(this.receipt(this.action(actionId), wallet));
    if (!r) return null;
    const choice = r.choice ? ("for" in r.choice ? "for" : "against" in r.choice ? "against" : "abstain") : null;
    return { entitlement: big(r.entitlement), amountPaid: big(r.amountPaid), choice, slot: big(r.slot) };
  }

  private async tokenProgramOf(mint: PublicKey): Promise<PublicKey> {
    const info = await this.provider.connection.getAccountInfo(mint);
    if (!info) throw new Error(`mint ${mint.toBase58()} not found`);
    return info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  }
}
