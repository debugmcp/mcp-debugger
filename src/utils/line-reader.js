import { LRUCache } from 'lru-cache';
/**
 * Line reader with caching support
 */
export class LineReader {
    fileSystem;
    logger;
    // LRU cache for recently read files (max 20 files, max age 5 minutes)
    fileCache = new LRUCache({
        max: 20,
        ttl: 1000 * 60 * 5, // 5 minutes
    });
    constructor(fileSystem, logger) {
        this.fileSystem = fileSystem;
        this.logger = logger;
    }
    /**
     * Check if file is likely binary based on content sampling
     */
    isBinaryContent(content, sampleSize = 8192) {
        const sample = content.slice(0, Math.min(sampleSize, content.length));
        // Check for null bytes (strong indicator of binary)
        if (sample.includes('\0')) {
            return true;
        }
        // Check for high ratio of non-printable characters
        let nonPrintable = 0;
        for (let i = 0; i < sample.length; i++) {
            const charCode = sample.charCodeAt(i);
            // Count non-printable chars (excluding common whitespace)
            if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
                nonPrintable++;
            }
        }
        // If more than 30% non-printable, likely binary
        return (nonPrintable / sample.length) > 0.3;
    }
    /**
     * Read all lines from a file with caching
     */
    async readFileLines(filePath, options) {
        // Check cache first
        const cached = this.fileCache.get(filePath);
        if (cached) {
            this.logger?.debug(`[LineReader] Cache hit for: ${filePath}`);
            return cached;
        }
        try {
            // Check file size
            const stats = await this.fileSystem.stat(filePath);
            const maxSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB default
            if (stats.size > maxSize) {
                this.logger?.debug(`[LineReader] File too large: ${filePath} (${stats.size} bytes)`);
                return null;
            }
            // Read file content
            const content = await this.fileSystem.readFile(filePath, options.encoding || 'utf8');
            // Check if binary
            if (this.isBinaryContent(content)) {
                this.logger?.debug(`[LineReader] Binary file detected: ${filePath}`);
                return null;
            }
            // Split into lines, preserving empty lines
            const lines = content.split(/\r?\n/);
            // Handle empty file case
            if (lines.length === 1 && lines[0] === '') {
                this.logger?.debug(`[LineReader] Empty file: ${filePath}`);
                return null;
            }
            // Cache the result
            this.fileCache.set(filePath, lines);
            this.logger?.debug(`[LineReader] Cached file: ${filePath} (${lines.length} lines)`);
            return lines;
        }
        catch (error) {
            this.logger?.debug(`[LineReader] Error reading file: ${filePath}`, { error });
            return null;
        }
    }
    /**
     * Get line context for a specific line number
     */
    async getLineContext(filePath, lineNumber, options = {}) {
        const contextLines = options.contextLines ?? 2;
        // Read file lines
        const lines = await this.readFileLines(filePath, options);
        if (!lines) {
            return null;
        }
        // Validate line number (1-based)
        if (lineNumber < 1 || lineNumber > lines.length) {
            this.logger?.debug(`[LineReader] Line ${lineNumber} out of range for ${filePath} (1-${lines.length})`);
            return null;
        }
        // Get the target line content (convert to 0-based index)
        const lineContent = lines[lineNumber - 1];
        // Calculate surrounding lines range
        const startLine = Math.max(1, lineNumber - contextLines);
        const endLine = Math.min(lines.length, lineNumber + contextLines);
        // Build surrounding context
        const surrounding = [];
        for (let i = startLine; i <= endLine; i++) {
            surrounding.push({
                line: i,
                content: lines[i - 1]
            });
        }
        return {
            lineContent,
            surrounding
        };
    }
    /**
     * Get source context for multiple lines (useful for stack traces)
     */
    async getMultiLineContext(filePath, startLine, endLine, options = {}) {
        // Read file lines
        const lines = await this.readFileLines(filePath, options);
        if (!lines) {
            return null;
        }
        // Validate line numbers
        const validStart = Math.max(1, startLine);
        const validEnd = Math.min(lines.length, endLine);
        if (validStart > lines.length) {
            return null;
        }
        // Extract requested lines (convert to 0-based)
        return lines.slice(validStart - 1, validEnd);
    }
    /**
     * Clear the file cache
     */
    clearCache() {
        this.fileCache.clear();
        this.logger?.debug('[LineReader] Cache cleared');
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.fileCache.size,
            itemCount: this.fileCache.size // LRUCache uses 'size' for item count
        };
    }
}
/**
 * Factory function to create a LineReader instance
 */
export function createLineReader(fileSystem, logger) {
    return new LineReader(fileSystem, logger);
}
//# sourceMappingURL=line-reader.js.map