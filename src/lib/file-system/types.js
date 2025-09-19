/**
 * File System Module Types
 * Clean, minimal type definitions for file operations
 */

/**
 * @typedef {Object} FileNode
 * @property {string} path - Full path to the file/directory
 * @property {string} name - Name of the file/directory
 * @property {'file' | 'directory' | 'symlink'} type - Type of file system node
 * @property {number} size - Size in bytes
 * @property {Date} modified - Last modified date
 * @property {boolean} isHidden - Whether the file is hidden
 * @property {string} [extension] - File extension
 * @property {string} [permissions] - File permissions
 * @property {'git' | 'node' | 'python' | 'bun' | 'unknown'} [projectType] - Detected project type
 */

/**
 * @typedef {Object} DirectoryListing
 * @property {string} path - Directory path
 * @property {string} [parent] - Parent directory path
 * @property {FileNode[]} nodes - Array of file/directory nodes
 */

/**
 * @typedef {Object} FileContent
 * @property {string} path - File path
 * @property {string} content - File content
 * @property {'utf8' | 'base64'} encoding - Content encoding
 * @property {string} [language] - Detected language
 * @property {number} size - Content size in bytes
 */

/**
 * @typedef {Object} SearchOptions
 * @property {string} query - Search query
 * @property {string} [path] - Path to search in
 * @property {number} [maxDepth] - Maximum search depth
 * @property {boolean} [includeHidden] - Include hidden files
 * @property {number} [limit] - Maximum results to return
 */

/**
 * @typedef {Object} SearchResult
 * @property {string} path - File path
 * @property {string} name - File name
 * @property {'file' | 'directory'} type - File type
 * @property {number} score - Relevance score
 * @property {string} [preview] - Content preview
 */

/**
 * @typedef {Object} TerminalCommand
 * @property {string} command - Command to execute
 * @property {string} [cwd] - Working directory
 * @property {number} [timeout] - Timeout in milliseconds
 */

/**
 * @typedef {Object} TerminalOutput
 * @property {string} stdout - Standard output
 * @property {string} stderr - Standard error
 * @property {number | null} exitCode - Exit code
 * @property {number} duration - Execution duration in ms
 */

/**
 * @typedef {Object} Result
 * @template T
 * @property {boolean} ok - Whether the operation succeeded
 * @property {T} [value] - The result value if successful
 * @property {Error} [error] - The error if failed
 */