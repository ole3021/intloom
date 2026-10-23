# Access

Access adapts SDK capabilities to narrow live ports. It has no Runtime dependency and never owns or caches business State. `CallScope` provides identity, signal, authority checks and tracked capability uses; Runtime retains the right to revoke it.

`code.ts` constructs the actual Code and Agent Tool objects. Agent Tools have no Storage commit or Interaction method. Each Tool has its own shorter child lifetime. Model cancellation explicitly narrows the live binding; the common Agent guard preserves it. A copied capability shape without a binding is rejected, never downgraded to signal-only protection. `tracked-use.ts` checks admission synchronously, accounts for pending async uses, rechecks authority before delivery, and always releases the use. State adapters recheck before publishing an async validation result.

`project/access.ts` implements project-contained file and subprocess operations. Storage is injected, and successful commits are reported before checking whether the caller still owns its result. Revoking Access prevents future use but cannot undo a started external operation.
