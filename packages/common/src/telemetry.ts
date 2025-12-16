/**
 * @license
 * Copyright 2025 BrowserOS
 */
import * as Sentry from '@sentry/bun';
import {PostHog} from 'posthog-node';

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.POSTHOG_ENDPOINT || 'https://us.i.posthog.com';
const EVENT_PREFIX = 'browseros.server.';

export interface TelemetryConfig {
  clientId?: string;
  installId?: string;
  browserosVersion?: string;
  chromiumVersion?: string;
  sentryDsn?: string;
  sentryEnvironment?: string;
  sentryRelease?: string;
}

class TelemetryService {
  private posthog: PostHog | null = null;
  private config: TelemetryConfig | null = null;
  private sentryInitialized = false;

  initialize(config: TelemetryConfig): void {
    this.config = {...this.config, ...config};

    if (!this.posthog && POSTHOG_API_KEY && this.config.clientId) {
      this.posthog = new PostHog(POSTHOG_API_KEY, {host: POSTHOG_HOST});
    }

    if (!this.sentryInitialized && config.sentryDsn) {
      Sentry.init({
        dsn: config.sentryDsn,
        environment: config.sentryEnvironment,
        release: config.sentryRelease,
      });

      if (this.config.clientId) {
        Sentry.setUser({id: this.config.clientId});
      }
      if (
        this.config.installId ||
        this.config.browserosVersion ||
        this.config.chromiumVersion
      ) {
        Sentry.setContext('app', {
          installId: this.config.installId,
          browserosVersion: this.config.browserosVersion,
          chromiumVersion: this.config.chromiumVersion,
        });
      }

      this.sentryInitialized = true;
    }
  }

  isInitialized(): boolean {
    return this.config !== null;
  }

  getClientId(): string | null {
    return this.config?.clientId ?? null;
  }

  log(eventName: string, properties: Record<string, unknown> = {}): void {
    if (!this.posthog || !this.config?.clientId) {
      return;
    }

    const {clientId, installId, browserosVersion, chromiumVersion} =
      this.config;

    this.posthog.capture({
      distinctId: clientId,
      event: EVENT_PREFIX + eventName,
      properties: {
        ...properties,
        ...(installId && {install_id: installId}),
        ...(browserosVersion && {browseros_version: browserosVersion}),
        ...(chromiumVersion && {chromium_version: chromiumVersion}),
        $process_person_profile: false,
      },
    });
  }

  captureException(error: unknown, context?: Record<string, unknown>): void {
    if (context) {
      Sentry.withScope(scope => {
        scope.setExtras(context);
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  }

  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
  ): void {
    Sentry.captureMessage(message, level);
  }

  async shutdown(): Promise<void> {
    await Promise.all([this.posthog?.shutdown(), Sentry.flush(2000)]);
    this.posthog = null;
  }
}

export const telemetry = new TelemetryService();
