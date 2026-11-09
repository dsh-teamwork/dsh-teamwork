import { Context } from "@deepseek-ai/cordis";
import { Config } from "./index";

export class AccountService {
  private ctx: Context;
  private config: Config;
  private token: string | null = null;

  constructor(ctx: Context, config: Config) {
    this.ctx = ctx;
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.token = await this.loadToken();
    if (this.token) {
      this.ctx.logger.info("dsh-teamwork: authenticated");
    } else {
      this.ctx.logger.info("dsh-teamwork: not authenticated");
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const response = await fetch(`${this.config.apiEndpoint}/v1/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(`dsh-teamwork sign-in failed: ${response.status}`);
    }

    const data = await response.json() as { token: string };
    this.token = data.token;
    await this.saveToken(this.token);
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  getToken(): string | null {
    return this.token;
  }

  private async loadToken(): Promise<string | null> {
    // TODO: implement secure token storage
    return process.env.DSHTEAM_TOKEN ?? null;
  }

  private async saveToken(token: string): Promise<void> {
    // TODO: implement secure token storage
    process.env.DSHTEAM_TOKEN = token;
  }
}
