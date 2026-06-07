import { spawn } from "node:child_process";

const nextProcess = spawn("next", ["dev"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["inherit", "pipe", "pipe"],
});

let outputBuffer = "";
let openedUrl = false;

nextProcess.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  maybeOpenUrl(chunk);
});

nextProcess.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  maybeOpenUrl(chunk);
});

nextProcess.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

nextProcess.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

function maybeOpenUrl(chunk) {
  if (openedUrl) return;

  outputBuffer = `${outputBuffer}${stripAnsi(String(chunk))}`.slice(-4096);
  const match = outputBuffer.match(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+/i);
  if (!match) return;

  openedUrl = true;
  openUrl(match[0]);
}

function openUrl(url) {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args =
    process.platform === "win32" ? ["/c", "start", "", url] : [url];

  const openProcess = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    detached: true,
    stdio: "ignore",
  });

  openProcess.on("error", (error) => {
    console.error(`Failed to open ${url}: ${error.message}`);
  });

  openProcess.unref();
}

function stripAnsi(text) {
  return text.replace(/\u001B\[[0-9;]*m/g, "");
}
