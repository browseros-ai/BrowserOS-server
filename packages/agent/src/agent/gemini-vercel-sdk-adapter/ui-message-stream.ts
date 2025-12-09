/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * UI Message Stream Protocol formatter
 * Formats events for Vercel AI SDK's UI Message Stream protocol
 * Used with useChat hook expecting toUIMessageStreamResponse() format
 */

export type UIMessageStreamEvent =
  | {type: 'start'; messageId?: string}
  | {type: 'start-step'}
  | {type: 'text-start'; id: string}
  | {type: 'text-delta'; id: string; delta: string}
  | {type: 'text-end'; id: string}
  | {type: 'reasoning-start'; id: string}
  | {type: 'reasoning-delta'; id: string; delta: string}
  | {type: 'reasoning-end'; id: string}
  | {type: 'tool-input-start'; toolCallId: string; toolName: string}
  | {type: 'tool-input-delta'; toolCallId: string; inputTextDelta: string}
  | {
      type: 'tool-input-available';
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
  | {type: 'tool-output-available'; toolCallId: string; output: unknown}
  | {type: 'tool-input-error'; toolCallId: string; errorText: string}
  | {type: 'tool-output-error'; toolCallId: string; errorText: string}
  | {type: 'source-url'; sourceId: string; url: string; title?: string}
  | {type: 'file'; url: string; mediaType: string}
  | {type: 'error'; errorText: string}
  | {type: 'finish-step'}
  | {type: 'finish'; finishReason: string; messageMetadata?: unknown}
  | {type: 'abort'};

export function formatUIMessageStreamEvent(
  event: UIMessageStreamEvent,
): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function formatUIMessageStreamDone(): string {
  return 'data: [DONE]\n\n';
}

/**
 * Helper class for managing UI Message Stream state
 * Tracks part IDs and ensures proper event ordering
 */
export class UIMessageStreamWriter {
  private textPartCounter = 0;
  private reasoningPartCounter = 0;
  private currentTextId: string | null = null;
  private currentReasoningId: string | null = null;
  private hasStarted = false;
  private hasStartedStep = false;
  private hasFinished = false;
  private write: (data: string) => Promise<void>;

  constructor(writeFn: (data: string) => Promise<void>) {
    this.write = writeFn;
  }

  async start(messageId?: string): Promise<void> {
    if (this.hasStarted) return;
    this.hasStarted = true;
    await this.write(formatUIMessageStreamEvent({type: 'start', messageId}));
  }

  async startStep(): Promise<void> {
    if (!this.hasStarted) await this.start();
    if (this.hasStartedStep) return;
    this.hasStartedStep = true;
    await this.write(formatUIMessageStreamEvent({type: 'start-step'}));
  }

  async writeTextDelta(delta: string): Promise<void> {
    if (!this.hasStartedStep) await this.startStep();

    if (this.currentTextId === null) {
      this.currentTextId = String(this.textPartCounter++);
      await this.write(
        formatUIMessageStreamEvent({
          type: 'text-start',
          id: this.currentTextId,
        }),
      );
    }

    await this.write(
      formatUIMessageStreamEvent({
        type: 'text-delta',
        id: this.currentTextId,
        delta,
      }),
    );
  }

  async endText(): Promise<void> {
    if (this.currentTextId !== null) {
      await this.write(
        formatUIMessageStreamEvent({type: 'text-end', id: this.currentTextId}),
      );
      this.currentTextId = null;
    }
  }

  async writeReasoningDelta(delta: string): Promise<void> {
    if (!this.hasStartedStep) await this.startStep();

    if (this.currentReasoningId === null) {
      this.currentReasoningId = `reasoning_${this.reasoningPartCounter++}`;
      await this.write(
        formatUIMessageStreamEvent({
          type: 'reasoning-start',
          id: this.currentReasoningId,
        }),
      );
    }

    await this.write(
      formatUIMessageStreamEvent({
        type: 'reasoning-delta',
        id: this.currentReasoningId,
        delta,
      }),
    );
  }

  async endReasoning(): Promise<void> {
    if (this.currentReasoningId !== null) {
      await this.write(
        formatUIMessageStreamEvent({
          type: 'reasoning-end',
          id: this.currentReasoningId,
        }),
      );
      this.currentReasoningId = null;
    }
  }

  async writeToolCall(
    toolCallId: string,
    toolName: string,
    input: unknown,
  ): Promise<void> {
    if (!this.hasStartedStep) await this.startStep();
    await this.endText();

    await this.write(
      formatUIMessageStreamEvent({
        type: 'tool-input-start',
        toolCallId,
        toolName,
      }),
    );
    await this.write(
      formatUIMessageStreamEvent({
        type: 'tool-input-available',
        toolCallId,
        toolName,
        input,
      }),
    );
  }

  async writeToolResult(toolCallId: string, output: unknown): Promise<void> {
    await this.write(
      formatUIMessageStreamEvent({
        type: 'tool-output-available',
        toolCallId,
        output,
      }),
    );
  }

  async writeToolError(
    toolCallId: string,
    errorText: string,
    isInput = false,
  ): Promise<void> {
    if (isInput) {
      await this.write(
        formatUIMessageStreamEvent({
          type: 'tool-input-error',
          toolCallId,
          errorText,
        }),
      );
    } else {
      await this.write(
        formatUIMessageStreamEvent({
          type: 'tool-output-error',
          toolCallId,
          errorText,
        }),
      );
    }
  }

  async writeError(errorText: string): Promise<void> {
    await this.write(formatUIMessageStreamEvent({type: 'error', errorText}));
  }

  async finishStep(): Promise<void> {
    await this.endText();
    await this.endReasoning();
    if (this.hasStartedStep) {
      await this.write(formatUIMessageStreamEvent({type: 'finish-step'}));
      this.hasStartedStep = false;
    }
  }

  async finish(finishReason = 'stop'): Promise<void> {
    if (this.hasFinished) return;
    this.hasFinished = true;
    await this.finishStep();
    await this.write(
      formatUIMessageStreamEvent({type: 'finish', finishReason}),
    );
    await this.write(formatUIMessageStreamDone());
  }

  async abort(): Promise<void> {
    if (this.hasFinished) return;
    this.hasFinished = true;
    await this.endText();
    await this.endReasoning();
    await this.write(formatUIMessageStreamEvent({type: 'abort'}));
    await this.write(formatUIMessageStreamDone());
  }
}
