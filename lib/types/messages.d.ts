/**
 * The host's errors and results that the Teamwork panel can show. Everything
 * the host prints is English: `/teamwork` output, logs, the sign-in callback
 * page. Only while it answers one of the panel's requests (`speaking`) does it
 * word these in the panel's language: the Teamwork account's once the host has
 * read the profile, the system's before that (`setLocale`, `src/index.ts`).
 */
import { type Locale } from './locale.js';
declare const en: {
    'request.invalid': string;
    'request.failed': string;
    'request.missing': string;
    'field.team': string;
    'field.code': string;
    'field.server': string;
    'field.session': string;
    'field.config': string;
    'field.plugin': string;
    'field.version': string;
    'field.device': string;
    'field.key': string;
    'field.email': string;
    'field.workspace': string;
    'profile.nameTooLong': string;
    'profile.badLocale': string;
    'server.invalid': string;
    'server.https': string;
    'server.extra': string;
    'auth.signedOut': string;
    'auth.hostManaged': string;
    'auth.shared': string;
    'auth.changed': string;
    'summary.team': string;
    'summary.unavailable': string;
    'phone.notFound': string;
    'phone.relayBusy': string;
    'phone.relayOff': string;
    'use.pick': string;
    'use.modelGone': string;
    'model.noContextWindow': string;
    'use.missingTools': string;
    'use.started': string;
    'use.notLoaded': string;
    'use.done': string;
    'install.pick': string;
    'install.pinChanged': string;
    'install.noManager': string;
    'install.exists': string;
    'install.changed': string;
    'install.incomplete': string;
    'install.notEnabled': string;
    'install.restart': string;
    'install.done': string;
    'workspace.unknownTeam': string;
    'workspace.unknownDirectory': string;
};
export type HostMessage = keyof typeof en;
/** The language of the machine DSH runs on, which the panel speaks until the account's is known. */
export declare function systemLocale(): Locale;
/** The host has one member, so the panel has one language: the account's once read, the system's otherwise. */
export declare function setLocale(locale: Locale | null | undefined): void;
export declare function panelLocale(): Locale;
/** Runs one panel request, so what it says is in the panel's language. */
export declare function speaking<T>(locale: Locale, answer: () => T): T;
/** English, except inside `speaking`. */
export declare function say(key: HostMessage, values?: Record<string, string | number>): string;
export {};
//# sourceMappingURL=messages.d.ts.map