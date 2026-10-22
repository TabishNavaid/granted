// Runs the app against the local Supabase (supabase start) with the keys in .env.localdb, on port 3210.
// The founders' .env.local is never touched; values set here win over it.
import { spawn } from "node:child_process";
process.loadEnvFile(".env.localdb");
const port = process.env.PORT_LOCALDB ?? "3210";
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", port], { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
