/**
 * VPS Communication Service
 *
 * Handles communication with the running VPS (sync triggers, task submission).
 */

export interface VpsService {
  triggerSync(vpsIp: string, webhookSecret: string): Promise<void>;
  sendTask(
    vpsIp: string,
    webhookSecret: string,
    task: string,
    mode?: string
  ): Promise<void>;
  executeCommand(
    vpsIp: string,
    webhookSecret: string,
    command: string
  ): Promise<string>;
}

export function createVpsService(): VpsService {
  return {
    async triggerSync(vpsIp: string, webhookSecret: string) {
      // SSH into VPS and run sync script
      // For now, we use an HTTP endpoint on the VPS
      const response = await fetch(`http://${vpsIp}:8080/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${webhookSecret}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger sync: ${response.statusText}`);
      }
    },

    async sendTask(
      vpsIp: string,
      webhookSecret: string,
      task: string,
      mode?: string
    ) {
      // Send task to the VPS for Kilo Code to execute
      const response = await fetch(`http://${vpsIp}:8080/task`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${webhookSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ task, mode }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send task: ${response.statusText}`);
      }
    },

    async executeCommand(
      vpsIp: string,
      webhookSecret: string,
      command: string
    ) {
      const response = await fetch(`http://${vpsIp}:8080/exec`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${webhookSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        throw new Error(`Failed to execute command: ${response.statusText}`);
      }

      const data = await response.json() as { output: string };
      return data.output;
    },
  };
}
