import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

import { SandboxMode } from "./threadOptions";

/** MCP Server Configuration */
export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export type CodexExecArgs = {
  input: string;

  baseUrl?: string;
  apiKey?: string;
  threadId?: string | null;
  images?: string[];
  // --model
  model?: string;
  // --sandbox
  sandboxMode?: SandboxMode;
  // --cd
  workingDirectory?: string;
  // --skip-git-repo-check
  skipGitRepoCheck?: boolean;
  // --output-schema
  outputSchemaFile?: string;
  // MCP servers for programmatic configuration
  mcpServers?: Record<string, McpServerConfig>;
};

const INTERNAL_ORIGINATOR_ENV = "CODEX_INTERNAL_ORIGINATOR_OVERRIDE";
const TYPESCRIPT_SDK_ORIGINATOR = "codex_sdk_ts";

export class CodexExec {
  private executablePath: string;
  private currentChild: ReturnType<typeof spawn> | null = null;

  constructor(executablePath: string | null = null) {
    this.executablePath = executablePath || findCodexPath();
  }

  /**
   * Immediately kill the running child process (if any)
   * Kills the entire process group to ensure child processes are also terminated
   */
  kill(): void {
    console.log('[CodexExec.kill] Called - currentChild:', !!this.currentChild, 'pid:', this.currentChild?.pid, 'killed:', this.currentChild?.killed);
    if (this.currentChild && this.currentChild.pid && !this.currentChild.killed) {
      const pid = this.currentChild.pid;
      console.log('[CodexExec.kill] Killing process group:', pid);
      try {
        // Kill the entire process group (negative PID) to ensure child processes die too
        process.kill(-pid, 'SIGKILL');
        console.log('[CodexExec.kill] SIGKILL sent to process group');
      } catch (error) {
        console.log('[CodexExec.kill] Error killing process group, trying single process:', error);
        this.currentChild.kill('SIGKILL');
      }
    } else {
      console.log('[CodexExec.kill] Skipped - child null, no PID, or already killed');
    }
  }

  async *run(args: CodexExecArgs): AsyncGenerator<string> {
    const commandArgs: string[] = ["exec", "--experimental-json"];

    if (args.model) {
      commandArgs.push("--model", args.model);
    }

    if (args.sandboxMode) {
      commandArgs.push("--sandbox", args.sandboxMode);
    }

    if (args.workingDirectory) {
      commandArgs.push("--cd", args.workingDirectory);
    }

    if (args.skipGitRepoCheck) {
      commandArgs.push("--skip-git-repo-check");
    }

    if (args.outputSchemaFile) {
      commandArgs.push("--output-schema", args.outputSchemaFile);
    }

    if (args.images?.length) {
      for (const image of args.images) {
        commandArgs.push("--image", image);
      }
    }

    if (args.threadId) {
      commandArgs.push("resume", args.threadId);
    }

    // MCP Server Configuration Support
    // Inject -c flags to programmatically configure MCP servers
    if (args.mcpServers && typeof args.mcpServers === "object") {
      for (const [serverName, serverConfig] of Object.entries(args.mcpServers)) {
        // Build MCP server config object
        const mcpConfigObj: Record<string, any> = {};

        // Check if it's an HTTP server (has url property) or stdio server (has command property)
        if ((serverConfig as any).url) {
          mcpConfigObj.url = (serverConfig as any).url;
        } else if (serverConfig.command) {
          mcpConfigObj.command = serverConfig.command;
          if (serverConfig.args) {
            mcpConfigObj.args = serverConfig.args;
          }
          if (serverConfig.env) {
            mcpConfigObj.env = serverConfig.env;
          }
        }

        // Serialize to JSON and add as -c flag
        const mcpConfigJson = JSON.stringify(mcpConfigObj);
        commandArgs.push("-c", `mcp.servers.${serverName}=${mcpConfigJson}`);
      }
    }

    const env = {
      ...process.env,
    };
    if (!env[INTERNAL_ORIGINATOR_ENV]) {
      env[INTERNAL_ORIGINATOR_ENV] = TYPESCRIPT_SDK_ORIGINATOR;
    }
    if (args.baseUrl) {
      env.OPENAI_BASE_URL = args.baseUrl;
    }
    if (args.apiKey) {
      env.CODEX_API_KEY = args.apiKey;
    }

    const child = spawn(this.executablePath, commandArgs, {
      env,
      detached: true, // Create new process group so we can kill all children
    });
    this.currentChild = child;

    let spawnError: unknown | null = null;
    child.once("error", (err) => (spawnError = err));

    if (!child.stdin) {
      child.kill();
      throw new Error("Child process has no stdin");
    }
    child.stdin.write(args.input);
    child.stdin.end();

    if (!child.stdout) {
      child.kill();
      throw new Error("Child process has no stdout");
    }
    const stderrChunks: Buffer[] = [];

    if (child.stderr) {
      child.stderr.on("data", (data) => {
        stderrChunks.push(data);
      });
    }

    const rl = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of rl) {
        // `line` is a string (Node sets default encoding to utf8 for readline)
        yield line as string;
      }

      const exitCode = new Promise((resolve, reject) => {
        child.once("exit", (code) => {
          if (code === 0) {
            resolve(code);
          } else {
            const stderrBuffer = Buffer.concat(stderrChunks);
            reject(
              new Error(`Codex Exec exited with code ${code}: ${stderrBuffer.toString("utf8")}`),
            );
          }
        });
      });

      if (spawnError) throw spawnError;
      await exitCode;
    } finally {
      rl.close();
      child.removeAllListeners();
      try {
        if (!child.killed) {
          // Use SIGKILL to force immediate termination
          child.kill('SIGKILL');
        }
      } catch {
        // ignore
      }
      this.currentChild = null;
    }
  }
}

const scriptFileName = fileURLToPath(import.meta.url);
const scriptDirName = path.dirname(scriptFileName);

function findCodexPath() {
  const { platform, arch } = process;

  let targetTriple = null;
  switch (platform) {
    case "linux":
    case "android":
      switch (arch) {
        case "x64":
          targetTriple = "x86_64-unknown-linux-musl";
          break;
        case "arm64":
          targetTriple = "aarch64-unknown-linux-musl";
          break;
        default:
          break;
      }
      break;
    case "darwin":
      switch (arch) {
        case "x64":
          targetTriple = "x86_64-apple-darwin";
          break;
        case "arm64":
          targetTriple = "aarch64-apple-darwin";
          break;
        default:
          break;
      }
      break;
    case "win32":
      switch (arch) {
        case "x64":
          targetTriple = "x86_64-pc-windows-msvc";
          break;
        case "arm64":
          targetTriple = "aarch64-pc-windows-msvc";
          break;
        default:
          break;
      }
      break;
    default:
      break;
  }

  if (!targetTriple) {
    throw new Error(`Unsupported platform: ${platform} (${arch})`);
  }

  const vendorRoot = path.join(scriptDirName, "..", "vendor");
  const archRoot = path.join(vendorRoot, targetTriple);
  const codexBinaryName = process.platform === "win32" ? "codex.exe" : "codex";
  const binaryPath = path.join(archRoot, "codex", codexBinaryName);

  return binaryPath;
}
