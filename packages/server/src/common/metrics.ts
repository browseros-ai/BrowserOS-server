/**
 * @license
 * Copyright 2025 BrowserOS
 */
import {PostHog} from 'posthog-node';

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.POSTHOG_ENDPOINT || 'https://us.i.posthog.com';
const EVENT_PREFIX = 'browseros.server.';

export interface MetricsConfig {
  client_id?: string;
  install_id?: string;
  browseros_version?: string;
  chromium_version?: string;
  [key: string]: any;
}

class MetricsService {
  private client: PostHog | null = null;
  private config: MetricsConfig | null = null;

  initialize(config: MetricsConfig): void {
    this.config = {...this.config, ...config};

    if (!this.client && POSTHOG_API_KEY && this.config.client_id) {
      this.client = new PostHog(POSTHOG_API_KEY, {host: POSTHOG_HOST});
    }
  }

  isInitialized(): boolean {
    return this.config !== null;
  }

  getClientId(): string | null {
    return this.config?.client_id ?? null;
  }

  log(eventName: string, properties: Record<string, any> = {}): void {
    if (!this.client || !this.config?.client_id) {
      return;
    }

    const {
      client_id,
      install_id,
      browseros_version,
      chromium_version,
      ...defaultProperties
    } = this.config;

    this.client.capture({
      distinctId: client_id,
      event: EVENT_PREFIX + eventName,
      properties: {
        ...defaultProperties,
        ...properties,
        ...(install_id && {install_id}),
        ...(browseros_version && {browseros_version}),
        ...(chromium_version && {chromium_version}),
        $process_person_profile: false,
      },
    });
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.shutdown();
      this.client = null;
    }
  }
}

export const metrics = new MetricsService();
