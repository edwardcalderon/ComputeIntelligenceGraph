#!/usr/bin/env node
/**
 * Checks that the required dev ports are free.
 * Exits with code 1 and a clear message if any port is already in use.
 *
 * Usage:
 *   node scripts/check-ports.js 3000 3001
 *   node scripts/check-ports.js 3000          (single port)
 */

const net  = require("net");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: check-ports.js <port> [port...]");
  process.exit(1);
}

const ports = args.map(Number).filter((n) => n > 0 && n < 65536);

if (ports.length !== args.length) {
  console.error("All arguments must be valid port numbers (1–65535).");
  process.exit(1);
}

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve({ port, free: false });
      } else {
        resolve({ port, free: true }); // unexpected error — let the app surface it
      }
    });

    server.once("listening", () => {
      server.close(() => resolve({ port, free: true }));
    });

    server.listen(port, "0.0.0.0");
  });
}

(async () => {
  const results = await Promise.all(ports.map(checkPort));
  const blocked = results.filter((r) => !r.free);

  if (blocked.length === 0) {
    const list = ports.map((p) => `\x1b[32m:${p}\x1b[0m`).join("  ");
    console.log(`✓ Ports free: ${list}`);
    process.exit(0);
  }

  console.error("\n\x1b[31m✗ The following ports are already in use:\x1b[0m\n");
  for (const { port } of blocked) {
    console.error(
      `  \x1b[31m:${port}\x1b[0m  →  run \x1b[33mlsof -ti :${port} | xargs kill -9\x1b[0m to free it`
    );
  }
  console.error(
    "\nStop the conflicting process(es) and try again.\n"
  );
  process.exit(1);
})();
