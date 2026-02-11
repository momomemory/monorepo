declare module "@mariozechner/pi-coding-agent" {
  import type { Static, TSchema } from "@sinclair/typebox";

  export interface ExtensionContext {
    hasUI: boolean;
    sessionManager: {
      getSessionFile(): string | undefined;
      appendEntry(entry: unknown): Promise<void>;
      getLeafEntry(): { id: string } | undefined;
    };
    ui: {
      notify(message: string, type: "info" | "success" | "warning" | "error"): void;
      confirm(title: string, message: string): Promise<boolean>;
      select<T extends string>(title: string, options: Array<T | { label: string; value: T }>): Promise<T | undefined>;
      input(title: string, placeholder?: string): Promise<string | undefined>;
      setStatus(id: string, status: string): void;
      setWidget(id: string, lines: string[]): void;
    };
  }

  export interface ToolDefinition<T extends TSchema = TSchema> {
    name: string;
    label: string;
    description: string;
    parameters: T;
    execute(
      toolCallId: string,
      params: Static<T>,
      signal: AbortSignal,
      onUpdate: (update: unknown) => void,
      ctx: ExtensionContext
    ): Promise<{
      content: Array<{ type: "text"; text: string }>;
      details?: Record<string, unknown>;
    }>;
  }

  export interface CommandDefinition {
    description?: string;
    handler: (args: string, ctx: ExtensionContext) => Promise<void>;
  }

  export interface ExtensionAPI {
    on(event: "session_start", handler: (event: Record<string, never>, ctx: ExtensionContext) => Promise<void | unknown>): void;
    on(event: "session_shutdown", handler: (event: Record<string, never>, ctx: ExtensionContext) => Promise<void | unknown>): void;
    on(event: "before_agent_start", handler: (event: BeforeAgentStartEvent, ctx: ExtensionContext) => Promise<void | BeforeAgentStartResult | undefined>): void;
    on(event: "agent_start", handler: (event: Record<string, never>, ctx: ExtensionContext) => Promise<void | unknown>): void;
    on(event: "agent_end", handler: (event: AgentEndEvent, ctx: ExtensionContext) => Promise<void | unknown>): void;
    on(event: "turn_start", handler: (event: TurnStartEvent, ctx: ExtensionContext) => Promise<void | unknown>): void;
    on(event: "turn_end", handler: (event: TurnEndEvent, ctx: ExtensionContext) => Promise<void | unknown>): void;
    on(event: "tool_call", handler: (event: ToolCallEvent, ctx: ExtensionContext) => Promise<void | ToolCallResult | undefined>): void;
    on(event: "tool_result", handler: (event: ToolResultEvent, ctx: ExtensionContext) => Promise<void | ToolResultModification | undefined>): void;
    on(event: "context", handler: (event: ContextEvent, ctx: ExtensionContext) => Promise<void | ContextResult | undefined>): void;
    on(event: string, handler: (event: unknown, ctx: ExtensionContext) => Promise<unknown>): void;

    registerTool<T extends TSchema>(tool: ToolDefinition<T>): void;
    registerCommand(name: string, definition: CommandDefinition): void;

    exec(command: string, args: string[]): Promise<{ stdout: string; stderr: string }>;

    logger: {
      info(msg: string, ...args: unknown[]): void;
      warn(msg: string, ...args: unknown[]): void;
      error(msg: string, ...args: unknown[]): void;
      debug(msg: string, ...args: unknown[]): void;
    };
  }

  export interface BeforeAgentStartEvent {
    prompt: string;
    images?: Array<{ data: string; mimeType: string }>;
    systemPrompt: string;
  }

  export interface BeforeAgentStartResult {
    message?: {
      customType: string;
      content: string;
      display?: boolean;
    };
    systemPrompt?: string;
  }

  export interface AgentEndEvent {
    messages: Array<unknown>;
    success?: boolean;
  }

  export interface TurnStartEvent {
    turnIndex: number;
    timestamp: number;
  }

  export interface TurnEndEvent {
    turnIndex: number;
    message: unknown;
    toolResults?: Array<unknown>;
  }

  export interface ToolCallEvent {
    toolName: string;
    toolCallId: string;
    input: Record<string, unknown>;
  }

  export interface ToolCallResult {
    block?: boolean;
    reason?: string;
  }

  export interface ToolResultEvent {
    toolName: string;
    toolCallId: string;
    input: Record<string, unknown>;
    result: unknown;
  }

  export interface ToolResultModification {
    result?: unknown;
  }

  export interface ContextEvent {
    messages: Array<unknown>;
  }

  export interface ContextResult {
    messages: Array<unknown>;
  }

  export function isToolCallEventType<T extends string>(
    toolName: T,
    event: ToolCallEvent
  ): event is ToolCallEvent & { input: Record<string, unknown> };
}
