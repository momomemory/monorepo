declare module "openclaw/plugin-sdk" {
  export interface OpenClawPluginApi {
    pluginConfig: unknown;
    logger: {
      info: (msg: string, ...args: unknown[]) => void;
      warn: (msg: string, ...args: unknown[]) => void;
      error: (msg: string, ...args: unknown[]) => void;
      debug: (msg: string, ...args: unknown[]) => void;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerTool(tool: any, options: any): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCommand(command: any): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCli(handler: any, options?: any): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerService(service: any): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, handler: (...args: any[]) => any): void;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function stringEnum(values: readonly string[]): any;
}
