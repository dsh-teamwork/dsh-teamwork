export declare const teamWorkspacesPath: (cachePath: string) => string;
export declare class TeamWorkspaces {
    private readonly path;
    private state?;
    private writes;
    constructor(path: string);
    private load;
    /** Every listed team's default among `directories`, the first of which is where DSH was started. */
    defaults(teamIds: readonly string[], directories: readonly string[]): Promise<Record<string, string>>;
    /** Saves a team's default; the caller has checked the team and that `path` is one of the offered directories. */
    set(teamId: string, path: string): Promise<void>;
}
//# sourceMappingURL=team-workspaces.d.ts.map