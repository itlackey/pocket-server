/**
 * Terminal UI utilities with ASCII art and formatting
 */

// ANSI color codes
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
};

// ASCII Art for POCKET SERVER
export const POCKET_SERVER_LOGO = `
${colors.brightCyan}  ___  ___   ___ _  _____ _____    ___ ___ _____   _____ ___ 
 | _ \\/ _ \\ / __| |/ / __|_   _|  / __| __| _ \\ \\ / / __| _ \\
 |  _/ (_) | (__| ' <| _|  | |   \\__ \\ _||   /\\ V /| _||   /
 |_|  \\___/ \\___|_|\\_\\___| |_|   |___/___|_|_\\ \\_/ |___|_|_\\${colors.reset}
`;

// Box drawing characters
export const box = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  cross: '┼',
  teeUp: '┴',
  teeDown: '┬',
  teeLeft: '┤',
  teeRight: '├',
};

/**
 * Create a styled box with content
 * @param {string[]} content
 * @param {number} [width=60]
 * @param {string} [title]
 * @returns {string}
 */
export function createBox(content, width = 60, title) {
  const lines = [];
  
  // Top border
  if (title) {
    const titlePadding = Math.max(0, width - title.length - 4);
    const leftPad = Math.floor(titlePadding / 2);
    const rightPad = titlePadding - leftPad;
    lines.push(`${box.topLeft}${box.horizontal.repeat(leftPad + 1)} ${colors.bright}${title}${colors.reset} ${box.horizontal.repeat(rightPad + 1)}${box.topRight}`);
  } else {
    lines.push(`${box.topLeft}${box.horizontal.repeat(width)}${box.topRight}`);
  }
  
  // Content lines
  content.forEach(line => {
    const padding = Math.max(0, width - line.length);
    lines.push(`${box.vertical} ${line}${' '.repeat(padding - 1)} ${box.vertical}`);
  });
  
  // Bottom border
  lines.push(`${box.bottomLeft}${box.horizontal.repeat(width)}${box.bottomRight}`);
  
  return lines.join('\n');
}

/**
 * Create startup banner with ASCII art and server info
 * @param {number} port
 * @param {boolean} [tunnelEnabled=false]
 * @returns {string}
 */
export function createStartupBanner(port, tunnelEnabled = false) {
  const lines = [
    '',
    POCKET_SERVER_LOGO,
    '',
    `${colors.brightGreen}    🚀 Server Status: ${colors.bright}ONLINE${colors.reset}`,
    `${colors.brightBlue}    📡 Port: ${colors.bright}${port}${colors.reset}`,
    `${colors.brightYellow}    🔗 WebSocket: ${colors.bright}ws://localhost:${port}/ws${colors.reset}`,
    `${colors.brightMagenta}    💚 Health Check: ${colors.bright}http://localhost:${port}/health${colors.reset}`,
    '',
  ];
  
  if (tunnelEnabled) {
    lines.splice(-1, 0, `${colors.brightCyan}    🌐 Remote Tunnel: ${colors.bright}ENABLED${colors.reset}`);
  }
  
  return lines.join('\n');
}

/**
 * Create network URLs display
 * @param {string[]} urls
 * @returns {string}
 */
export function createNetworkInfo(urls) {
  if (urls.length === 0) return '';
  
  const lines = [
    `${colors.brightCyan}🔗 Local Network Access:${colors.reset}`,
    ...urls.map(url => `   ${colors.gray}•${colors.reset} ${colors.bright}${url}${colors.reset}`)
  ];
  
  return lines.join('\n');
}

/**
 * Format log level with colors
 * @param {string} level
 * @returns {string}
 */
export function formatLogLevel(level) {
  switch (level.toUpperCase()) {
    case 'DEBUG':
      return `${colors.gray}DEBUG${colors.reset}`;
    case 'INFO':
      return `${colors.brightBlue}INFO ${colors.reset}`;
    case 'WARN':
      return `${colors.brightYellow}WARN ${colors.reset}`;
    case 'ERROR':
      return `${colors.brightRed}ERROR${colors.reset}`;
    default:
      return level.padEnd(5);
  }
}

/**
 * Format category with colors
 * @param {string} category
 * @returns {string}
 */
export function formatCategory(category) {
  /** @type {Record<string, string>} */
  const categoryColors = {
    'HTTP': colors.brightGreen,
    'WebSocket': colors.brightCyan,
    'Terminal': colors.brightMagenta,
    'Agent': colors.brightYellow,
    'Tunnel': colors.brightBlue,
    'Auth': colors.brightRed,
    'CloudCursor': colors.brightCyan,
    'GitHub': colors.gray,
    'Notifications': colors.brightMagenta,
  };
  
  const color = categoryColors[category] || colors.white;
  return `${color}${category.padEnd(12)}${colors.reset}`;
}