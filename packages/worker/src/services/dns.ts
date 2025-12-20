/**
 * Cloudflare DNS Service
 *
 * Updates the bloom.grove.place A record when VPS boots/shuts down.
 */

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export interface DnsService {
  updateBloomRecord(ip: string): Promise<void>;
  getBloomRecord(): Promise<{ ip: string; recordId: string } | null>;
}

export function createDnsService(
  apiToken: string,
  zoneId: string
): DnsService {
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  async function apiRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${CF_API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json() as { success: boolean; result: T; errors: unknown[] };

    if (!data.success) {
      throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors)}`);
    }

    return data.result;
  }

  return {
    async updateBloomRecord(ip: string) {
      // First, find the existing record
      const existingRecord = await this.getBloomRecord();

      if (existingRecord) {
        // Update existing record
        await apiRequest(
          "PATCH",
          `/zones/${zoneId}/dns_records/${existingRecord.recordId}`,
          {
            type: "A",
            name: "bloom",
            content: ip,
            ttl: 60,
            proxied: false,
          }
        );
      } else {
        // Create new record
        await apiRequest("POST", `/zones/${zoneId}/dns_records`, {
          type: "A",
          name: "bloom",
          content: ip,
          ttl: 60,
          proxied: false,
        });
      }
    },

    async getBloomRecord() {
      interface DnsRecord {
        id: string;
        type: string;
        name: string;
        content: string;
      }

      const records = await apiRequest<DnsRecord[]>(
        "GET",
        `/zones/${zoneId}/dns_records?type=A&name=bloom.grove.place`
      );

      if (records.length === 0) {
        return null;
      }

      return {
        ip: records[0].content,
        recordId: records[0].id,
      };
    },
  };
}
