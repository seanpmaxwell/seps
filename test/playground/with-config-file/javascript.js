// @reg Constants

const foo = 'bar';

// @reg Functions

function bar() {
    return () => 'foo';
}

// @sec Configured Functions

const fooBar = bar();

// @reg Export

export default fooBar;
