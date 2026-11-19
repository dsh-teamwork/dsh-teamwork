export declare const teamWorkspacesPath: (cachePath: string) => string;
export declare class TeamWorkspaces {
    private readonly path;
    private state?;
    private writes;
    constructor(path: string);
    private load;
    /** Every listed team's default among `directories`: its saved choice, else `fallback`. */
    defaults(teamIds: readonly string[], directories: readonly string[], fallback: string | undefined): Promise<Record<string, string>>;
    /** Saves a team's default; the caller has checked the team and that `path` is one of the offered directories. */
    set(teamId: string, path: string): Promise<void>;
}
//# sourceMappingURL=team-workspaces.d.ts.map