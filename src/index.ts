import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';

const LOG_DIR = path.resolve(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'bot.log');
const RESTART_DELAY_MS = 5000;
const MAX_RESTARTS = 10;
const RESTART_WINDOW_MS = 60_000;

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function log(message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [SUPERVISOR] ${message}\n`;
  process.stdout.write(line);
  logStream.write(line);
}

function pipeOutput(stream: NodeJS.ReadableStream, prefix: string, toStderr = false) {
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] [${prefix}] ${text}`);
    if (toStderr) {
      process.stderr.write(text);
    } else {
      process.stdout.write(text);
    }
  });
}

let botProcess: ChildProcessWithoutNullStreams | null = null;
let stopping = false;
let restartTimestamps: number[] = [];

function scheduleRestart() {
  const now = Date.now();
  restartTimestamps = restartTimestamps.filter((ts) => now - ts < RESTART_WINDOW_MS);

  if (restartTimestamps.length >= MAX_RESTARTS) {
    log('Zu viele Neustarts in kurzer Zeit. Beende Supervisor.');
    logStream.end();
    process.exit(1);
  }

  restartTimestamps.push(now);

  log(`Starte Bot in ${RESTART_DELAY_MS / 1000} Sekunden neu ...`);
  setTimeout(() => {
    startBot();
  }, RESTART_DELAY_MS);
}

function startBot() {
  if (stopping) {
    return;
  }

  log('Starte Bot-Prozess ...');

  botProcess = spawn(process.execPath, [path.join(__dirname, 'bot.js')], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env
  });

  pipeOutput(botProcess.stdout, 'BOT');
  pipeOutput(botProcess.stderr, 'BOT-ERR', true);

  botProcess.on('error', (error) => {
    log(`Fehler beim Starten des Bot-Prozesses: ${error.message}`);
  });

  botProcess.on('exit', (code, signal) => {
    botProcess = null;

    if (stopping) {
      log(`Bot-Prozess beendet (code=${code}, signal=${signal}). Kein Neustart, da Shutdown gewünscht.`);
      logStream.end();
      process.exit(typeof code === 'number' ? code : 0);
      return;
    }

    log(`Bot-Prozess unerwartet beendet (code=${code}, signal=${signal}).`);
    scheduleRestart();
  });
}

function shutdown(reason: string) {
  if (stopping) {
    return;
  }

  stopping = true;
  log(`Supervisor erhält Signal ${reason}. Beende Bot-Prozess ...`);

  if (botProcess) {
    botProcess.kill('SIGTERM');
  } else {
    log('Kein laufender Bot-Prozess. Beende Supervisor.');
    logStream.end();
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

log('Bot-Supervisor gestartet.');
startBot();

