import { Context } from "@deepseek-ai/cordis";

export interface Config {
  apiEndpoint: string;
  autoSync: boolean;
  syncIntervalMs: number;
}

export const name: string;
export const inject: string[];
export function apply(ctx: Context, config: Config): void;
