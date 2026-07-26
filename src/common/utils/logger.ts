// ========================================================================= //
//                                  Classes                                  //
// ========================================================================= //
// Wrap the logging functions so we can control behavior depending on the
// environment (i.e. unit-testing).
//
// NOTE: this isn't a name space object, we do need call setters on it
// depending on the environment.

class Logger {
  private printInfoFn = (content: unknown) => console.log(content);
  private printWarnFn = (content: unknown) => console.warn(content);

  public info(content: unknown): void {
    return this.printInfoFn(content);
  }

  public warn(content: unknown): void {
    if (typeof content === 'string' && !content.startsWith('Warning')) {
      content = 'Warning: ' + content;
    }
    return this.printWarnFn(content);
  }

  public setPrintInfoFn(fn: (content: unknown) => void): void {
    this.printInfoFn = fn;
  }

  public setPrintWarnFn(fn: (content: unknown) => void): void {
    this.printWarnFn = fn;
  }
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default new Logger();
