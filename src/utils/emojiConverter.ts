/**
 * Mapeamento de códigos de emoji do GitHub para Unicode
 */
const EMOJI_MAP: Record<string, string> = {
  ':white_check_mark:': '✅',
  ':heavy_check_mark:': '✔️',
  ':x:': '❌',
  ':warning:': '⚠️',
  ':star:': '⭐',
  ':rocket:': '🚀',
  ':bug:': '🐛',
  ':sparkles:': '✨',
  ':fire:': '🔥',
  ':pencil2:': '✏️',
  ':art:': '🎨',
  ':construction:': '🚧',
  ':green_heart:': '💚',
  ':lock:': '🔒',
  ':arrow_up:': '⬆️',
  ':arrow_down:': '⬇️',
  ':tada:': '🎉',
  ':memo:': '📝',
  ':package:': '📦',
  ':zap:': '⚡',
  ':lipstick:': '💄',
  ':recycle:': '♻️',
  ':wrench:': '🔧',
  ':hammer:': '🔨',
  ':globe_with_meridians:': '🌐',
  ':construction_worker:': '👷',
  ':chart_with_upwards_trend:': '📈',
  ':rewind:': '⏪',
  ':twisted_rightwards_arrows:': '🔀',
  ':pushpin:': '📌',
  ':alien:': '👽',
  ':truck:': '🚚',
  ':boom:': '💥',
  ':bento:': '🍱',
  ':wheelchair:': '♿',
  ':bulb:': '💡',
  ':beers:': '🍻',
  ':speech_balloon:': '💬',
  ':card_file_box:': '🗃️',
  ':loud_sound:': '🔊',
  ':mute:': '🔇',
  ':busts_in_silhouette:': '👥',
  ':children_crossing:': '🚸',
  ':building_construction:': '🏗️',
  ':iphone:': '📱',
  ':clown_face:': '🤡',
  ':egg:': '🥚',
  ':see_no_evil:': '🙈',
  ':camera_flash:': '📸',
  ':alembic:': '⚗️',
  ':mag:': '🔍',
  ':label:': '🏷️',
  ':seedling:': '🌱',
  ':triangular_flag_on_post:': '🚩',
  ':goal_net:': '🥅',
  ':dizzy:': '💫',
  ':wastebasket:': '🗑️',
  ':passport_control:': '🛂',
  ':adhesive_bandage:': '🩹',
  ':monocle_face:': '🧐',
  ':coffin:': '⚰️',
  ':test_tube:': '🧪',
  ':necktie:': '👔',
  ':stethoscope:': '🩺',
  ':bricks:': '🧱',
  ':technologist:': '🧑‍💻',
  ':money_with_wings:': '💸',
  ':thread:': '🧵',
  ':safety_vest:': '🦺',
};

/**
 * Converte códigos de emoji do GitHub (como :white_check_mark:) para emojis Unicode
 * @param text - Texto que pode conter códigos de emoji
 * @returns Texto com emojis convertidos
 */
export function convertGithubEmojis(text: string): string {
  let result = text;

  // Regex para encontrar padrões :emoji_name:
  const emojiRegex = /:([\w_]+):/g;

  result = result.replace(emojiRegex, (match) => {
    // Se encontrou mapeamento, substitui; caso contrário, mantém o original
    return EMOJI_MAP[match] || match;
  });

  return result;
}

/**
 * Verifica se um texto contém códigos de emoji do GitHub
 * @param text - Texto para verificar
 * @returns true se contém códigos de emoji
 */
export function hasGithubEmojis(text: string): boolean {
  return /:([\w_]+):/.test(text);
}
