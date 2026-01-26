/**
 * Component connectors - factories for creating component connections
 */

export { StdioConnector, stdio, type StdioConnectorOptions } from "./stdio.js";

export {
  ChannelConnector,
  createChannelPair,
  inProcess,
  echoComponent,
  type ChannelPair,
  type ComponentHandler,
} from "./channel.js";
