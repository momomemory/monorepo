#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0];

function printHelp(): void {
  console.log(`opencode-momo v0.1.0

OpenCode plugin that gives coding agents persistent memory using Momo.

USAGE:
  opencode-momo <command> [options]

COMMANDS:
  install       Install and configure the plugin for the current project
  configure     Update plugin configuration
  help          Show this help message

OPTIONS:
  -h, --help    Show this help message
`);
}

if (!command || command === "help" || command === "-h" || command === "--help") {
  printHelp();
  process.exit(0);
}

if (command === "install") {
  console.log("install command not yet implemented");
  process.exit(1);
}

if (command === "configure") {
  console.log("configure command not yet implemented");
  process.exit(1);
}

console.error(`Unknown command: ${command}`);
console.error('Run "opencode-momo --help" for usage.');
process.exit(1);
