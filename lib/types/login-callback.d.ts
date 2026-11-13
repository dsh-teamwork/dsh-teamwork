/**
 * The loopback listener that takes the sign-in code back from the browser, so
 * nobody has to copy it (platform repository,
 * docs/adr/0012-the-plugin-gets-its-code-back-on-loopback.md).
 *
 * It listens on 127.0.0.1 only, on a port the system picks, from `/teamwork
 * login` until a code redeems or ten minutes pass. Anything on this machine can
 * deliver a code here, but a code redeems only with the verifier this plugin
 * holds; one that fails leaves the listener open for the real one.
 */
export declare const CALLBACK_PATH = "/callback";
export interface LoginCallback {
    /** The address the sign-in page sends the browser to, with `?code=…`. */
    uri: string;
    close(): void;
}
export declare function listenForCode(redeem: (code: string) => Promise<void>, ttlMs?: number): Promise<LoginCallback>;
//# sourceMappingURL=login-callback.d.ts.map