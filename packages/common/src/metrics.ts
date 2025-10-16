/**
 * @license
 * Copyright 2025 BrowserOS
 */

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY!;
const POSTHOG_ENDPOINT = process.env.POSTHOG_ENDPOINT || 'https://us.i.posthog.com/i/v0/e/';
const EVENT_PREFIX = 'browseros.server.';

interface MetricsConfig {
  client_id: string;
  [key: string]: any;
}

class MetricsService {
  private config: MetricsConfig | null = null;

  initialize(config: MetricsConfig): void {
    if (!config.client_id) {
      throw new Error('client_id is required for metrics initialization');
    }
    this.config = config;
  }

  isInitialized(): boolean {
    return this.config !== null;
  }

  getClientId(): string | null {
    return this.config?.client_id ?? null;
  }

  log(eventName: string, properties: Record<string, any> = {}): void {
    if (!this.config) {
      console.warn('Metrics not initialized. Call initialize() first.');
      return;
    }

    if (!POSTHOG_API_KEY) {
      console.warn('POSTHOG_API_KEY not set. Skipping metrics.');
      return;
    }

    const {client_id, ...defaultProperties} = this.config;

    const payload = {
      api_key: POSTHOG_API_KEY,
      event: EVENT_PREFIX + eventName,
      distinct_id: client_id,
      properties: {
        ...defaultProperties,
        ...properties,
        $process_person_profile: false,
      },
    };

    fetch(POSTHOG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).catch(error => {
      console.error('Failed to send metrics event:', error);
    });
  }
}

export const metrics = new MetricsService();
