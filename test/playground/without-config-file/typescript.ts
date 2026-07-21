// @reg Constants

const foo: string = 'bar';

// @reg Functions

function bar(): () => string {
    return () => 'foo';
}

// @sec Configured Functions

const fooBar = bar();

// @reg Export

export default fooBar;
