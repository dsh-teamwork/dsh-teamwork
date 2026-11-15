// Publish a complete host result before the polling parent can observe it.
import { rename, rm, writeFile } from 'node:fs/promises';
export async function reportResult(result) {
  const path = process.env.TEAMWORK_TEST_RESULT;
  if (!path) throw new Error('TEAMWORK_TEST_RESULT is required');
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(result), { mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
