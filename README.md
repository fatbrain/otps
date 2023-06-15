# otps

Command line argument parser with format inspired by [esbuild]

- value: `--format esm` or short `-f esm`
- flag: `-v`, `-vPfz` or `-vvv`
- key/value: `--format:ts esm` or `-f:ts esm`
- key: `--external:fs` or short `-e:fs`

Supports sub-commands, see below.

[esbuild]: https://esbuild.github.io/

# Getting started

Install `otps` using [pnpm]:

```sh
pnpm add otps
```

Or [npm]:

```sh
npm install --save otps
```

[pnpm]: https://pnpm.io/
[npm]: https://www.npmjs.com/

Let's get started by writing a simple command line application that takes one
parameter named `format` (or `f` for short).

First, create a `app.js` file:

```js
import { parse, Value } from 'otps'
const [params, args] = parse(process.argv.slice(2), {
  format: Value(),
  f: 'format',
})
```

Then run the program:

```sh
node app.js --format esm index.ts
# => params: { format: 'esm' }
#    args: ['index.ts']
```

Or equivalent:

```sh
node app.js -f esm index.ts
# => params: { format: 'esm' }
#    args: ['index.ts']
```

## Sub commands

Let's create a more advanced app that uses a `verbose` parameter (with a `v`
alias) and a sub-commands `build` with a `level` parameter that takes one of
two values `debug` or `info`.

Create a `subcmdapp.js` file:

```js
import { parse, Flag, OneOf } from 'otps'
const [params, args] = parse(process.argv.slice(2), {
  verbose: Flag(),
  v: 'verbose',
  build: {
    level: OneOf('debug', 'info'),
  },
})
```

Then run the program:

```sh
node subcmdapp.js -vvv build --level info index.ts
# => params: { verbose: 3, build: { level: 'info' } }
#    args: ['index.ts']
```

## Using `cmds`

For easier managment of sub-commands, use `cmds`.

Create a `cmdsapp.js` file:

```js
import { parse, Value, cmds } from 'otps'

const [params, args] = parse(process.argv.slice(2), {
  build: {
    format: Value(),
    production: {
      version: Value(),
    },
  },
})

cmds(params, args)({
  build(params, args) {
    const format = params.format
    cmds(params, args)({
      production(params, args) {
        const version = params.version
        console.log(`production build: ${format}, name: app@${version}`)
        console.log(args)
      }
    }, (params, args) => {
      console.log(`development build: ${format}, name: app@dev`, args)
      console.log(args)
    })
  }
})
```

Then run the program:

```sh
node cmdsapp.js build --format esm production --version 1.0 src/index.ts
# => production build: esm, name: app@1.0
#    ['src/index.ts']

node cmdsapp.js build --format esm src/index.ts
# => production build: esm, name: app@dev
#    ['src/index.ts']
```


## Parameters

Parameters are defined using the following syntax: `{ name: Func }` or with aliases `{ name: Func, n: 'name' }`. Where `Func` is one of:

`Value()`:

```js
parse(['--format', 'esm'], { format: Value() })
// => { format: 'esm' }
```

`OneOf(string | regex, ...)`:

```js
parse(['--level', 'dEbUg'], { level: OneOf(/^debug$/i, 'info') })
// => { level: 'dEbUg' }
```

`Flag()`:

```js
parse(['-v'], { v: Flag() })
// => { v: true }
parse(['-vvv'], { v: Flag() })
// => { v: 3 }
parse(['-vP'], { v: Flag(), P: Flag() })
// => { v: true, P: true }
```

`Key()`:

```js
parse(['--external:fs'], { external: Key() })
// => { external: { fs: true } }
parse(['--external:fs', '-e:fs'], { external: Key(), e: 'external' })
// => { external: { fs: 2 } }
```

`Key(Value() | OneOf(...))`:

```js
parse(['--define:DEBUG', 'true'], { define: Key(Value()) })
// => { define: { DEBUG: 'true' } }
parse(['--define:LEVEL', 'debug'], { define: Key(OneOf('debug', 'info')) })
// => { define: { LEVEL: 'debug' } }
```

`Maybe(Value() | OneOf(...))`:

```js
parse(['--format'], { format: Maybe(Value()) })
// => { format: true }
parse(['--format', 'esm'], { format: Maybe(Value()) })
// => { format: 'esm' }
parse(['--level'], { level: Maybe(OneOf('debug', 'info')) })
// => { level: true }
parse(['--level', 'info'], { level: Maybe(OneOf('debug', 'info')) })
// => { level: 'info' }
```

`Many(Value() | OneOf(...) | Maybe(...))`:

```js
parse(['--format', 'esm', '--format', 'cjs'], { format: Many(Value()) })
// => { format: ['esm', 'cjs'] }
parse(['--format', '--format', 'cjs'], { format: Many(Maybe(OneOf('esm', 'cjs'))) })
// => { format: [true, 'cjs'] }
```
