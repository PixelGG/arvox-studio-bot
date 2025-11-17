import fs from 'node:fs';
import path from 'node:path';
import type { SlashCommand } from '../types/commands';

export async function loadSlashCommands(): Promise<SlashCommand[]> {
  const commands: SlashCommand[] = [];
  const commandsPath = path.join(__dirname, '..', 'commands');

  const traverse = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const imported = require(fullPath) as { default?: SlashCommand; command?: SlashCommand };
        const command = imported.default ?? imported.command;
        if (command && command.data && typeof command.execute === 'function') {
          commands.push(command);
        }
      }
    }
  };

  if (fs.existsSync(commandsPath)) {
    traverse(commandsPath);
  }

  return commands;
}

