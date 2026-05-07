import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import type {
  WhatsAppDispatchRequest,
  WhatsAppDispatchResult,
  WhatsAppProvider,
} from "@/lib/dispatch/providers/whatsapp/types";

const seleniumProviderResultSchema = z.object({
  ok: z.boolean(),
  sent: z.array(
    z.object({
      workerId: z.string().uuid(),
      phone: z.string(),
    }),
  ),
  failed: z.array(
    z.object({
      workerId: z.string().uuid(),
      phone: z.string(),
      error: z.string().min(1),
    }),
  ),
});

function getPythonCommand() {
  return process.env.WHATSAPP_PYTHON_BIN?.trim() || "python3";
}

function getScriptPath() {
  const configured = process.env.WHATSAPP_SELENIUM_SCRIPT?.trim();

  if (!configured) {
    return path.join(process.cwd(), "automation", "whatsapp_sender.py");
  }

  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
}

function getCleanPathForPython() {
  const currentPath = process.env.PATH ?? "";
  const filteredParts = currentPath
    .split(path.delimiter)
    .filter((part) => part && path.resolve(part) !== "/usr/local/bin");

  return filteredParts.join(path.delimiter);
}

export class WhatsAppSeleniumProvider implements WhatsAppProvider {
  async sendDispatch(request: WhatsAppDispatchRequest): Promise<WhatsAppDispatchResult> {
    const pythonCommand = getPythonCommand();
    const scriptPath = getScriptPath();
    const timeoutMs = Number(process.env.WHATSAPP_PROVIDER_TIMEOUT_MS ?? "300000");
    const pythonPath = getCleanPathForPython();

    console.error("[whatsapp_provider] spawning sender", {
      dispatchId: request.dispatchId,
      pythonCommand,
      scriptPath,
      path: pythonPath,
    });

    const payload = JSON.stringify({
      dispatchId: request.dispatchId,
      jobId: request.jobId,
      message: request.message,
      recipients: request.recipients.map((recipient) => ({
        worker_id: recipient.workerId,
        phone: recipient.phone,
      })),
    });

    const rawResult = await new Promise<string>((resolve, reject) => {
      const child = spawn(pythonCommand, [scriptPath], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PATH: pythonPath,
        },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      const timeout = Number.isFinite(timeoutMs)
        ? setTimeout(() => {
            child.kill("SIGTERM");
            reject(
              new Error(
                `WhatsApp Selenium provider timed out after ${timeoutMs}ms for dispatch ${request.dispatchId}.`,
              ),
            );
          }, timeoutMs)
        : null;

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        if (timeout) clearTimeout(timeout);
        reject(
          new Error(
            `Failed to start WhatsApp Selenium provider: ${error.message}`,
          ),
        );
      });

      child.on("close", (code) => {
        if (timeout) clearTimeout(timeout);

        if (code !== 0 && !stdout.trim()) {
          reject(
            new Error(
              [
                `WhatsApp Selenium provider exited with code ${code}.`,
                stderr.trim() ? `stderr: ${stderr.trim()}` : "",
                stdout.trim() ? `stdout: ${stdout.trim()}` : "",
              ]
                .filter(Boolean)
                .join(" "),
            ),
          );
          return;
        }

        resolve(stdout.trim());
      });

      child.stdin.write(payload);
      child.stdin.end();
    });

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(rawResult);
    } catch (error) {
      throw new Error(
        `WhatsApp Selenium provider returned invalid JSON for dispatch ${request.dispatchId}: ${
          error instanceof Error ? error.message : "unknown parse error"
        }`,
      );
    }

    const parsed = seleniumProviderResultSchema.safeParse(parsedJson);

    if (!parsed.success) {
      throw new Error(
        `WhatsApp Selenium provider returned an invalid result shape for dispatch ${request.dispatchId}.`,
      );
    }

    return {
      ok: parsed.data.ok,
      sent: parsed.data.sent.map((recipient) => ({
        workerId: recipient.workerId,
        name:
          request.recipients.find((candidate) => candidate.workerId === recipient.workerId)?.name ??
          recipient.workerId,
        phone: recipient.phone,
      })),
      failed: parsed.data.failed.map((recipient) => ({
        workerId: recipient.workerId,
        name:
          request.recipients.find((candidate) => candidate.workerId === recipient.workerId)?.name ??
          recipient.workerId,
        phone: recipient.phone,
        reason: recipient.error,
      })),
      provider: "selenium_web",
      dispatchId: request.dispatchId,
    };
  }
}
