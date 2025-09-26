/**
 * Line reader utility for efficient file line reading with context
 * Used for breakpoint context and source context operations
 */
import { IFileSystem } from '@debugmcp/shared';
/**
 * Line context information
 */
export interface LineContext {
    lineContent: string;
    surrounding: Array<{
        line: number;
        content: string;
    }>;
}
/**
 * Options for line reading
 */
export interface LineReaderOptions {
    contextLines?: number;
    maxFileSize?: number;
    encoding?: BufferEncoding;
}
/**
 * Line reader with caching support
 */
export declare class LineReader {
    private readonly fileSystem;
    private readonly logger?;
    private fileCache;
    constructor(fileSystem: IFileSystem, logger?: {
        debug: (msg: string, meta?: unknown) => void;
    } | undefined);
    /**
     * Check if file is likely binary based on content sampling
     */
    private isBinaryContent;
    /**
     * Read all lines from a file with caching
     */
    private readFileLines;
    /**
     * Get line context for a specific line number
     */
    getLineContext(filePath: string, lineNumber: number, options?: LineReaderOptions): Promise<LineContext | null>;
    /**
     * Get source context for multiple lines (useful for stack traces)
     */
    getMultiLineContext(filePath: string, startLine: number, endLine: number, options?: LineReaderOptions): Promise<string[] | null>;
    /**
     * Clear the file cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        itemCount: number;
    };
}
/**
 * Factory function to create a LineReader instance
 */
export declare function createLineReader(fileSystem: IFileSystem, logger?: {
    debug: (msg: string, meta?: unknown) => void;
}): LineReader;
