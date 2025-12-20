/**
 * Hetzner Cloud API Service
 *
 * Handles VPS provisioning and management for Grove Bloom.
 * Region mapping:
 *   - EU: fsn1 (Falkenstein) with CX33 (~€0.008/hr)
 *   - US: ash (Ashburn) with CPX31 (~€0.021/hr)
 */

import type { Region } from "../types";

const HETZNER_API_BASE = "https://api.hetzner.cloud/v1";

// Server type and datacenter mapping by region
const REGION_CONFIG = {
  eu: {
    datacenter: "fsn1-dc14",
    serverType: "cx32", // 4 vCPU, 8GB RAM (was cx33, now cx32 in new naming)
    hourlyRate: 0.0085,
  },
  us: {
    datacenter: "ash-dc1",
    serverType: "cpx31", // 4 vCPU, 8GB RAM
    hourlyRate: 0.022,
  },
} as const;

export interface HetznerServer {
  id: number;
  name: string;
  status: "running" | "starting" | "stopping" | "off" | "deleting" | "rebuilding" | "migrating" | "initializing";
  public_net: {
    ipv4: {
      ip: string;
    };
    ipv6: {
      ip: string;
    };
  };
  server_type: {
    name: string;
    description: string;
  };
  datacenter: {
    name: string;
    location: {
      name: string;
      city: string;
      country: string;
    };
  };
  created: string;
}

export interface CreateServerOptions {
  region: Region;
  sessionId: string;
  sshKeyId: string;
  webhookUrl: string;
  webhookSecret: string;
  idleTimeout: number;
  r2AccessKey: string;
  r2SecretKey: string;
  cfAccountId: string;
  openrouterApiKey: string;
}

export interface HetznerService {
  createServer(options: CreateServerOptions): Promise<{ serverId: number; serverName: string }>;
  deleteServer(serverId: number): Promise<void>;
  getServer(serverId: number): Promise<HetznerServer | null>;
  listServers(): Promise<HetznerServer[]>;
}

export function createHetznerService(apiToken: string): HetznerService {
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  async function apiRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${HETZNER_API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Hetzner API error (${response.status}): ${error}`);
    }

    // DELETE requests may return 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  function generateCloudInit(options: CreateServerOptions): string {
    // Generate cloud-init user data with environment variables substituted
    return `#cloud-config
package_update: true
package_upgrade: false

packages:
  - git
  - tmux
  - jq
  - curl
  - unzip

write_files:
  - path: /etc/bloom/env
    permissions: '0600'
    content: |
      WEBHOOK_URL=${options.webhookUrl}
      WEBHOOK_SECRET=${options.webhookSecret}
      IDLE_TIMEOUT=${options.idleTimeout}
      R2_ACCESS_KEY=${options.r2AccessKey}
      R2_SECRET_KEY=${options.r2SecretKey}
      CF_ACCOUNT_ID=${options.cfAccountId}
      OPENROUTER_API_KEY=${options.openrouterApiKey}

  - path: /opt/bloom/daemon.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      set -a
      source /etc/bloom/env
      set +a

      last_activity=$(date +%s)

      check_terminal_activity() {
        if [ -f /tmp/bloom-last-activity ]; then
          last_activity=$(cat /tmp/bloom-last-activity)
        fi
      }

      send_heartbeat() {
        local idle_seconds=$(($(date +%s) - last_activity))
        curl -s -X POST "\${WEBHOOK_URL}/webhook/heartbeat" \\
          -H "Authorization: Bearer \${WEBHOOK_SECRET}" \\
          -H "Content-Type: application/json" \\
          -d "{
            \\"state\\": \\"running\\",
            \\"idleSeconds\\": \${idle_seconds},
            \\"timestamp\\": \\"$(date -Iseconds)\\"
          }" || true
      }

      trigger_shutdown() {
        local reason=$1
        echo "$(date): Triggering shutdown - reason: \${reason}"
        curl -s -X POST "\${WEBHOOK_URL}/webhook/\${reason}" \\
          -H "Authorization: Bearer \${WEBHOOK_SECRET}" \\
          -H "Content-Type: application/json" \\
          -d "{\\"timestamp\\": \\"$(date -Iseconds)\\"}" || true
      }

      while true; do
        check_terminal_activity
        idle_seconds=$(($(date +%s) - last_activity))
        send_heartbeat

        if [ "\$idle_seconds" -ge "\$IDLE_TIMEOUT" ]; then
          trigger_shutdown "idle-timeout"
          exit 0
        fi

        sleep 30
      done

  - path: /opt/bloom/sync-to-r2.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      set -a
      source /etc/bloom/env
      set +a

      echo "$(date): Starting R2 sync..."

      cd /workspace

      for dir in */; do
        if [ -d "\${dir}node_modules" ]; then
          echo "Compressing \${dir}node_modules..."
          tar -czf "/tmp/\${dir%/}-node_modules.tar.gz" -C "\$dir" node_modules
          rclone copy "/tmp/\${dir%/}-node_modules.tar.gz" "r2:bloom-repos/\${dir}"
        fi
      done

      if [ -d ~/.kilocode ]; then
        rclone sync ~/.kilocode r2:bloom-state/kilo/
      fi

      tar -czf /tmp/workspace-snapshot.tar.gz \\
        --exclude='node_modules' \\
        --exclude='.git/objects' \\
        -C /workspace .

      rclone copy /tmp/workspace-snapshot.tar.gz r2:bloom-state/current/

      echo "$(date): R2 sync complete"

  - path: /root/.config/rclone/rclone.conf
    permissions: '0600'
    content: |
      [r2]
      type = s3
      provider = Cloudflare
      access_key_id = ${options.r2AccessKey}
      secret_access_key = ${options.r2SecretKey}
      endpoint = https://${options.cfAccountId}.r2.cloudflarestorage.com
      acl = private

  - path: /root/.kilocode/config.json
    permissions: '0600'
    content: |
      {
        "providers": {
          "openrouter": {
            "apiKey": "${options.openrouterApiKey}",
            "defaultModel": "deepseek/deepseek-chat"
          }
        },
        "autoApproval": {
          "enabled": true,
          "read": { "enabled": true, "outside": true },
          "write": { "enabled": true, "outside": false },
          "execute": {
            "enabled": true,
            "allowed": ["npm", "pnpm", "git", "node", "npx", "wrangler", "uv"],
            "denied": ["rm -rf /", "sudo rm", "shutdown"]
          }
        }
      }

  - path: /etc/systemd/system/ttyd.service
    content: |
      [Unit]
      Description=ttyd Web Terminal
      After=network.target

      [Service]
      Type=simple
      ExecStart=/usr/local/bin/ttyd -p 7681 -W -t fontSize=14 /bin/bash -c "cd /workspace && exec bash"
      Restart=always

      [Install]
      WantedBy=multi-user.target

  - path: /etc/systemd/system/bloom-daemon.service
    content: |
      [Unit]
      Description=Bloom Daemon
      After=network.target ttyd.service

      [Service]
      Type=simple
      ExecStart=/opt/bloom/daemon.sh
      Restart=always

      [Install]
      WantedBy=multi-user.target

runcmd:
  - curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  - apt-get install -y nodejs
  - npm install -g pnpm
  - npm install -g @kilocode/cli || true
  - curl https://rclone.org/install.sh | bash
  - |
    TTYD_VERSION="1.7.7"
    curl -L "https://github.com/tsl0922/ttyd/releases/download/\${TTYD_VERSION}/ttyd.x86_64" -o /usr/local/bin/ttyd
    chmod +x /usr/local/bin/ttyd
  - mkdir -p /workspace /etc/bloom /opt/bloom
  - mkdir -p /root/.config/rclone /root/.kilocode
  - rclone sync r2:bloom-repos/ /workspace/ || true
  - |
    cd /workspace
    for tarfile in */*-node_modules.tar.gz; do
      if [ -f "\$tarfile" ]; then
        dir=$(dirname "\$tarfile")
        tar -xzf "\$tarfile" -C "\$dir"
        rm "\$tarfile"
      fi
    done
  - |
    cd /workspace
    for dir in */; do
      if [ -d "\${dir}.git" ]; then
        cd "\$dir"
        git fetch origin || true
        git pull origin $(git branch --show-current) || true
        cd ..
      fi
    done
  - rclone copy r2:bloom-state/kilo/ /root/.kilocode/ || true
  - systemctl daemon-reload
  - systemctl enable ttyd bloom-daemon
  - systemctl start ttyd bloom-daemon
  - |
    sleep 5
    VPS_IP=$(curl -s http://169.254.169.254/hetzner/v1/metadata/public-ipv4)
    SERVER_ID=$(curl -s http://169.254.169.254/hetzner/v1/metadata/instance-id)
    curl -X POST "${options.webhookUrl}/webhook/ready" \\
      -H "Authorization: Bearer ${options.webhookSecret}" \\
      -H "Content-Type: application/json" \\
      -d "{
        \\"serverId\\": \\"\$SERVER_ID\\",
        \\"ip\\": \\"\$VPS_IP\\"
      }"
`;
  }

  return {
    async createServer(options: CreateServerOptions) {
      const config = REGION_CONFIG[options.region];
      const serverName = `bloom-${options.sessionId}`;

      const response = await apiRequest<{ server: HetznerServer }>(
        "POST",
        "/servers",
        {
          name: serverName,
          server_type: config.serverType,
          datacenter: config.datacenter,
          image: "ubuntu-24.04",
          ssh_keys: [options.sshKeyId],
          user_data: generateCloudInit(options),
          labels: {
            project: "grove-bloom",
            session: options.sessionId,
          },
        }
      );

      return {
        serverId: response.server.id,
        serverName: response.server.name,
      };
    },

    async deleteServer(serverId: number) {
      await apiRequest("DELETE", `/servers/${serverId}`);
    },

    async getServer(serverId: number) {
      try {
        const response = await apiRequest<{ server: HetznerServer }>(
          "GET",
          `/servers/${serverId}`
        );
        return response.server;
      } catch (error) {
        if (error instanceof Error && error.message.includes("404")) {
          return null;
        }
        throw error;
      }
    },

    async listServers() {
      const response = await apiRequest<{ servers: HetznerServer[] }>(
        "GET",
        "/servers?label_selector=project=grove-bloom"
      );
      return response.servers;
    },
  };
}

export function getHourlyRate(region: Region): number {
  return REGION_CONFIG[region].hourlyRate;
}
