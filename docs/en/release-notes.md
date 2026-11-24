# Release notes

## Next release

- The knowledge guide in every session now says what the richer format
  means: a document's front matter may give its owner, status, tags and
  summary, and a draft or outdated status is named beside its citation;
  `[[Title]]` links a document, a `> [!kind]` quote is a callout and a
  `mermaid` block is a diagram, written the same way in a proposal.
- Knowledge attachments. A document's images and files are synced read-only
  beside it, in `{title}.files/{name}`, fetched only when new or changed and
  moved with their document; the agent is told where they are and that the
  text names them as `![[name]]` or `[[name]]`. `teamwork_knowledge`'s
  `propose` takes `attachments`, files in the session's folder of at most
  20 MiB each, and uploads them under their file names before the proposal;
  a name the document already holds with other bytes stops it, for the agent
  to rename its file. It needs a Teamwork server with knowledge attachments
  (the manifest's `attachments`); against an older one the sync fails.
- Teamwork knowledge, synced read-only for agents, and the `teamwork_knowledge`
  tool to propose changes. Each sync keeps a read-only copy of every knowledge
  document (page) the member may read in `teamwork-knowledge` beside the cache
  (`{team}/{space}/{folder…}/{title}.md`, each opening with
  `knowledge: {documentId}@{version}`), fetching only new and changed
  documents and deleting what the member no longer reads; signing out removes
  it. Every session is told where the copy is, to cite
  `knowledge:{documentId}@{version}#{heading}`, and to change a document only
  by proposing; an editor accepts or declines the proposal. It needs a
  Teamwork server with the knowledge routes (`GET /api/knowledge`); against
  an older one the copy stays empty.
- Breaking: this release needs a Teamwork server with the renamed routes
  (platform ADR 0069); an older server refuses it, and an older plugin is
  refused by a new server. What an agent publishes is an artifact: the tool
  `teamwork_page` is now `teamwork_artifact`, its `pageId` argument and result
  field are `artifactId`, its card is `presentationMeta.teamworkArtifact`, its
  link is `/teams/{teamId}/artifacts/{id}`, and it calls
  `/api/teams/{teamId}/artifacts/*`. The `markdown` kind is gone; an artifact
  is `html` or `svg`. Private plugin archives are packages: a plugin pin's
  `artifactId` is `packageId`, downloads come from
  `/api/teams/{teamId}/packages/{id}/download`, and the cache beside the
  configuration is `teamwork-packages` (an old `teamwork-artifacts` folder is
  no longer read and can be deleted).
- A session list names each workspace's registered parent folders
  (`teamwork.workspace.ancestors`: id, title and place, root first), so the
  console and the app can show workspaces as a tree. Folder paths stay on this
  computer; a Windows path matches its parent in any case and with either
  separator.
- A paired phone or browser manages this computer's automation tasks (DSH's
  Schedule): the bridge passes on `schedule/catalog`, `history`, `create`,
  `edit` and `run` unchanged, and the server's console and app draw them.
- Team DSH (a shared DSH signed in with a team host key) is removed. The
  `dsh-teamwork-audit` command and the `@hpke/core` dependency go with it. A
  DSH left in shared mode by an older plugin no longer cleans up its
  `<cache>.shared.json`, `<cache>.shared-roster.json` and `<cache>.audit.json*`
  files; nothing reads them, and they can be deleted.
- Native Web Relay adds the runtime dependency `ws@8.23.0`. The outbound
  desktop connector uses its WebSocket stream to apply backpressure to uploads.
