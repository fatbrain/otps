const error = (msg: string) => {
  throw new Error(msg)
}
type ID = string | number | symbol
type Token = readonly [ID, string]
type Input = readonly Token[]

type Fn<TState> = (input: Input, state?: TState) => readonly [Input, TState]
type ParamFn<TValue, TArgs extends any[]> = (...args: TArgs) => Fn<TValue>

type ParseFn = (...match: readonly string[]) => readonly Token[]
type Parse = ReadonlyArray<
  readonly [RegExp, [ID, ...ID[]]] | readonly [RegExp, ParseFn]
>

type ValueOf<TFn> = TFn extends Fn<infer TValue> ? TValue : never

export type Params<TConfig> = {
  [P in keyof TConfig as TConfig[P] extends string
    ? never
    : P]?: TConfig[P] extends Fn<any>
    ? ValueOf<TConfig[P]>
    : TConfig[P] extends Config
    ? Params<TConfig[P]>
    : never
}

type Config = Record<string, any>

type Cmds<TParams> = {
  [K in keyof TParams as Config extends TParams[K] ? K : never]-?: (
    params: Required<TParams>[K],
    args: string[],
  ) => void | Promise<void>
}

export const cmds =
  <TParams extends Config>(params: TParams, args: string[]) =>
  (
    cmds: Cmds<TParams>,
    noMatch?: (params: TParams, args: string[]) => void,
  ) => {
    for (const [key, value] of Object.entries(params)) {
      if (key in cmds) {
        return cmds[key as keyof Cmds<TParams>]?.(value, args)
      }
    }
    noMatch?.(params, args)
  }

const apply = (
  r: ParseFn | readonly ID[],
  parts: readonly string[],
): readonly Token[] =>
  typeof r === 'function' ? r(...parts) : parts.map((p, i) => [r[i], p])

function* args(
  argv: readonly string[],
  parser: Parse,
): Generator<readonly [ID, string], void, void> {
  for (const arg of argv) {
    const [re, r] = parser.find(([re]) => re.test(arg)) || [null, []]
    if (re) {
      for (const t of apply(r, arg.match(re)!.slice(1)).filter(([, v]) => v)) {
        yield t
      }
    } else {
      yield [0, arg]
    }
  }
}

enum Type {
  Value,
  Long,
  Short,
  Flag,
  Key,
}

const reLong = /^--([a-zA-Z][\w-]+)(.*?)(?:=(.*))?$/
const reFlags = /^-([a-zA-Z0-9_$%]{2,})$/
const reShort = /^-([a-zA-Z0-9_$%])(.*?)(?:=(.*))?$/

const esbuild: Parse = [
  [
    reLong,
    (long, key, value) => [
      [Type.Long, long.replace(/-./g, m => m[1].toUpperCase())],
      [Type.Key, key],
      [Type.Value, value],
    ],
  ],
  [reFlags, match => match.split('').map(f => [Type.Flag, f])],
  [reShort, [Type.Short, Type.Key, Type.Value]],
]

export const Value: ParamFn<string, []> =
  () =>
  ([[type, value], ...rest]) =>
    type === Type.Value ? [rest, value] : error('expected value')
export const Flag: ParamFn<true | number, []> = () => (input, state) =>
  [input, !state ? true : state === true ? 2 : state + 1]
export const OneOf: ParamFn<string, Array<string | RegExp>> =
  (...patterns) =>
  ([[type, value], ...rest]) =>
    type === Type.Value
      ? patterns.some(p =>
          typeof p === 'string' ? p === value : p.test(value),
        )
        ? [rest, value]
        : error('expected one-of')
      : error('expected value')

type KeyState<TValue = true | number> = Record<string, TValue>
export function Key(): Fn<KeyState>
export function Key<TValue>(fn: Fn<TValue>): Fn<KeyState<TValue>>
export function Key(fn?: any): any {
  return ([[type, value], ...rest]: Input, state: any = {}) => {
    const key = value.slice(1)
    if (type !== Type.Key) {
      throw new Error('expected key')
    } else if (fn) {
      const [r, value] = fn(rest, state[key])
      return [r, { ...state, [key]: value }]
    } else {
      return [
        rest,
        {
          ...state,
          [key]: !state[key] ? true : state[key] === true ? 2 : state[key] + 1,
        },
      ]
    }
  }
}

export const Maybe =
  <TValue>(fn: Fn<TValue>): Fn<TValue | true> =>
  (input: Input, state: TValue | true = true) => {
    try {
      return fn(input)
    } catch {
      return [input, state]
    }
  }

export const Many =
  <TValue>(fn: Fn<TValue>) =>
  (input: Input, state: TValue[] = []) => {
    const [rest, value] = fn(input)
    return [rest, [...state, value]] as [Input, TValue[]]
  }

type Parser = <TConfig extends Config>(
  argv: readonly string[],
  config?: TConfig,
) => readonly [Params<TConfig>, string[]]

const parser =
  (parse: Parse, toParam: (type: ID, name: string) => string): Parser =>
  <TConfig extends Config>(
    argv: readonly string[],
    config?: TConfig,
  ): readonly [Params<TConfig>, string[]] => {
    let input = [...args(argv, parse)]
    const varg: string[] = []
    const params: Config = {}
    let c: Config = config || {}
    let p = params
    while (input.length) {
      const [[type, arg], ...rest] = input
      if (type === 0) {
        if (arg in c && typeof c[arg] === 'object') {
          c = c[arg]
          p = p[arg] = {}
        } else {
          varg.push(arg)
        }
        input = rest
      } else if (arg in c) {
        const key = typeof c[arg] === 'string' ? c[arg] : arg
        const [r, value] = c[key](rest, p[key])
        p[key] = value
        input = r
      } else {
        throw new Error(`unknown parameter: ${toParam(type, arg)}`)
      }
    }
    return [params, varg]
  }

export const parse = parser(
  esbuild,
  (type, name) => `${type === Type.Long ? '--' : '-'}${name}`,
)
