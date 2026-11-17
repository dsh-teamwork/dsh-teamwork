/**
 * What the host half says to a member, in the member's language: the errors and
 * results the Teamwork panel shows, and the page the browser lands on after
 * sign-in. The language is the Teamwork account's once the host has read the
 * profile, and the system's before that (`setLocale`, `src/index.ts`).
 *
 * The `/teamwork` command's own report text is not here yet and stays Chinese.
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
    'profile.nameTooLong': string;
    'profile.badLocale': string;
    'server.invalid': string;
    'server.https': string;
    'server.extra': string;
    'auth.signedOut': string;
    'auth.hostManaged': string;
    'auth.changed': string;
    'summary.team': string;
    'summary.unavailable': string;
    'sync.failed': string;
    'sync.signIn': string;
    'phone.notFound': string;
    'phone.relayBusy': string;
    'phone.relayOff': string;
    'use.pick': string;
    'use.modelGone': string;
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
    'callback.doneTitle': string;
    'callback.doneBody': string;
    'callback.failTitle': string;
    'callback.failReason': string;
    'callback.failBody': string;
};
export type HostMessage = keyof typeof en;
/** The language of the machine DSH runs on, used until the account's is known. */
export declare function systemLocale(): Locale;
/** The host has one member, so one language at a time: the account's once read, the system's otherwise. */
export declare function setLocale(locale: Locale | null | undefined): void;
export declare function currentLocale(): Locale;
export declare function say(key: HostMessage, values?: Record<string, string | number>): string;
export {};
//# sourceMappingURL=messages.d.ts.map