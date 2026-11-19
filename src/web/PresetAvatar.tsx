/**
 * A team preset's avatar in the panel, drawn from `avatars.ts`: a byte-for-byte
 * copy of the platform's shared library, which the platform's end-to-end suite
 * holds equal, so the panel, the web console and the phone show the same one.
 */
import { PRESET_AVATAR_STYLE as STYLE, presetAvatar, presetAvatarColor } from './avatars.js';

/** The avatar `avatar` names, or the one the preset's `name` picks when it names none this panel knows. */
export function PresetAvatar({ avatar, name }: { avatar?: string; name: string }) {
  const shown = presetAvatar(avatar, name);
  return (
    <svg viewBox={`0 0 ${STYLE.size} ${STYLE.size}`} aria-hidden="true">
      <rect width={STYLE.size} height={STYLE.size} rx={STYLE.radius} fill={shown.plate} />
      {shown.layers.map((layer, i) => (
        <path key={i} d={layer.d} fill={layer.fill ? presetAvatarColor(shown, layer.fill) : 'none'}
          stroke={layer.stroke ? presetAvatarColor(shown, layer.stroke) : undefined} strokeWidth={layer.width ?? 1}
          strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
