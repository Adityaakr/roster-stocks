//! Security checklist for the lookthrough program, run on litesvm (hermetic, no RPC).
//! The end-to-end flow against the fork with the real AAPLx mint lives in tests/e2e (TypeScript).

use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, program_pack::Pack, system_instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    anchor_spl::{associated_token::{get_associated_token_address, spl_associated_token_account}, token::spl_token},
    litesvm::LiteSVM,
    lookthrough::{
        merkle::{leaf_hash, node_hash},
        state::{Action, ActionKind, ClaimReceipt, Registration, VoteChoice},
        CreateActionParams,
    },
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const USDC_DECIMALS: u8 = 6;
const SHARE: u64 = 1_000_000;
/// litesvm starts its Clock at this slot (probed on litesvm 0.16.0), so every slot in these tests is relative to it.
const BASE: u64 = 440_208_000;

struct Env {
    svm: LiteSVM,
    program_id: Pubkey,
    registrar: Keypair,
    mint: Pubkey,
    usdc: Pubkey,
    registrar_usdc: Pubkey,
}

fn send(svm: &mut LiteSVM, payer: &Keypair, signers: &[&Keypair], ixs: &[Instruction]) -> Result<(), String> {
    svm.expire_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    match svm.send_transaction(tx) {
        Ok(_) => Ok(()),
        Err(e) => Err(e.meta.logs.join("\n")),
    }
}

fn create_mint(svm: &mut LiteSVM, payer: &Keypair, decimals: u8, program: &Pubkey) -> Pubkey {
    let mint = Keypair::new();
    let rent = svm.minimum_balance_for_rent_exemption(spl_token::state::Mint::LEN);
    let ixs = [
        system_instruction::create_account(&payer.pubkey(), &mint.pubkey(), rent, spl_token::state::Mint::LEN as u64, program),
        spl_token::instruction::initialize_mint2(program, &mint.pubkey(), &payer.pubkey(), None, decimals).unwrap(),
    ];
    send(svm, payer, &[payer, &mint], &ixs).unwrap();
    mint.pubkey()
}

fn create_ata(svm: &mut LiteSVM, payer: &Keypair, owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    let ix = spl_associated_token_account::instruction::create_associated_token_account_idempotent(&payer.pubkey(), owner, mint, &spl_token::id());
    send(svm, payer, &[payer], &[ix]).unwrap();
    get_associated_token_address(owner, mint)
}

fn token_balance(svm: &LiteSVM, account: &Pubkey) -> u64 {
    let data = svm.get_account(account).unwrap().data;
    u64::from_le_bytes(data[64..72].try_into().unwrap())
}

fn setup() -> Env {
    let program_id = lookthrough::id();
    let mut svm = LiteSVM::default().with_builtins().with_lamports(1_000_000_000_000).with_sysvars().with_default_programs();
    let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/lookthrough.so"));
    svm.add_program(program_id, bytes).unwrap();
    let registrar = Keypair::new();
    svm.airdrop(&registrar.pubkey(), 100_000_000_000).unwrap();
    // The share mint stands in for AAPLx (SPL Token here; the fork e2e uses the real Token-2022 mint).
    let mint = create_mint(&mut svm, &registrar, 8, &spl_token::id());
    let usdc = create_mint(&mut svm, &registrar, USDC_DECIMALS, &spl_token::id());
    let registrar_usdc = create_ata(&mut svm, &registrar, &registrar.pubkey(), &usdc);
    let mint_to = spl_token::instruction::mint_to(&spl_token::id(), &usdc, &registrar_usdc, &registrar.pubkey(), &[], 1_000_000 * 1_000_000).unwrap();
    send(&mut svm, &registrar, &[&registrar], &[mint_to]).unwrap();
    Env { svm, program_id, registrar, mint, usdc, registrar_usdc }
}

fn registration_pda(program_id: &Pubkey, mint: &Pubkey, wallet: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"reg", mint.as_ref(), wallet.as_ref()], program_id).0
}
fn action_pda(program_id: &Pubkey, action_id: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(&[b"action", action_id.as_ref()], program_id).0
}
fn vault_pda(program_id: &Pubkey, action: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"vault", action.as_ref()], program_id).0
}
fn receipt_pda(program_id: &Pubkey, action: &Pubkey, wallet: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"claim", action.as_ref(), wallet.as_ref()], program_id).0
}

fn register(env: &mut Env, wallet: &Keypair) -> Result<(), String> {
    env.svm.airdrop(&wallet.pubkey(), 10_000_000_000).unwrap();
    let ix = Instruction::new_with_bytes(
        env.program_id,
        &lookthrough::instruction::Register {}.data(),
        lookthrough::accounts::Register {
            wallet: wallet.pubkey(),
            mint: env.mint,
            registration: registration_pda(&env.program_id, &env.mint, &wallet.pubkey()),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, wallet, &[wallet], &[ix])
}

/// Build the tree the TS side would build: sorted by wallet bytes, sorted-pair nodes, odd promoted.
struct Tree {
    root: [u8; 32],
    leaves: Vec<(Pubkey, u64, [u8; 32])>,
    levels: Vec<Vec<[u8; 32]>>,
}
fn build_tree(action_id: &[u8; 32], mint: &Pubkey, slot: u64, entries: &[(Pubkey, u64)]) -> Tree {
    let mut sorted: Vec<(Pubkey, u64)> = entries.iter().copied().filter(|e| e.1 > 0).collect();
    sorted.sort_by(|a, b| a.0.to_bytes().cmp(&b.0.to_bytes()));
    let leaves: Vec<(Pubkey, u64, [u8; 32])> = sorted.iter().map(|(w, e)| (*w, *e, leaf_hash(action_id, w, mint, slot, *e))).collect();
    let mut levels = vec![leaves.iter().map(|l| l.2).collect::<Vec<_>>()];
    while levels.last().unwrap().len() > 1 {
        let prev = levels.last().unwrap().clone();
        let next: Vec<[u8; 32]> = prev.chunks(2).map(|c| if c.len() == 2 { node_hash(&c[0], &c[1]) } else { c[0] }).collect();
        levels.push(next);
    }
    Tree { root: levels.last().unwrap()[0], leaves, levels }
}
impl Tree {
    fn proof(&self, wallet: &Pubkey) -> (u64, Vec<[u8; 32]>) {
        let mut i = self.leaves.iter().position(|l| &l.0 == wallet).unwrap();
        let entitlement = self.leaves[i].1;
        let mut proof = vec![];
        for level in &self.levels[..self.levels.len() - 1] {
            let sib = if i % 2 == 0 { level.get(i + 1) } else { level.get(i - 1) };
            if let Some(s) = sib {
                proof.push(*s);
            }
            i /= 2;
        }
        (entitlement, proof)
    }
}

struct Created {
    action: Pubkey,
    vault: Pubkey,
}
fn create_action(env: &mut Env, params: CreateActionParams) -> Result<Created, String> {
    let action = action_pda(&env.program_id, &params.action_id);
    let vault = vault_pda(&env.program_id, &action);
    let ix = Instruction::new_with_bytes(
        env.program_id,
        &lookthrough::instruction::CreateAction { params }.data(),
        lookthrough::accounts::CreateAction {
            authority: env.registrar.pubkey(),
            mint: env.mint,
            usdc_mint: env.usdc,
            action,
            vault,
            token_program: spl_token::id(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    let registrar = env.registrar.insecure_clone();
    send(&mut env.svm, &registrar, &[&registrar], &[ix])?;
    Ok(Created { action, vault })
}

fn fund(env: &mut Env, c: &Created, amount: u64) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        env.program_id,
        &lookthrough::instruction::FundDistribution { amount }.data(),
        lookthrough::accounts::FundDistribution {
            authority: env.registrar.pubkey(),
            action: c.action,
            vault: c.vault,
            funder_token_account: env.registrar_usdc,
            usdc_mint: env.usdc,
            token_program: spl_token::id(),
        }
        .to_account_metas(None),
    );
    let registrar = env.registrar.insecure_clone();
    send(&mut env.svm, &registrar, &[&registrar], &[ix])
}

fn claim(env: &mut Env, c: &Created, wallet: &Keypair, entitlement: u64, proof: Vec<[u8; 32]>) -> Result<(), String> {
    let wallet_usdc = create_ata(&mut env.svm, wallet, &wallet.pubkey(), &env.usdc);
    let ix = Instruction::new_with_bytes(
        env.program_id,
        &lookthrough::instruction::Claim { entitlement, proof }.data(),
        lookthrough::accounts::Claim {
            wallet: wallet.pubkey(),
            mint: env.mint,
            registration: registration_pda(&env.program_id, &env.mint, &wallet.pubkey()),
            action: c.action,
            receipt: receipt_pda(&env.program_id, &c.action, &wallet.pubkey()),
            vault: c.vault,
            wallet_token_account: wallet_usdc,
            usdc_mint: env.usdc,
            token_program: spl_token::id(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, wallet, &[wallet], &[ix])
}

fn vote(env: &mut Env, c: &Created, wallet: &Keypair, entitlement: u64, proof: Vec<[u8; 32]>, choice: VoteChoice) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        env.program_id,
        &lookthrough::instruction::CastVote { entitlement, proof, choice }.data(),
        lookthrough::accounts::CastVote {
            wallet: wallet.pubkey(),
            mint: env.mint,
            registration: registration_pda(&env.program_id, &env.mint, &wallet.pubkey()),
            action: c.action,
            receipt: receipt_pda(&env.program_id, &c.action, &wallet.pubkey()),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, wallet, &[wallet], &[ix])
}

fn close(env: &mut Env, c: &Created) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        env.program_id,
        &lookthrough::instruction::CloseAction {}.data(),
        lookthrough::accounts::CloseAction {
            authority: env.registrar.pubkey(),
            action: c.action,
            vault: c.vault,
            authority_token_account: env.registrar_usdc,
            usdc_mint: env.usdc,
            token_program: spl_token::id(),
        }
        .to_account_metas(None),
    );
    let registrar = env.registrar.insecure_clone();
    send(&mut env.svm, &registrar, &[&registrar], &[ix])
}

fn read<T: AccountDeserialize>(env: &Env, key: &Pubkey) -> T {
    let data = env.svm.get_account(key).unwrap().data;
    T::try_deserialize(&mut &data[..]).unwrap()
}

fn distribution_params(action_id: [u8; 32], snapshot_slot: u64, root: [u8; 32], total: u64, per_share: u64, close_slot: u64) -> CreateActionParams {
    CreateActionParams {
        action_id,
        kind: ActionKind::Distribution,
        snapshot_slot,
        root,
        content_hash: [7u8; 32],
        metadata_uri: "https://example.invalid/actions/test/entitlements.json".to_string(),
        total_entitlement: total,
        amount_per_share_micro: per_share,
        claims_close_slot: close_slot,
        question_hash: [0u8; 32],
        deadline_slot: 0,
    }
}

#[test]
fn register_records_the_slot() {
    let mut env = setup();
    env.svm.warp_to_slot(BASE + 50);
    let alice = Keypair::new();
    register(&mut env, &alice).unwrap();
    let reg: Registration = read(&env, &registration_pda(&env.program_id, &env.mint, &alice.pubkey()));
    assert_eq!(reg.wallet, alice.pubkey());
    assert_eq!(reg.mint, env.mint);
    assert_eq!(reg.registered_at_slot, BASE + 50);
    // registering twice fails (PDA already initialised)
    assert!(register(&mut env, &alice).is_err());
}

#[test]
fn distribution_happy_path_double_claim_bad_proof_unregistered_and_late_registration() {
    let mut env = setup();
    let (alice, bob, carol, dave, eve) = (Keypair::new(), Keypair::new(), Keypair::new(), Keypair::new(), Keypair::new());
    for w in [&alice, &bob, &carol] {
        register(&mut env, w).unwrap();
    }
    env.svm.airdrop(&dave.pubkey(), 10_000_000_000).unwrap();
    env.svm.warp_to_slot(BASE + 100);
    let snapshot_slot = BASE + 100;
    let action_id = [1u8; 32];
    // Alice 100 shares, Bob 50, Carol 50, Eve 10 (in the tree but never registered: cannot claim).
    let entries = [(alice.pubkey(), 100 * SHARE), (bob.pubkey(), 50 * SHARE), (carol.pubkey(), 50 * SHARE), (eve.pubkey(), 10 * SHARE)];
    let tree = build_tree(&action_id, &env.mint, snapshot_slot, &entries);
    let total: u64 = entries.iter().map(|e| e.1).sum();
    let per_share = 250_000; // 0.25 USDC per share
    let c = create_action(&mut env, distribution_params(action_id, snapshot_slot, tree.root, total, per_share, BASE + 1_000)).unwrap();
    let a: Action = read(&env, &c.action);
    assert_eq!(a.root, tree.root);
    assert!(!a.funded);

    // Underfunded: 1 USDC is not enough for 210 shares at 0.25.
    fund(&mut env, &c, 1_000_000).unwrap();
    let (ent, proof) = tree.proof(&alice.pubkey());
    let err = claim(&mut env, &c, &alice, ent, proof.clone()).unwrap_err();
    assert!(err.contains("Underfunded"), "{err}");
    // Top up to the required total (idempotent: vault balance is what matters).
    fund(&mut env, &c, 52_500_000 - 1_000_000).unwrap();
    let a: Action = read(&env, &c.action);
    assert!(a.funded);

    // Happy path: Alice claims 25.00 USDC.
    env.svm.warp_to_slot(BASE + 120);
    claim(&mut env, &c, &alice, ent, proof.clone()).unwrap();
    let alice_usdc = get_associated_token_address(&alice.pubkey(), &env.usdc);
    assert_eq!(token_balance(&env.svm, &alice_usdc), 25_000_000);
    let r: ClaimReceipt = read(&env, &receipt_pda(&env.program_id, &c.action, &alice.pubkey()));
    assert_eq!(r.amount_paid, 25_000_000);
    assert_eq!(r.entitlement, 100 * SHARE);
    let a: Action = read(&env, &c.action);
    assert_eq!(a.claimed_total, 25_000_000);

    // Double claim rejected (receipt PDA exists).
    let err = claim(&mut env, &c, &alice, ent, proof.clone()).unwrap_err();
    assert!(err.contains("already in use") || err.contains("AlreadyClaimed") || err.contains("0x0"), "{err}");
    assert_eq!(token_balance(&env.svm, &alice_usdc), 25_000_000);

    // Bad proof rejected: Bob presents Alice's proof, and a wrong entitlement with his own proof.
    let (bob_ent, bob_proof) = tree.proof(&bob.pubkey());
    let err = claim(&mut env, &c, &bob, bob_ent, proof).unwrap_err();
    assert!(err.contains("InvalidProof"), "{err}");
    let err = claim(&mut env, &c, &bob, bob_ent + 1, bob_proof.clone()).unwrap_err();
    assert!(err.contains("InvalidProof"), "{err}");
    claim(&mut env, &c, &bob, bob_ent, bob_proof).unwrap();

    // Unregistered wallet rejected even with a valid leaf (Eve has no Registration PDA).
    env.svm.airdrop(&eve.pubkey(), 10_000_000_000).unwrap();
    let (eve_ent, eve_proof) = tree.proof(&eve.pubkey());
    let err = claim(&mut env, &c, &eve, eve_ent, eve_proof).unwrap_err();
    assert!(err.contains("AccountNotInitialized") || err.contains("NotRegistered"), "{err}");

    // Registered after the snapshot slot: Dave registers at slot 120 for a snapshot at 100; give him a leaf in a new action.
    register(&mut env, &dave).unwrap();
    let action_id2 = [2u8; 32];
    let entries2 = [(dave.pubkey(), 10 * SHARE), (carol.pubkey(), 50 * SHARE)];
    let tree2 = build_tree(&action_id2, &env.mint, snapshot_slot, &entries2);
    let c2 = create_action(&mut env, distribution_params(action_id2, snapshot_slot, tree2.root, 60 * SHARE, per_share, BASE + 1_000)).unwrap();
    fund(&mut env, &c2, 15_000_000).unwrap();
    let (dave_ent, dave_proof) = tree2.proof(&dave.pubkey());
    let err = claim(&mut env, &c2, &dave, dave_ent, dave_proof).unwrap_err();
    assert!(err.contains("RegisteredAfterSnapshot"), "{err}");
    let (carol_ent, carol_proof) = tree2.proof(&carol.pubkey());
    claim(&mut env, &c2, &carol, carol_ent, carol_proof).unwrap();

    // Claims close: after the close slot the claim fails, and close_action returns the residual.
    let err = close(&mut env, &c).unwrap_err();
    assert!(err.contains("ActionStillOpen"), "{err}");
    env.svm.warp_to_slot(BASE + 1_000);
    let (carol_ent, carol_proof) = tree.proof(&carol.pubkey());
    let err = claim(&mut env, &c, &carol, carol_ent, carol_proof).unwrap_err();
    assert!(err.contains("ClaimsClosed"), "{err}");
    let before = token_balance(&env.svm, &env.registrar_usdc);
    close(&mut env, &c).unwrap();
    // vault held 52.5 USDC, Alice took 25, Bob 12.5, so 15 USDC come back
    assert_eq!(token_balance(&env.svm, &env.registrar_usdc), before + 15_000_000);
    assert!(env.svm.get_account(&c.vault).map(|a| a.data.is_empty()).unwrap_or(true));
    let a: Action = read(&env, &c.action);
    assert!(a.closed);
}

#[test]
fn vote_happy_path_and_deadline() {
    let mut env = setup();
    let (alice, bob, carol) = (Keypair::new(), Keypair::new(), Keypair::new());
    for w in [&alice, &bob, &carol] {
        register(&mut env, w).unwrap();
    }
    env.svm.warp_to_slot(BASE + 100);
    let action_id = [3u8; 32];
    let entries = [(alice.pubkey(), 100 * SHARE), (bob.pubkey(), 50 * SHARE), (carol.pubkey(), 50 * SHARE)];
    let tree = build_tree(&action_id, &env.mint, BASE + 100, &entries);
    let params = CreateActionParams {
        action_id,
        kind: ActionKind::Vote,
        snapshot_slot: BASE + 100,
        root: tree.root,
        content_hash: [9u8; 32],
        metadata_uri: "ipfs://vote".to_string(),
        total_entitlement: 200 * SHARE,
        amount_per_share_micro: 0,
        claims_close_slot: 0,
        question_hash: [4u8; 32],
        deadline_slot: BASE + 500,
    };
    let c = create_action(&mut env, params).unwrap();
    let (ent, proof) = tree.proof(&alice.pubkey());
    vote(&mut env, &c, &alice, ent, proof.clone(), VoteChoice::For).unwrap();
    let (bent, bproof) = tree.proof(&bob.pubkey());
    vote(&mut env, &c, &bob, bent, bproof, VoteChoice::Against).unwrap();
    // double vote rejected
    let err = vote(&mut env, &c, &alice, ent, proof, VoteChoice::Against).unwrap_err();
    assert!(err.contains("already in use") || err.contains("0x0"), "{err}");
    let a: Action = read(&env, &c.action);
    assert_eq!((a.for_weight, a.against_weight, a.abstain_weight, a.voters), (100 * SHARE, 50 * SHARE, 0, 2));
    // claim on a vote action is the wrong kind
    let (cent, cproof) = tree.proof(&carol.pubkey());
    let err = claim(&mut env, &c, &carol, cent, cproof.clone()).unwrap_err();
    assert!(err.contains("WrongActionKind"), "{err}");
    // after the deadline the vote is closed
    env.svm.warp_to_slot(BASE + 500);
    let err = vote(&mut env, &c, &carol, cent, cproof, VoteChoice::Abstain).unwrap_err();
    assert!(err.contains("VoteClosed"), "{err}");
    close(&mut env, &c).unwrap();
}

#[test]
fn arithmetic_at_max_entitlement_and_zero_entitlement() {
    let mut env = setup();
    let alice = Keypair::new();
    register(&mut env, &alice).unwrap();
    env.svm.warp_to_slot(BASE + 10);
    // total u64::MAX at 2 USDC per share overflows the required amount: funding must fail with Overflow, never wrap.
    let action_id = [5u8; 32];
    let tree = build_tree(&action_id, &env.mint, BASE + 10, &[(alice.pubkey(), u64::MAX)]);
    let c = create_action(&mut env, distribution_params(action_id, BASE + 10, tree.root, u64::MAX, 2_000_000, BASE + 1_000)).unwrap();
    let err = fund(&mut env, &c, 1).unwrap_err();
    assert!(err.contains("Overflow"), "{err}");
    // at 1 micro-USDC per share, the payout for u64::MAX shares fits in u64 (u128 intermediate); funding is impossible, so it stays unfunded.
    let action_id = [6u8; 32];
    let tree = build_tree(&action_id, &env.mint, BASE + 10, &[(alice.pubkey(), u64::MAX)]);
    let c = create_action(&mut env, distribution_params(action_id, BASE + 10, tree.root, u64::MAX, 1, BASE + 1_000)).unwrap();
    fund(&mut env, &c, 1_000_000).unwrap();
    let a: Action = read(&env, &c.action);
    assert!(!a.funded);
    assert_eq!(a.payout_for(u64::MAX), Some(u64::MAX / 1_000_000));
    // zero entitlement is rejected before any proof work
    let action_id = [8u8; 32];
    let tree = build_tree(&action_id, &env.mint, BASE + 10, &[(alice.pubkey(), 1)]);
    let c = create_action(&mut env, distribution_params(action_id, BASE + 10, tree.root, 1, 1_000_000, BASE + 1_000)).unwrap();
    fund(&mut env, &c, 1_000_000).unwrap();
    let err = claim(&mut env, &c, &alice, 0, vec![]).unwrap_err();
    assert!(err.contains("ZeroEntitlement"), "{err}");
    // proof longer than 32 nodes is rejected
    let err = claim(&mut env, &c, &alice, 1, vec![[0u8; 32]; 33]).unwrap_err();
    assert!(err.contains("ProofTooLong"), "{err}");
}
