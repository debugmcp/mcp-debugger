import { Stats } from 'fs';
import { IFileSystem } from '@debugmcp/shared';
export declare class FileSystemImpl implements IFileSystem {
    readFile(path: string, encoding?: BufferEncoding): Promise<string>;
    writeFile(path: string, data: string | Buffer): Promise<void>;
    exists(path: string): Promise<boolean>;
    mkdir(path: string, options?: {
        recursive?: boolean;
    }): Promise<void>;
    readdir(path: string): Promise<string[]>;
    stat(path: string): Promise<Stats>;
    unlink(path: string): Promise<void>;
    rmdir(path: string, options?: {
        recursive?: boolean;
    }): Promise<void>;
    ensureDir(path: string): Promise<void>;
    ensureDirSync(path: string): void;
    pathExists(path: string): Promise<boolean>;
    existsSync(path: string): boolean;
    remove(path: string): Promise<void>;
    copy(src: string, dest: string): Promise<void>;
    outputFile(file: string, data: string | Buffer): Promise<void>;
}
