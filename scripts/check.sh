#!/bin/sh
# Local quality gate: lint, typecheck and unit tests must all pass.
set -e
pnpm lint
pnpm typecheck
pnpm test
