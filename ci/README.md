# CI: what gates a merge and a publish

`pipeline.yml` runs `ci.yml` (ESLint, Typecheck, Test) and the tenant DB-context guard on
every pull request and push to `develop`, `main` and `release/**`. `publish` needs all of
them. Owner of this folder and of both baselines below: **Danilo**, reviewed at every
release cut.

## ESLint baseline (`eslint-suppressions.json`)

The repository's own `eslint.config.mjs` has never run in CI. On 2026-11-13, against
`develop` 4a8c627, it reported **4,380 errors** in 269 of 612 files (715 file + rule pairs)
and 523 warnings. The errors were frozen with ESLint's bulk suppressions:

```
npx eslint "{src,apps,libs,test}/**/*.ts" --suppress-all
```

| Rule | Suppressed |
|---|---|
| `@typescript-eslint/no-unsafe-member-access` | 1,698 |
| `@typescript-eslint/no-unsafe-assignment` | 1,132 |
| `prettier/prettier` | 896 |
| `@typescript-eslint/no-unsafe-call` | 170 |
| `@typescript-eslint/no-unsafe-return` | 108 |
| `@typescript-eslint/require-await` | 105 |
| `@typescript-eslint/no-unused-vars` | 66 |
| `no-case-declarations` | 47 |
| `@typescript-eslint/no-unsafe-enum-comparison` | 38 |
| `@typescript-eslint/unbound-method` | 36 |
| `@typescript-eslint/no-unnecessary-type-assertion` | 29 |
| 11 other rules | 55 |

How it behaves:
- Any error in a file or rule outside the baseline fails `ci / ESLint`.
- The baseline counts per file and rule: one more error of a rule a file already breaks
  fails too, unless one of the same rule was fixed in the same file in the same change.
- Fixing a suppressed error without shrinking the file fails with "unused suppressions":
  run `npx eslint "{src,apps,libs,test}/**/*.ts" --prune-suppressions` and commit the result.
- Warnings (the rules `eslint.config.mjs` sets to `warn`) are printed and do not fail.
- Never regenerate with `--suppress-all` to make a red PR green; that hides the new error.
  Regenerate only on purpose, with the date and the numbers updated here.

## Test exceptions (`test-exceptions.txt`)

`ci / Test` starts Postgres, Redis, ClickHouse, Kafka and RabbitMQ, turns on every
integration flag, runs the migrations on a clean database and runs both jest configs
(`src/**/*.spec.ts` and `test/*.e2e-spec.ts`). `check-test-results.mjs` then reads the two
reports and fails the job on any failure or skip that is not in `test-exceptions.txt` with
the outcome its class requires.

| Test | Class | Why | Owner |
|---|---|---|---|
| `test/events.e2e-spec.ts` › accepts canonical event with success envelope (AC5) | known-failure | the test sends `contact.created` without the `properties.id` and `properties.source` the event schema requires since 2026-05-26, so it gets 400; the 400 body hides the missing field. A card tracks both | Danilo |
| `test/app.e2e-spec.ts` (whole file) | known-failure | does not load (`nanoid` is ESM, `test/jest-e2e.json` does not transform it); scaffold test expecting "Hello World!" | Danilo |
| `test/tenant-isolation.e2e-spec.ts` (whole file) | not-runnable-here | needs the enterprise RLS migration, which is not in this repository | Danilo |
| `journey-execution.coverage.spec.ts` › palette node parity | not-runnable-here | reads a manifest from the frontend repository, which CI does not check out | Danilo |
| `broker.contract.spec.ts` › kafka reconnects after a broker restart | non-blocking | restarts the broker mid-test; `broker-contract.yml` runs it apart, non-blocking | Danilo |
| `broker.contract.spec.ts` › rabbitmq reconnects after a broker restart | non-blocking | same | Danilo |

An exception is not a passing test: the job summary prints the passed count and each
class apart. A known failure that starts passing, a skipped test that starts running, a
line whose file is gone or that matches nothing, all fail the job until the line is deleted.
