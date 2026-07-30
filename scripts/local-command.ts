import { spawn } from "node:child_process";
import net from "node:net";

export type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export type LocalCommandInput = {
  command: string;
  arguments: readonly string[];
  cwd: string;
  environment: NodeJS.ProcessEnv;
};

export function runLocalCommand(
  input: LocalCommandInput,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(input.command, input.arguments, {
      cwd: input.cwd,
      env: input.environment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      resolve({ code: 1, stdout, stderr: error.message });
    });
    child.once("exit", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export function localPortIsAvailable(port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") {
        resolve(false);
        return;
      }
      reject(error);
    });
    server.listen(
      { host: "127.0.0.1", port, exclusive: true },
      () => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(true);
        });
      },
    );
  });
}
