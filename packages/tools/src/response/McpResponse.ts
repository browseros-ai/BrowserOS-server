/**
 * @license
 * Copyright 2025 BrowserOS
 */
import type {McpContext} from '@browseros/common';
import type {
  ImageContent,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import type {ResourceType} from 'puppeteer-core';

import {formatConsoleEvent} from '../formatters/consoleFormatter.js';
import {
  getFormattedHeaderValue,
  getFormattedResponseBody,
  getFormattedRequestBody,
  getShortDescriptionForRequest,
  getStatusFromRequest,
} from '../formatters/networkFormatter.js';
import {formatA11ySnapshot} from '../formatters/snapshotFormatter.js';
import type {Response, ImageContentData} from '../types/Response.js';
import {paginate, type PaginationOptions} from '../utils/pagination.js';

interface NetworkRequestData {
  networkRequestUrl: string;
  requestBody?: string;
  responseBody?: string;
}

/**
 * Implementation of the Response interface for MCP tool handlers
 */
export class McpResponse implements Response {
  #includePages = false;
  #includeSnapshot = false;
  #attachedNetworkRequestData?: NetworkRequestData;
  #includeConsoleData = false;
  #textResponseLines: string[] = [];
  #formattedConsoleData?: string[];
  #images: ImageContentData[] = [];
  #structuredContent: Record<string, unknown> = {};
  #networkRequestsOptions?: {
    include: boolean;
    pagination?: PaginationOptions;
    resourceTypes?: ResourceType[];
  };

  setIncludePages(value: boolean): void {
    this.#includePages = value;
  }

  get includePages(): boolean {
    return this.#includePages;
  }

  setIncludeSnapshot(value: boolean): void {
    this.#includeSnapshot = value;
  }

  get includeSnapshot(): boolean {
    return this.#includeSnapshot;
  }

  setIncludeNetworkRequests(
    value: boolean,
    options?: {
      pageSize?: number;
      pageIdx?: number;
      resourceTypes?: ResourceType[];
    },
  ): void {
    if (!value) {
      this.#networkRequestsOptions = undefined;
      return;
    }

    this.#networkRequestsOptions = {
      include: value,
      pagination:
        options?.pageSize || options?.pageIdx
          ? {
              pageSize: options.pageSize,
              pageIdx: options.pageIdx,
            }
          : undefined,
      resourceTypes: options?.resourceTypes,
    };
  }

  get includeNetworkRequests(): boolean {
    return this.#networkRequestsOptions?.include ?? false;
  }

  get networkRequestsPageIdx(): number | undefined {
    return this.#networkRequestsOptions?.pagination?.pageIdx;
  }

  setIncludeConsoleData(value: boolean): void {
    this.#includeConsoleData = value;
  }

  get includeConsoleData(): boolean {
    return this.#includeConsoleData;
  }

  attachNetworkRequest(url: string): void {
    this.#attachedNetworkRequestData = {
      networkRequestUrl: url,
    };
  }

  get attachedNetworkRequestUrl(): string | undefined {
    return this.#attachedNetworkRequestData?.networkRequestUrl;
  }

  appendResponseLine(value: string): void {
    this.#textResponseLines.push(value);
  }

  attachImage(value: ImageContentData): void {
    this.#images.push(value);
  }

  get responseLines(): readonly string[] {
    return this.#textResponseLines;
  }

  resetResponseLineForTesting(): void {
    this.#textResponseLines = [];
  }

  get images(): ImageContentData[] {
    return this.#images;
  }

  addStructuredContent(key: string, value: unknown): void {
    if (!key || typeof key !== 'string') {
      return;
    }
    if (value === undefined) {
      return;
    }
    this.#structuredContent[key] = value;
  }

  get structuredContent(): Record<string, unknown> | undefined {
    return Object.keys(this.#structuredContent).length > 0
      ? this.#structuredContent
      : undefined;
  }

  /**
   * Process and format the response for the given tool
   */
  async handle(
    toolName: string,
    context: McpContext,
  ): Promise<Array<TextContent | ImageContent>> {
    // Gather additional data based on flags
    if (
      this.#includePages &&
      typeof context.createPagesSnapshot === 'function'
    ) {
      await context.createPagesSnapshot();
    }
    if (
      this.#includeSnapshot &&
      typeof context.createTextSnapshot === 'function'
    ) {
      await context.createTextSnapshot();
    }

    // Process network request details
    if (
      this.#attachedNetworkRequestData?.networkRequestUrl &&
      typeof context.getNetworkRequestByUrl === 'function'
    ) {
      const request = context.getNetworkRequestByUrl(
        this.#attachedNetworkRequestData.networkRequestUrl,
      );

      this.#attachedNetworkRequestData.requestBody =
        await getFormattedRequestBody(request);

      const response = request.response();
      if (response) {
        this.#attachedNetworkRequestData.responseBody =
          await getFormattedResponseBody(response);
      }
    }

    // Process console messages
    if (
      this.#includeConsoleData &&
      typeof context.getConsoleData === 'function'
    ) {
      const consoleMessages = context.getConsoleData();
      if (consoleMessages) {
        this.#formattedConsoleData = await Promise.all(
          consoleMessages.map(message => formatConsoleEvent(message)),
        );
      }
    }

    return this.#format(toolName, context);
  }

  /**
   * Format the collected data into MCP content
   */
  #format(
    toolName: string,
    context: McpContext,
  ): Array<TextContent | ImageContent> {
    const response = [`# ${toolName} response`];

    // Add custom response lines
    for (const line of this.#textResponseLines) {
      response.push(line);
    }

    // Add emulation status
    this.#appendEmulationStatus(response, context);

    // Add dialog status
    this.#appendDialogStatus(response, context);

    // Add pages information
    if (this.#includePages) {
      this.#appendPagesInfo(response, context);
    }

    // Add snapshot
    if (this.#includeSnapshot) {
      this.#appendSnapshot(response, context);
    }

    // Add network request details
    this.#appendNetworkRequestDetails(response, context);

    // Add network requests list
    if (this.#networkRequestsOptions?.include) {
      this.#appendNetworkRequestsList(response, context);
    }

    // Add console messages
    if (this.#includeConsoleData && this.#formattedConsoleData) {
      this.#appendConsoleMessages(response);
    }

    // Build final content
    const text: TextContent = {
      type: 'text',
      text: response.join('\n'),
    };

    const images: ImageContent[] = this.#images.map(imageData => ({
      type: 'image',
      ...imageData,
    }));

    return [text, ...images];
  }

  #appendEmulationStatus(response: string[], context: McpContext): void {
    if (typeof context.getNetworkConditions === 'function') {
      const networkConditions = context.getNetworkConditions();
      if (
        networkConditions &&
        typeof context.getNavigationTimeout === 'function'
      ) {
        response.push('## Network emulation');
        response.push(`Emulating: ${networkConditions}`);
        response.push(
          `Default navigation timeout set to ${context.getNavigationTimeout()} ms`,
        );
      }
    }

    if (typeof context.getCpuThrottlingRate === 'function') {
      const cpuThrottlingRate = context.getCpuThrottlingRate();
      if (cpuThrottlingRate > 1) {
        response.push('## CPU emulation');
        response.push(`Emulating: ${cpuThrottlingRate}x slowdown`);
      }
    }
  }

  #appendDialogStatus(response: string[], context: McpContext): void {
    if (typeof context.getDialog === 'function') {
      const dialog = context.getDialog();
      if (dialog) {
        response.push(`# Open dialog
${dialog.type()}: ${dialog.message()} (default value: ${dialog.defaultValue()}).
Call handle_dialog to handle it before continuing.`);
      }
    }
  }

  #appendPagesInfo(response: string[], context: McpContext): void {
    if (
      typeof context.getPages === 'function' &&
      typeof context.getSelectedPageIdx === 'function'
    ) {
      const parts = ['## Pages'];
      let idx = 0;
      for (const page of context.getPages()) {
        parts.push(
          `${idx}: ${page.url()}${idx === context.getSelectedPageIdx() ? ' [selected]' : ''}`,
        );
        idx++;
      }
      response.push(...parts);
    }
  }

  #appendSnapshot(response: string[], context: McpContext): void {
    if (typeof context.getTextSnapshot === 'function') {
      const snapshot = context.getTextSnapshot();
      if (snapshot) {
        const formattedSnapshot = formatA11ySnapshot(snapshot.root);
        response.push('## Page content');
        response.push(formattedSnapshot);
      }
    }
  }

  #appendNetworkRequestDetails(response: string[], context: McpContext): void {
    const url = this.#attachedNetworkRequestData?.networkRequestUrl;
    if (!url || typeof context.getNetworkRequestByUrl !== 'function') {
      return;
    }

    const httpRequest = context.getNetworkRequestByUrl(url);
    response.push(`## Request ${httpRequest.url()}`);
    response.push(`Status:  ${getStatusFromRequest(httpRequest)}`);
    response.push('### Request Headers');
    for (const line of getFormattedHeaderValue(httpRequest.headers())) {
      response.push(line);
    }

    if (this.#attachedNetworkRequestData?.requestBody) {
      response.push('### Request Body');
      response.push(this.#attachedNetworkRequestData.requestBody);
    }

    const httpResponse = httpRequest.response();
    if (httpResponse) {
      response.push('### Response Headers');
      for (const line of getFormattedHeaderValue(httpResponse.headers())) {
        response.push(line);
      }
    }

    if (this.#attachedNetworkRequestData?.responseBody) {
      response.push('### Response Body');
      response.push(this.#attachedNetworkRequestData.responseBody);
    }

    const httpFailure = httpRequest.failure();
    if (httpFailure) {
      response.push('### Request failed with');
      response.push(httpFailure.errorText);
    }

    const redirectChain = httpRequest.redirectChain();
    if (redirectChain.length) {
      response.push('### Redirect chain');
      let indent = 0;
      for (const request of redirectChain.reverse()) {
        response.push(
          `${'  '.repeat(indent)}${getShortDescriptionForRequest(request)}`,
        );
        indent++;
      }
    }
  }

  #appendNetworkRequestsList(response: string[], context: McpContext): void {
    if (typeof context.getNetworkRequests !== 'function') {
      return;
    }

    let requests = context.getNetworkRequests();

    // Apply resource type filtering
    if (this.#networkRequestsOptions?.resourceTypes?.length) {
      const normalizedTypes = new Set(
        this.#networkRequestsOptions.resourceTypes,
      );
      requests = requests.filter(request => {
        const type = request.resourceType();
        return normalizedTypes.has(type);
      });
    }

    response.push('## Network requests');
    if (requests.length) {
      const data = this.#dataWithPagination(
        requests,
        this.#networkRequestsOptions?.pagination,
      );
      response.push(...data.info);
      for (const request of data.items) {
        response.push(getShortDescriptionForRequest(request));
      }
    } else {
      response.push('No requests found.');
    }
  }

  #appendConsoleMessages(response: string[]): void {
    response.push('## Console messages');
    if (this.#formattedConsoleData && this.#formattedConsoleData.length) {
      response.push(...this.#formattedConsoleData);
    } else {
      response.push('<no console messages found>');
    }
  }

  #dataWithPagination<T>(data: T[], pagination?: PaginationOptions) {
    const response = [];
    const paginationResult = paginate<T>(data, pagination);
    if (paginationResult.invalidPage) {
      response.push('Invalid page number provided. Showing first page.');
    }

    const {startIndex, endIndex, currentPage, totalPages} = paginationResult;
    response.push(
      `Showing ${startIndex + 1}-${endIndex} of ${data.length} (Page ${currentPage + 1} of ${totalPages}).`,
    );
    if (pagination) {
      if (paginationResult.hasNextPage) {
        response.push(`Next page: ${currentPage + 1}`);
      }
      if (paginationResult.hasPreviousPage) {
        response.push(`Previous page: ${currentPage - 1}`);
      }
    }

    return {
      info: response,
      items: paginationResult.items,
    };
  }
}
