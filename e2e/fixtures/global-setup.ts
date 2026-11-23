import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const COMPOSE = fileURLToPath(new URL('../../infra/docker-compose.e2e.yml', import.meta.url));

/** Builds and starts the production-like stack unless an external base URL is given. */
export default async function globalSetup() {
  if (process.env.E2E_BASE_URL) return;
  const build = process.env.E2E_NO_BUILD ? '' : '--build';
  execSync(`docker compose -f "${COMPOSE}" up -d ${build} --wait`, { stdio: 'inherit' });
}
