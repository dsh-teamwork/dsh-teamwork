import { readFile } from 'node:fs/promises';
import { unwatchFile, watchFile } from 'node:fs';
/**
 * Follows a token file written by the host's supervisor, as on a cloud computer: reads it now, and again whenever
 * it changes, including when it is replaced. `onToken` hears the trimmed contents only when they change; a missing
 * or empty file is no token. Polling (`watchFile`) is used because a supervisor replaces the file atomically,
 * which a directory watch can miss.
 */
export function watchTokenFile(path, onToken, onError, intervalMs = 1000) {
    let last = null;
    let flight = Promise.resolve();
    const read = () => {
        flight = flight.then(async () => {
            let token;
            try {
                token = (await readFile(path, 'utf8')).trim() || undefined;
            }
            catch (error) {
                if (error.code !== 'ENOENT')
                    onError(error);
                token = undefined;
            }
            if (token === last)
                return;
            last = token;
            await onToken(token);
        }).catch(error => onError(error));
        return flight;
    };
    const listener = () => void read();
    watchFile(path, { interval: intervalMs, persistent: false }, listener);
    return { ready: read(), stop: () => unwatchFile(path, listener) };
}
//# sourceMappingURL=token-file.js.map