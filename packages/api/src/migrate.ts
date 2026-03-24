import { applyMigrations } from './db/migrate.js';

async function main(): Promise<void> {
  const result = await applyMigrations();

  if (result.applied.length === 0) {
    console.log('No new migrations to apply.');
  } else {
    console.log(`Applied migrations: ${result.applied.join(', ')}`);
  }

  if (result.skipped.length > 0) {
    console.log(`Already applied: ${result.skipped.join(', ')}`);
  }
}

main().catch((error) => {
  console.error(
    'Migration failed:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
