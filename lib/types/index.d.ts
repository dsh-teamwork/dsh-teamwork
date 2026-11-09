import { Context } from "@deepseek-ai/cordis";

export interface Config {
  apiEndpoint: string;
  autoSync: boolean;
  syncIntervalMs: number;
}

export const name: string;
export const Config: import("@deepseek-ai/cordis").Schema<Config>;
export const inject: string[];
export function apply(ctx: Context, config: Config): void;
