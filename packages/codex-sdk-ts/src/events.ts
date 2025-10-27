
/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// based on event types from codex-rs/exec/src/exec_events.rs

import type {ThreadItem} from './items';

/** Emitted when a new thread is started as the first event. */
export interface ThreadStartedEvent {
  type: 'thread.started';
  /** The identifier of the new thread. Can be used to resume the thread later. */
  thread_id: string;
}

/**
 * Emitted when a turn is started by sending a new prompt to the model.
 * A turn encompasses all events that happen while the agent is processing the prompt.
 */
export interface TurnStartedEvent {
  type: 'turn.started';
}

/** Describes the usage of tokens during a turn. */
export interface Usage {
  /** The number of input tokens used during the turn. */
  input_tokens: number;
  /** The number of cached input tokens used during the turn. */
  cached_input_tokens: number;
  /** The number of output tokens used during the turn. */
  output_tokens: number;
}

/** Emitted when a turn is completed. Typically right after the assistant's response. */
export interface TurnCompletedEvent {
  type: 'turn.completed';
  usage: Usage;
}

/** Indicates that a turn failed with an error. */
export interface TurnFailedEvent {
  type: 'turn.failed';
  error: ThreadError;
}

/** Emitted when a new item is added to the thread. Typically the item is initially "in progress". */
export interface ItemStartedEvent {
  type: 'item.started';
  item: ThreadItem;
}

/** Emitted when an item is updated. */
export interface ItemUpdatedEvent {
  type: 'item.updated';
  item: ThreadItem;
}

/** Signals that an item has reached a terminal state—either success or failure. */
export interface ItemCompletedEvent {
  type: 'item.completed';
  item: ThreadItem;
}

/** Fatal error emitted by the stream. */
export interface ThreadError {
  message: string;
}

/** Represents an unrecoverable error emitted directly by the event stream. */
export interface ThreadErrorEvent {
  type: 'error';
  message: string;
}

/** Top-level JSONL events emitted by codex exec. */
export type ThreadEvent =
  | ThreadStartedEvent
  | TurnStartedEvent
  | TurnCompletedEvent
  | TurnFailedEvent
  | ItemStartedEvent
  | ItemUpdatedEvent
  | ItemCompletedEvent
  | ThreadErrorEvent;
