import {
  parse,
  Param,
  Value,
  Flag,
  Key,
  KeyValue,
  OneOf,
  Maybe,
  ConfigFn,
} from './index'

const format: Param = [[['format', 'f'], Value()]]
const maybeFormat: Param = [[['format', 'f'], Maybe(Value())]]
const v: Param = [['v', Flag()]]
const levelString: Param = [['level', OneOf('debug', 'info')]]
const levelRegex: Param = [['level', OneOf(/^debug$/i, /^info$/i)]]
const maybeLevel: Param = [['level', Maybe(OneOf('debug', /^info$/i))]]

test('README.md: app.js: --format esm index.ts', () => {
  const [params, argv] = parse(
    ['--format', 'esm', 'index.ts'],
    [[['format', 'f'], Value()]],
  )
  expect(params).toEqual({ format: 'esm' })
  expect(argv).toEqual(['index.ts'])
})

test('README.md: app.js: -f esm index.ts', () => {
  const [params, argv] = parse(
    ['-f', 'esm', 'index.ts'],
    [[['format', 'f'], Value()]],
  )
  expect(params).toEqual({ format: 'esm' })
  expect(argv).toEqual(['index.ts'])
})

test('README.md: sub-command: -vvv build --level info index.ts', () => {
  const [params, argv] = parse(
    ['-vvv', 'build', '--level', 'info', 'index.ts'],
    function* () {
      const cmd = yield [[['verbose', 'v'], Flag()]]
      if (cmd === 'build') {
        yield [['level', OneOf('debug', 'info')]]
      } else {
        throw new Error(`unknown sub-command: ${cmd}`)
      }
    },
  )
  expect(params).toEqual({ verbose: 3, build: { level: 'info' } })
  expect(argv).toEqual(['index.ts'])
})

test('README.md: Value()', () => {
  const [params] = parse(['--format', 'esm'], [['format', Value()]])
  expect(params.format).toBe('esm')
})

test('README.md: OneOf(string | regex, ...)', () => {
  const [params] = parse(
    ['--level', 'dEbUg'],
    [['level', OneOf(/^debug$/i, 'info')]],
  )
  expect(params.level).toBe('dEbUg')
})

test('README.md: Flag()', () => {
  expect(parse(['-v'], [['v', Flag()]])).toEqual([{ v: true }, []])
  expect(parse(['-vvv'], [['v', Flag()]])).toEqual([{ v: 3 }, []])
  // => { v: 3 }
  expect(
    parse(
      ['-vP'],
      [
        ['v', Flag()],
        ['P', Flag()],
      ],
    ),
  ).toEqual([
    {
      v: true,
      P: true,
    },
    [],
  ])
})

test('README.md: KeyValue()', () => {
  const [params] = parse(['--define:DEBUG', 'true'], [['define', KeyValue()]])
  expect(params.define.DEBUG).toBe('true')
})

test('README.md: Key()', () => {
  expect(parse(['--external:fs'], [['external', Key()]])).toEqual([
    { external: { fs: true } },
    [],
  ])
  expect(
    parse(['--external:fs', '-e:fs'], [[['external', 'e'], Key()]]),
  ).toEqual([
    {
      external: { fs: 2 },
    },
    [],
  ])
})

test('README.md: Maybe(Value() | OneOf(...))', () => {
  expect(parse(['--format'], [['format', Maybe(Value())]])).toEqual([
    {
      format: true,
    },
    [],
  ])
  expect(parse(['--format', 'esm'], [['format', Maybe(Value())]])).toEqual([
    {
      format: 'esm',
    },
    [],
  ])
  expect(
    parse(['--level'], [['level', Maybe(OneOf('debug', 'info'))]]),
  ).toEqual([
    {
      level: true,
    },
    [],
  ])
  expect(
    parse(['--level', 'info'], [['level', Maybe(OneOf('debug', 'info'))]]),
  ).toEqual([
    {
      level: 'info',
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

test('Value: --format esm --format cjs', () => {
  const [params] = parse(['--format', 'esm', '--format', 'cjs'], format)
  expect(params.format).toEqual(['esm', 'cjs'])
})

test('Value: --format esm --f cjs', () => {
  const [params] = parse(['--format', 'esm', '--format', 'cjs'], format)
  expect(params.format).toEqual(['esm', 'cjs'])
})

test('Value: --format=esm --f cjs', () => {
  const [params] = parse(['--format=esm', '--format', 'cjs'], format)
  expect(params.format).toEqual(['esm', 'cjs'])
})

test('Value: -f esm', () => {
  const [params, args] = parse(['-f', 'esm'], format)
  expect(params.format).toBe('esm')
})

test('OneOf(string, string): --level info', () => {
  parse(['--level', 'info'], levelString)
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
  const [params] = parse(['--format', 'esm', '--format'], maybeFormat)
  expect(params.format).toBe(true)
})

test('Maybe(Value()): --format esm --format cjs', () => {
  const [params] = parse(['--format', 'esm', '--format', 'cjs'], maybeFormat)
  expect(params.format).toEqual(['esm', 'cjs'])
})

test('Maybe(OneOf(...)): --level', () => {
  const [params] = parse(['--level'], maybeLevel)
  expect(params).toEqual({ level: true })
})

test('Maybe(OneOf(...)): --level debug --level iNfO', () => {
  const [params] = parse(['--level', 'debug', '--level', 'iNfO'], maybeLevel)
  expect(params).toEqual({ level: ['debug', 'iNfO'] })
})

const subcmd: ConfigFn = function* () {
  const cmd = yield []
  if (cmd === 'build') {
    yield []
  } else {
    throw Error(`unknown sub-command: ${cmd}`)
  }
}

test('sub-command: build', () => {
  const [params] = parse(['build'], subcmd)
  expect(params).toHaveProperty('build')
})

test('sub-command: throw on missing sub-command: watch', () => {
  expect(() => parse(['watch'], subcmd)).toThrowError(
    'unknown sub-command: watch',
  )
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
