import { Flag, Key, Many, Maybe, OneOf, Value, cmds, parse } from './index'

const format = { format: Value(), f: 'format' }
const manyFormat = { format: Many(Value()), f: 'format' }
const maybeFormat = { format: Maybe(Value()), f: 'format' }
const manyMaybeFormat = { format: Many(Maybe(Value())) }
const v = { v: Flag() }
const levelString = { level: OneOf('info', 'debug') }
const levelRegex = { level: OneOf(/^info$/i, /^debug$/i) }
const maybeLevel = { level: Maybe(OneOf('debug', /^info$/i)) }

test('README.md: app.js: --format esm index.ts', () => {
  const [params, argv] = parse(['--format', 'esm', 'index.ts'], {
    format: Value(),
    f: 'format',
  })
  expect(params).toEqual({ format: 'esm' })
  expect(argv).toEqual(['index.ts'])
})

test('README.md: app.js: -f esm index.ts', () => {
  const [params, argv] = parse(['-f', 'esm', 'index.ts'], {
    format: Value(),
    f: 'format',
  })
  expect(params).toEqual({ format: 'esm' })
  expect(argv).toEqual(['index.ts'])
})

test('README.md: subcmdapp.js: -vvv build --level info index.ts', () => {
  const [params, argv] = parse(
    ['-vvv', 'build', '--level', 'info', 'index.ts'],
    {
      verbose: Flag(),
      v: 'verbose',
      build: {
        level: OneOf('debug', 'info'),
      },
    },
  )
  expect(params).toEqual({ verbose: 3, build: { level: 'info' } })
  expect(argv).toEqual(['index.ts'])
})

test('README.md: cmdsapp.js: build --format esm production --version 1.0 src/index.ts', () => {
  const [params, args] = parse(
    [
      'build',
      '--format',
      'esm',
      'production',
      '--version',
      '1.0',
      'src/index.ts',
    ],
    {
      build: {
        format: Value(),
        production: {
          version: Value(),
        },
      },
    },
  )

  cmds(
    params,
    args,
  )({
    build(params, args) {
      expect(params.format).toBe('esm')
      cmds(
        params,
        args,
      )({
        production(params, args) {
          expect(params.version).toBe('1.0')
          expect(args).toEqual(['src/index.ts'])
        },
      })
    },
  })

  expect.assertions(3)
})

test('README.md: cmdsapp.js: build --format esm src/index.ts', () => {
  const [params, args] = parse(
    [
      'build',
      '--format',
      'esm',
      'src/index.ts',
    ],
    {
      build: {
        format: Value(),
        production: {
          version: Value(),
        },
      },
    },
  )

  cmds(
    params,
    args,
  )({
    build(params, args) {
      expect(params.format).toBe('esm')
      cmds(
        params,
        args,
      )({
        production(params, args) {
        },
      }, (params, args) => {
        expect(args).toEqual(['src/index.ts'])
      })
    },
  })

  expect.assertions(2)
})

test('README.md: Value()', () => {
  const [params] = parse(['--format', 'esm'], { format: Value() })
  expect(params.format).toBe('esm')
})

test('README.md: OneOf(string | regex, ...)', () => {
  const [params] = parse(['--level', 'dEbUg'], {
    level: OneOf(/^debug$/i, 'info'),
  })
  expect(params.level).toBe('dEbUg')
})

test('README.md: Flag()', () => {
  expect(parse(['-v'], { v: Flag() })).toEqual([{ v: true }, []])
  expect(parse(['-vvv'], { v: Flag() })).toEqual([{ v: 3 }, []])
  // => { v: 3 }
  expect(parse(['-vP'], { v: Flag(), P: Flag() })).toEqual([
    {
      v: true,
      P: true,
    },
    [],
  ])
})

test('README.md: Key()', () => {
  expect(parse(['--external:fs'], { external: Key() })).toEqual([
    { external: { fs: true } },
    [],
  ])
  expect(
    parse(['--external:fs', '-e:fs'], { external: Key(), e: 'external' }),
  ).toEqual([
    {
      external: { fs: 2 },
    },
    [],
  ])
})

test('README.md: Key(Value())', () => {
  const [params] = parse(['--define:DEBUG', 'true'], { define: Key(Value()) })

  expect(parse(['--define:DEBUG', 'true'], { define: Key(Value()) })).toEqual([
    {
      define: {
        DEBUG: 'true',
      },
    },
    [],
  ])
  expect(
    parse(['--define:LEVEL', 'debug'], { define: Key(OneOf('debug', 'info')) }),
  ).toEqual([
    {
      define: {
        LEVEL: 'debug',
      },
    },
    [],
  ])
})

test('README.md: Maybe(Value() | OneOf(...))', () => {
  expect(parse(['--format'], { format: Maybe(Value()) })).toEqual([
    {
      format: true,
    },
    [],
  ])
  expect(parse(['--format', 'esm'], { format: Maybe(Value()) })).toEqual([
    {
      format: 'esm',
    },
    [],
  ])
  expect(parse(['--level'], { level: Maybe(OneOf('debug', 'info')) })).toEqual([
    {
      level: true,
    },
    [],
  ])
  expect(
    parse(['--level', 'info'], { level: Maybe(OneOf('debug', 'info')) }),
  ).toEqual([
    {
      level: 'info',
    },
    [],
  ])
})

test('README.md: Many(Value() | OneOf(...) | Maybe(...))', () => {
  expect(
    parse(['--format', 'esm', '--format', 'cjs'], {
      format: Many(Value()),
    }),
  ).toEqual([
    {
      format: ['esm', 'cjs'],
    },
    [],
  ])
  expect(
    parse(['--format', '--format', 'cjs'], {
      format: Many(Maybe(OneOf('esm', 'cjs'))),
    }),
  ).toEqual([
    {
      format: [true, 'cjs'],
    },
    [],
  ])
})

test('Flag: -v', () => {
  const [params] = parse(['-v'], v)
  expect(params.v).toBe(true)
})

test('Flag: -vvv', () => {
  const [params] = parse(['-vvv'], v)
  expect(params.v).toBe(3)
})

test('Value: --format esm', () => {
  const [params, args] = parse(['--format', 'esm'], format)
  expect(params.format).toBe('esm')
})

test('Many(Value()): --format esm --format cjs', () => {
  const [params] = parse(['--format', 'esm', '--format', 'cjs'], manyFormat)
  expect(params.format).toEqual(['esm', 'cjs'])
})

test('Many(Value()): --format esm --f cjs', () => {
  const [params] = parse(['--format', 'esm', '--format', 'cjs'], manyFormat)
  expect(params.format).toEqual(['esm', 'cjs'])
})

test('Many(Value()): --format=esm --f cjs', () => {
  const [params] = parse(['--format=esm', '--format', 'cjs'], manyFormat)
  expect(params.format).toEqual(['esm', 'cjs'])
})

test('Value(): -f esm', () => {
  const [params, args] = parse(['-f', 'esm'], format)
  expect(params.format).toBe('esm')
})

test('OneOf(string, string): --level info', () => {
  expect(parse(['--level', 'info'], levelString)).toEqual([
    { level: 'info' },
    [],
  ])
})

test('OneOf(regex, regex): --level InFo', () => {
  const [params] = parse(['--level', 'InFo'], levelRegex)
  expect(params.level).toBe('InFo')
})

test('Maybe(Value()): --format', () => {
  const [params] = parse(['--format'], maybeFormat)
  expect(params.format).toBe(true)
})

test('Maybe(Value()): --format esm', () => {
  const [params] = parse(['--format', 'esm'], maybeFormat)
  expect(params.format).toBe('esm')
})

test('Maybe(Value()): --format --format esm', () => {
  const [params] = parse(['--format', '--format', 'esm'], maybeFormat)
  expect(params.format).toBe('esm')
})

test('Maybe(Value()): --format esm --format', () => {
  const [params] = parse(['--format', 'esm', '--format'], manyMaybeFormat)
  expect(params.format).toEqual(['esm', true])
})

test('Maybe(Value()): --format esm --format cjs', () => {
  const [params] = parse(['--format', 'esm', '--format', 'cjs'], manyFormat)
  expect(params.format).toEqual(['esm', 'cjs'])
})

test('Maybe(Value()) with param: --level --format esm', () => {
  const [params] = parse(
    ['--level', '--format', 'esm'],
    Object.assign(maybeLevel, format),
  )
  expect(params).toEqual({ level: true, format: 'esm' })
})

test('Maybe(Value()): --level info --format esm', () => {
  const [params] = parse(
    ['--level', 'info', '--format', 'esm'],
    Object.assign(maybeLevel, format),
  )
  expect(params).toEqual({ level: 'info', format: 'esm' })
})

test('Maybe(OneOf(...)): --level', () => {
  const [params] = parse(['--level'], maybeLevel)
  expect(params).toEqual({ level: true })
})

test('Maybe(OneOf(...)): --level debug --level iNfO', () => {
  const [params] = parse(['--level', 'debug', '--level', 'iNfO'], maybeLevel)
  expect(params).toEqual({ level: 'iNfO' })
})

test('sub-command: build', () => {
  const [params] = parse(['build'], { build: {} })
  expect(params).toHaveProperty('build')
})

test('only arguments', () => {
  const [, args] = parse(['hello', 'sailor'])
  expect(args).toEqual(['hello', 'sailor'])
})

test('throw: parameters without config', () => {
  expect(() => parse(['--format', 'esm'])).toThrowError(
    'unknown parameter: --format',
  )
})
