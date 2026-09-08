#!/usr/bin/env node
import { runCli } from "./cli.js";

try {
  const exitCode = await runCli();
  if (typeof exitCode === "number" && exitCode !== 0) process.exitCode = exitCode;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
