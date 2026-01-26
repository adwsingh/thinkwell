/**
 * Proxy protocol types for `_proxy/successor/*` messages
 *
 * Proxies communicate with their downstream component (next proxy or agent)
 * through the conductor using these extension methods.
 */

import type { JsonRpcRequest, JsonRpcNotification, JsonRpcMessage } from "./json-rpc.js";

/**
 * Method names for proxy-to-successor communication
 */
export const PROXY_SUCCESSOR_REQUEST = "_proxy/successor/request";
export const PROXY_SUCCESSOR_NOTIFICATION = "_proxy/successor/notification";

/**
 * Parameters for `_proxy/successor/request`
 *
 * When a proxy receives an ACP request from upstream and wants to forward it
 * (possibly transformed) to the downstream component, it sends this to the conductor.
 */
export interface ProxySuccessorRequestParams {
  /** The method of the inner request to forward */
  method: string;
  /** The params of the inner request (optional) */
  params?: unknown;
}

/**
 * Parameters for `_proxy/successor/notification`
 *
 * When a proxy receives a notification from upstream and wants to forward it downstream.
 */
export interface ProxySuccessorNotificationParams {
  /** The method of the inner notification to forward */
  method: string;
  /** The params of the inner notification (optional) */
  params?: unknown;
}

/**
 * Type guard for `_proxy/successor/request` messages
 */
export function isProxySuccessorRequest(
  message: JsonRpcMessage
): message is JsonRpcRequest & { params: ProxySuccessorRequestParams } {
  return (
    "method" in message &&
    "id" in message &&
    message.method === PROXY_SUCCESSOR_REQUEST
  );
}

/**
 * Type guard for `_proxy/successor/notification` messages
 */
export function isProxySuccessorNotification(
  message: JsonRpcMessage
): message is JsonRpcNotification & { params: ProxySuccessorNotificationParams } {
  return (
    "method" in message &&
    !("id" in message) &&
    message.method === PROXY_SUCCESSOR_NOTIFICATION
  );
}

/**
 * Extract the inner request from a `_proxy/successor/request` message
 */
export function unwrapProxySuccessorRequest(
  params: ProxySuccessorRequestParams
): { method: string; params: unknown } {
  return {
    method: params.method,
    params: params.params,
  };
}

/**
 * Extract the inner notification from a `_proxy/successor/notification` message
 */
export function unwrapProxySuccessorNotification(
  params: ProxySuccessorNotificationParams
): { method: string; params: unknown } {
  return {
    method: params.method,
    params: params.params,
  };
}

/**
 * Wrap a request for forwarding to a predecessor proxy
 *
 * When the conductor needs to send a message FROM a successor TO a proxy,
 * it wraps the message in `_proxy/successor/request` format.
 */
export function wrapAsProxySuccessorRequest(
  method: string,
  params: unknown
): ProxySuccessorRequestParams {
  return { method, params };
}

/**
 * Wrap a notification for forwarding to a predecessor proxy
 */
export function wrapAsProxySuccessorNotification(
  method: string,
  params: unknown
): ProxySuccessorNotificationParams {
  return { method, params };
}

/**
 * Check if a method is a proxy protocol method (starts with `_proxy/`)
 */
export function isProxyProtocolMethod(method: string): boolean {
  return method.startsWith("_proxy/");
}
