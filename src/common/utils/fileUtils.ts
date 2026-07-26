import fs, { Dirent } from 'fs';

// ========================================================================= //
//                                  Classes                                  //
// ========================================================================= //
// During a dry-run, we want to skip modifying files. To create consistency,
// I just decided to wrap the other "fs" library functions too.

class FileUtils {
  private isDryRun = false;
  private static readonly ENCODING = 'utf8';

  public setIsDryRun(value: boolean): void {
    this.isDryRun = value;
  }

  public getIsDryRun(): boolean {
    return this.isDryRun;
  }

  /**
   * Replace a file's content with the "content:" param, unless doing a
   * dry-run.
   */
  public write(targetPath: string, content: string): void {
    if (!this.isDryRun) {
      fs.writeFileSync(targetPath, content, FileUtils.ENCODING);
    }
  }

  /**
   * Return a file's contents
   */
  public read(path: string): string {
    return fs.readFileSync(path, FileUtils.ENCODING);
  }

  /**
   * Check if the targetPath is a directory (folder).
   */
  public isDir(targetPath: string): boolean {
    return fs.statSync(targetPath).isDirectory();
  }

  /**
   * Fetch a list (non-recursively) of the files in a directory.
   */
  public fetchDirFiles(targetPath: string): Dirent<string>[] {
    return fs.readdirSync(targetPath, { withFileTypes: true });
  }

  /**
   * Check if a file exists.
   */
  public exists(target: string): boolean {
    return fs.existsSync(target);
  }
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default new FileUtils();
