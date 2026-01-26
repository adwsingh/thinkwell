/**
 * Dispatch types for conductor message routing
 *
 * The Dispatch type is a unified envelope for messages flowing through the conductor.
 * The Responder abstraction decouples response routing from the message itself,
 * enabling the conductor to intercept and redirect responses.
 */

import type { JsonRpcId, JsonRpcError } from "./json-rpc.js";

/**
 * Responder interface for sending responses back to the original requester.
 *
 * This abstraction allows the conductor to route responses through different
 * paths depending on where the original request came from.
 */
export interface Responder {
  /**
   * Send a successful response
   */
  respond(result: unknown): void;

  /**
   * Send an error response
   */
  respondWithError(error: JsonRpcError): void;
}

/**
 * A request dispatch - carries request data and a responder for sending the response
 */
export interface RequestDispatch {
  type: "request";
  id: JsonRpcId;
  method: string;
  params: unknown;
  responder: Responder;
}

/**
 * A notification dispatch - fire-and-forget message
 */
export interface NotificationDispatch {
  type: "notification";
  method: string;
  params: unknown;
}

/**
 * A response dispatch - result or error for a previous request
 */
export interface ResponseDispatch {
  type: "response";
  id: JsonRpcId;
  result?: unknown;
  error?: JsonRpcError;
}

/**
 * Unified dispatch envelope for all message types.
 *
 * Messages flow through the conductor in this envelope format, which
 * normalizes requests, notifications, and responses into a single type.
 */
export type Dispatch = RequestDispatch | NotificationDispatch | ResponseDispatch;

/**
 * Type guard for request dispatch
 */
export function isRequestDispatch(dispatch: Dispatch): dispatch is RequestDispatch {
  return dispatch.type === "request";
}

/**
 * Type guard for notification dispatch
 */
export function isNotificationDispatch(dispatch: Dispatch): dispatch is NotificationDispatch {
  return dispatch.type === "notification";
}

/**
 * Type guard for response dispatch
 */
export function isResponseDispatch(dispatch: Dispatch): dispatch is ResponseDispatch {
  return dispatch.type === "response";
}

/**
 * Create a simple responder from callback functions
 */
export function createResponder(
  onRespond: (result: unknown) => void,
  onError: (error: JsonRpcError) => void
): Responder {
  return {
    respond: onRespond,
    respondWithError: onError,
  };
}
