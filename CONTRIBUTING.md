# Branch flow

- `main` is production. Only release merges from `develop` land here.
- `develop` is the testing build. Every feature merges here first.
- One branch per function, cut from `develop`: `feat/<name>` (e.g. `feat/domain-logic`, `feat/figure`, `feat/scan`).
- Open a PR into `develop`; CI (typecheck, lint, build) must pass; merge.
- To release: PR `develop` into `main`. CI builds the production artifact.
