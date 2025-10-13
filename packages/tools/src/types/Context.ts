/**
 * @license
 * Copyright 2025 BrowserOS
 */
import type {Dialog, ElementHandle, Page} from 'puppeteer-core';

/**
 * Trace recording result structure
 */
export interface TraceResult {
  name: string;
  data: unknown;
}

/**
 * Browser context interface that tools use to interact with the browser
 * This is a minimal interface exposing only what tools need
 */
export interface Context {
  // Performance tracing
  isRunningPerformanceTrace(): boolean;
  setIsRunningPerformanceTrace(value: boolean): void;
  recordedTraces(): TraceResult[];
  storeTraceRecording(result: TraceResult): void;

  // Page management
  getSelectedPage(): Page;
  getPageByIdx(idx: number): Page;
  newPage(): Promise<Page>;
  closePage(pageIdx: number): Promise<void>;
  setSelectedPageIdx(idx: number): void;

  // Dialog handling
  getDialog(): Dialog | undefined;
  clearDialog(): void;

  // Element interaction
  getElementByUid(uid: string): Promise<ElementHandle<Element>>;

  // Network emulation
  setNetworkConditions(conditions: string | null): void;

  // CPU emulation
  setCpuThrottlingRate(rate: number): void;

  // File handling
  saveTemporaryFile(
    data: Uint8Array<ArrayBufferLike>,
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp',
  ): Promise<{filename: string}>;

  saveFile(
    data: Uint8Array<ArrayBufferLike>,
    filename: string,
  ): Promise<{filename: string}>;

  // Event synchronization
  waitForEventsAfterAction(action: () => Promise<unknown>): Promise<void>;
}
