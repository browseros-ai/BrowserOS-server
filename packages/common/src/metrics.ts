/**
 * @license
 * Copyright 2025 BrowserOS
 */

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY!;
const POSTHOG_ENDPOINT =
  process.env.POSTHOG_ENDPOINT || 'https://us.i.posthog.com/i/v0/e/';
const EVENT_PREFIX = 'browseros.server.';

export interface MetricsConfig {
  client_id?: string;
  install_id?: string;
  [key: string]: any;
}

class MetricsService {
  private config: MetricsConfig | null = null;

  initialize(config: MetricsConfig): void {
    this.config = {...this.config, ...config};
  }

  isInitialized(): boolean {
    return this.config !== null;
  }

  getClientId(): string | null {
    return this.config?.client_id ?? null;
  }

  log(eventName: string, properties: Record<string, any> = {}): void {
    if (!this.config?.client_id) {
      return;
    }

    if (!POSTHOG_API_KEY) {
      return;
    }

    const {client_id, install_id, ...defaultProperties} = this.config;

    const payload = {
      api_key: POSTHOG_API_KEY,
      event: EVENT_PREFIX + eventName,
      distinct_id: client_id,
      properties: {
        ...defaultProperties,
        ...properties,
        ...(install_id && {install_id}),
        $process_person_profile: false,
      },
    };

    fetch(POSTHOG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
}

export const metrics = new MetricsService();
