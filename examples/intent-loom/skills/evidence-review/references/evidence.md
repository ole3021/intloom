# Evidence rules

- Attribute each conclusion to its criterion, candidate digest and validation receipts.
- A receipt with a missing exit code is incomplete evidence, including timeouts and command-launch errors.
- A nonzero exit code contradicts a passing conclusion. A zero exit code only supports assertions actually exercised by that check.
- Keep the model's opinion separate from the program's final assessment. Protected-file hashes establish byte equality, not functional correctness.
