/**
 * Concrete implementation of IFileSystem using fs-extra
 */
import fs from 'fs-extra';
export class FileSystemImpl {
    // Basic fs operations
    async readFile(path, encoding) {
        return fs.readFile(path, encoding || 'utf-8');
    }
    async writeFile(path, data) {
        return fs.writeFile(path, data);
    }
    async exists(path) {
        try {
            await fs.access(path);
            return true;
        }
        catch {
            return false;
        }
    }
    async mkdir(path, options) {
        await fs.mkdir(path, options);
    }
    async readdir(path) {
        return fs.readdir(path);
    }
    async stat(path) {
        return fs.stat(path);
    }
    async unlink(path) {
        return fs.unlink(path);
    }
    async rmdir(path, options) {
        if (options?.recursive) {
            return fs.remove(path);
        }
        return fs.rmdir(path);
    }
    // fs-extra methods
    async ensureDir(path) {
        return fs.ensureDir(path);
    }
    ensureDirSync(path) {
        return fs.ensureDirSync(path);
    }
    async pathExists(path) {
        return fs.pathExists(path);
    }
    existsSync(path) {
        return fs.existsSync(path);
    }
    async remove(path) {
        return fs.remove(path);
    }
    async copy(src, dest) {
        return fs.copy(src, dest);
    }
    async outputFile(file, data) {
        return fs.outputFile(file, data);
    }
}
//# sourceMappingURL=file-system-impl.js.map