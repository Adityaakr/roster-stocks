/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/lookthrough.json`.
 */
export type Lookthrough = {
  "address": "HVB7th73BLUF6kdHWcWkvNW3kGiVPHusfT97iQ5UnA4S",
  "metadata": {
    "name": "lookthrough",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Lookthrough: registry, record-date proofs, claim and vote router for tokenized stocks"
  },
  "instructions": [
    {
      "name": "castVote",
      "docs": [
        "Cast a weighted vote with a Merkle proof, before the deadline slot."
      ],
      "discriminator": [
        20,
        212,
        15,
        189,
        69,
        180,
        69,
        151
      ],
      "accounts": [
        {
          "name": "wallet",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "relations": [
            "action"
          ]
        },
        {
          "name": "registration",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "wallet"
              }
            ]
          }
        },
        {
          "name": "action",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "action.actionId",
                "account": "action"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  108,
                  97,
                  105,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "action"
              },
              {
                "kind": "account",
                "path": "wallet"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "entitlement",
          "type": "u64"
        },
        {
          "name": "proof",
          "type": {
            "vec": {
              "array": [
                "u8",
                32
              ]
            }
          }
        },
        {
          "name": "choice",
          "type": {
            "defined": {
              "name": "voteChoice"
            }
          }
        }
      ]
    },
    {
      "name": "claim",
      "docs": [
        "Claim a distribution with a Merkle proof. Pays entitlement × amount_per_share_micro / 1e6 USDC."
      ],
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "wallet",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint",
          "relations": [
            "action"
          ]
        },
        {
          "name": "registration",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "wallet"
              }
            ]
          }
        },
        {
          "name": "action",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "action.actionId",
                "account": "action"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  108,
                  97,
                  105,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "action"
              },
              {
                "kind": "account",
                "path": "wallet"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "action"
          ]
        },
        {
          "name": "walletTokenAccount",
          "writable": true
        },
        {
          "name": "usdcMint",
          "relations": [
            "action"
          ]
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "entitlement",
          "type": "u64"
        },
        {
          "name": "proof",
          "type": {
            "vec": {
              "array": [
                "u8",
                32
              ]
            }
          }
        }
      ]
    },
    {
      "name": "closeAction",
      "docs": [
        "After the window, return residual USDC to the authority and close the vault."
      ],
      "discriminator": [
        68,
        91,
        38,
        183,
        124,
        74,
        239,
        136
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "action"
          ]
        },
        {
          "name": "action",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "action.actionId",
                "account": "action"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "action"
          ]
        },
        {
          "name": "authorityTokenAccount",
          "writable": true
        },
        {
          "name": "usdcMint",
          "relations": [
            "action"
          ]
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "createAction",
      "docs": [
        "Publish an action: root, content hash and parameters. Authority only (the registrar)."
      ],
      "discriminator": [
        125,
        159,
        123,
        141,
        6,
        144,
        175,
        4
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "usdcMint",
          "docs": [
            "The payout mint (USDC in the demo). Votes get an unused vault for uniformity."
          ]
        },
        {
          "name": "action",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "params.actionId"
              }
            ]
          }
        },
        {
          "name": "vault",
          "docs": [
            "Vault owned by the action PDA. Token-2022 or SPL Token, whichever owns `usdc_mint`."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "action"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "createActionParams"
            }
          }
        }
      ]
    },
    {
      "name": "fundDistribution",
      "docs": [
        "Move USDC into the action vault. Claims open once the vault covers the total entitlement."
      ],
      "discriminator": [
        28,
        106,
        182,
        72,
        106,
        5,
        66,
        163
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "action"
          ]
        },
        {
          "name": "action",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "relations": [
            "action"
          ]
        },
        {
          "name": "funderTokenAccount",
          "writable": true
        },
        {
          "name": "usdcMint",
          "relations": [
            "action"
          ]
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "register",
      "docs": [
        "Register the signing wallet for corporate actions on `mint`. One signature, no authority."
      ],
      "discriminator": [
        211,
        124,
        67,
        15,
        211,
        194,
        178,
        240
      ],
      "accounts": [
        {
          "name": "wallet",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "registration",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "wallet"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "action",
      "discriminator": [
        144,
        241,
        105,
        219,
        74,
        136,
        203,
        176
      ]
    },
    {
      "name": "claimReceipt",
      "discriminator": [
        223,
        233,
        11,
        229,
        124,
        165,
        207,
        28
      ]
    },
    {
      "name": "registration",
      "discriminator": [
        158,
        129,
        230,
        90,
        93,
        95,
        101,
        55
      ]
    }
  ],
  "events": [
    {
      "name": "actionClosed",
      "discriminator": [
        12,
        207,
        175,
        173,
        7,
        142,
        107,
        78
      ]
    },
    {
      "name": "actionCreated",
      "discriminator": [
        224,
        166,
        37,
        66,
        93,
        1,
        115,
        234
      ]
    },
    {
      "name": "claimed",
      "discriminator": [
        217,
        192,
        123,
        72,
        108,
        150,
        248,
        33
      ]
    },
    {
      "name": "funded",
      "discriminator": [
        67,
        84,
        56,
        88,
        192,
        12,
        201,
        177
      ]
    },
    {
      "name": "registered",
      "discriminator": [
        11,
        222,
        10,
        72,
        160,
        110,
        165,
        227
      ]
    },
    {
      "name": "voteCast",
      "discriminator": [
        39,
        53,
        195,
        104,
        188,
        17,
        225,
        213
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notRegistered",
      "msg": "Wallet is not registered for this mint at the snapshot slot"
    },
    {
      "code": 6001,
      "name": "invalidProof",
      "msg": "Merkle proof does not match the published root"
    },
    {
      "code": 6002,
      "name": "alreadyClaimed",
      "msg": "This wallet has already claimed or voted on this action"
    },
    {
      "code": 6003,
      "name": "voteClosed",
      "msg": "Voting closed at the deadline slot"
    },
    {
      "code": 6004,
      "name": "underfunded",
      "msg": "Distribution vault does not cover the total entitlement"
    },
    {
      "code": 6005,
      "name": "proofTooLong",
      "msg": "Proof has more than 32 nodes"
    },
    {
      "code": 6006,
      "name": "wrongActionKind",
      "msg": "Action kind does not allow this instruction"
    },
    {
      "code": 6007,
      "name": "zeroEntitlement",
      "msg": "Entitlement must be greater than zero"
    },
    {
      "code": 6008,
      "name": "claimsClosed",
      "msg": "Claims closed at the claims close slot"
    },
    {
      "code": 6009,
      "name": "actionStillOpen",
      "msg": "Action is still open"
    },
    {
      "code": 6010,
      "name": "actionClosed",
      "msg": "Action is closed"
    },
    {
      "code": 6011,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6012,
      "name": "metadataTooLong",
      "msg": "Metadata URI is longer than 200 bytes"
    },
    {
      "code": 6013,
      "name": "registeredAfterSnapshot",
      "msg": "Registered after the snapshot slot"
    }
  ],
  "types": [
    {
      "name": "action",
      "docs": [
        "A published corporate action: the Merkle root over registered holders' entitlements at a snapshot slot.",
        "Seeds: [\"action\", action_id]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "actionId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "actionKind"
              }
            }
          },
          {
            "name": "snapshotSlot",
            "type": "u64"
          },
          {
            "name": "root",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "metadataUri",
            "type": "string"
          },
          {
            "name": "totalEntitlement",
            "docs": [
              "Sum of all entitlements in the tree, in 6-decimal share units."
            ],
            "type": "u64"
          },
          {
            "name": "createdAtSlot",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "closed",
            "type": "bool"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "amountPerShareMicro",
            "docs": [
              "USDC micro-units paid per 1e6 share units."
            ],
            "type": "u64"
          },
          {
            "name": "claimedTotal",
            "type": "u64"
          },
          {
            "name": "claimsCloseSlot",
            "type": "u64"
          },
          {
            "name": "funded",
            "type": "bool"
          },
          {
            "name": "questionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "deadlineSlot",
            "type": "u64"
          },
          {
            "name": "forWeight",
            "type": "u64"
          },
          {
            "name": "againstWeight",
            "type": "u64"
          },
          {
            "name": "abstainWeight",
            "type": "u64"
          },
          {
            "name": "voters",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "actionClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "action",
            "type": "pubkey"
          },
          {
            "name": "residualReturned",
            "type": "u64"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "actionCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "action",
            "type": "pubkey"
          },
          {
            "name": "actionId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "actionKind"
              }
            }
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "snapshotSlot",
            "type": "u64"
          },
          {
            "name": "root",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "totalEntitlement",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "actionKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "distribution"
          },
          {
            "name": "vote"
          }
        ]
      }
    },
    {
      "name": "claimReceipt",
      "docs": [
        "One receipt per (action, wallet): blocks double claims and double votes. Seeds: [\"claim\", action, wallet]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "action",
            "type": "pubkey"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "entitlement",
            "type": "u64"
          },
          {
            "name": "amountPaid",
            "type": "u64"
          },
          {
            "name": "choice",
            "type": {
              "option": {
                "defined": {
                  "name": "voteChoice"
                }
              }
            }
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "claimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "action",
            "type": "pubkey"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "entitlement",
            "type": "u64"
          },
          {
            "name": "amountPaid",
            "type": "u64"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "createActionParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "actionId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "actionKind"
              }
            }
          },
          {
            "name": "snapshotSlot",
            "type": "u64"
          },
          {
            "name": "root",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "metadataUri",
            "type": "string"
          },
          {
            "name": "totalEntitlement",
            "type": "u64"
          },
          {
            "name": "amountPerShareMicro",
            "docs": [
              "Distribution: USDC micro-units per 1e6 share units. Ignored for votes."
            ],
            "type": "u64"
          },
          {
            "name": "claimsCloseSlot",
            "docs": [
              "Distribution: last slot at which claims are accepted. Ignored for votes."
            ],
            "type": "u64"
          },
          {
            "name": "questionHash",
            "docs": [
              "Vote: keccak256 of the question text. Ignored for distributions."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "deadlineSlot",
            "docs": [
              "Vote: last slot at which votes are accepted. Ignored for distributions."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "funded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "action",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "vaultBalance",
            "type": "u64"
          },
          {
            "name": "required",
            "type": "u64"
          },
          {
            "name": "funded",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "registered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "registration",
      "docs": [
        "A wallet's one-time opt-in for corporate actions on a mint. Seeds: [\"reg\", mint, wallet]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "registeredAtSlot",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "voteCast",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "action",
            "type": "pubkey"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "entitlement",
            "type": "u64"
          },
          {
            "name": "choice",
            "type": {
              "defined": {
                "name": "voteChoice"
              }
            }
          },
          {
            "name": "forWeight",
            "type": "u64"
          },
          {
            "name": "againstWeight",
            "type": "u64"
          },
          {
            "name": "abstainWeight",
            "type": "u64"
          },
          {
            "name": "voters",
            "type": "u32"
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "voteChoice",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "for"
          },
          {
            "name": "against"
          },
          {
            "name": "abstain"
          }
        ]
      }
    }
  ]
};
