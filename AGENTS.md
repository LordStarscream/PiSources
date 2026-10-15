# Working on PiSources

- Keep delegation bounded. Use supervised worker contracts for implementation;
  only the controlling session stages or commits reviewed changes.
- Status questions are read-only and do not authorize continuation.
- Do not search outside the repository without an explicit supplied path.
- Preserve cancellation and budgets across checkpoints and compaction.
- Run `npm test` after modifying the guard/supervisor. Tests use Node built-ins,
  a mocked Pi event bus and actual short-lived OS processes; they do not use an LLM.
- Do not claim live Pi compatibility from mocked tests. Verify installation and
  cancellation on the user's Pi version before unattended use.
- Scope guards are not an OS sandbox. Approved project scripts are trusted code.

See [worker supervision](docs/worker-supervision.md) for installation and use.
