const reLong = /^--([a-zA-Z][\w-]+)(.*?)(?:=(.*))?$/
const reShort = /^-([a-zA-Z0-9_$%])(.*?)(?:=(.*))?$/
const reFlags = /^-[a-zA-Z0-9_$%]{2,}$/
let reKey = /^:(?!$)/
enum Type {
  Value,
  Long,
  Short,
  Key,
  Flag,
}
const typeText = [
  'an argument',
  'a parameter',
  'a parameter',
  'a key',
  'a parameter',
]
function* argv(
  argv: string[],
): Generator<[Type, string] | [Type, string], void, void> {
  for (const arg of argv) {
    if (reLong.test(arg)) {
      const [_, name, key, value] = arg.match(reLong)!
      yield [Type.Long, name]
      if (key) {
        yield [Type.Key, key]
      }
      if (value) {
        yield [Type.Value, value]
      }
    } else if (reFlags.test(arg)) {
      for (const f of arg.slice(1).split('')) {
        yield [Type.Flag, f]
      }
    } else if (reShort.test(arg)) {
      const [_, name, key, value] = arg.match(reShort)!
      yield [Type.Short, name]
      if (key) {
        yield [Type.Key, key]
      }
      if (value) {
        yield [Type.Value, value]
      }
    } else {
      yield [Type.Value, arg]
    }
  }
}

type PeekableGenerator<T = unknown, TReturn = any, TNext = unknown> = Generator<
  T,
  TReturn,
  TNext
> & { peek(): IteratorResult<T, TReturn> }
function peekable<T = unknown, TReturn = any, TNext = unknown>(
  g: Generator<T, TReturn, TNext>,
): PeekableGenerator<T, TReturn, TNext> {
  let peek: IteratorResult<T, TReturn> | void = undefined
  return Object.assign(
    (function* (): Generator<T, TReturn, TNext> {
      let next = g.next()
      while (!next.done) {
        const v = yield next.value
        next = peek === undefined ? g.next(v) : peek
        peek = undefined
      }
      return next.value
    })(),
    {
      peek(): IteratorResult<T, TReturn> {
        if (peek === undefined) {
          peek = g.next()
        }
        return peek
      },
    },
  ) as unknown as PeekableGenerator<T, TReturn, TNext>
}

const next = (g: G, type: Type): string => {
  const { done, value } = g.next()
  const [t, v] = value || []
  if (done || t !== type) {
    throw new Error(
      `expected ${typeText[type]}${
        !done && t ? `, found ${typeText[t!]}` : ''
      }`,
    )
  }
  return v!
}

// Value can also be `true` when used with `Maybe`. Overwrite if previously set
// by `Maybe`
const reduceValue = (
  state: undefined | true | string | string[],
  value: string,
) => {
  if (state === undefined || state === true) {
    return value
  } else if (typeof state === 'string') {
    return [state, value]
  } else {
    return state.concat(value)
  }
}

const reduceFlag = (state: undefined | true | number) => {
  if (state === undefined) {
    return true
  } else if (state === true) {
    return 2
  } else {
    return state + 1
  }
}

const reduceKeyValue = (state: any = {}, key: string, value: string) => {
  if (state[key] === undefined) {
    return { ...state, [key]: value }
  } else if (typeof state[key] === 'string') {
    return { ...state, [key]: [state[key], value] }
  } else {
    return { ...state, [key]: [...state[key], value] }
  }
}

const reduceKey = (state: any = {}, key: string) => {
  if (state[key] === undefined) {
    return { ...state, [key]: true }
  } else if (state[key] === true) {
    return { ...state, [key]: 2 }
  } else {
    return { ...state, [key]: state[key] + 1 }
  }
}

type G = PeekableGenerator<[Type, string] | [Type, string, string], void, void>
type ParamFn<TState> = (
  g: G,
  state: undefined | TState,
  extra: string,
) => TState
type ParamType<TState, TArgs extends any[] = any[]> = (
  ...args: TArgs
) => ParamFn<TState>

export const Value: ParamType<string | string[]> = () => (g, state, extra) => {
  return reduceValue(state, next(g, Type.Value))
}

export const OneOf: ParamType<string | string[], Array<string | RegExp>> =
  (...items) =>
  (g, state) => {
    const value = next(g, Type.Value)
    if (
      items.some(p => (typeof p === 'string' ? p === value : p.test(value)))
    ) {
      return reduceValue(state, value)
    }
    throw new Error('unexpected value')
  }

export const Flag: ParamType<number | true> = () => (g, state) =>
  reduceFlag(state)

export const KeyValue: ParamType<any> =
  (pattern = reKey) =>
  (g: G, state: any) => {
    const key = next(g, Type.Key)
    if (pattern.test(key)) {
      const value = next(g, Type.Value)
      return reduceKeyValue(state, key.replace(reKey, ''), value)
    }
    throw new Error('missing key')
  }

export const Key: ParamType<any> =
  (pattern = reKey) =>
  (g, state) => {
    const key = next(g, Type.Key)
    if (pattern.test(key)) {
      return reduceKey(state, key.replace(pattern, ''))
    }
    throw new Error('missing key')
  }

export const Maybe =
  <Fn extends ParamFn<TState>, TState extends any = ReturnType<Fn>>(fn: Fn) =>
  (g: G, state: any, extra: string): TState | true => {
    const [type] = g.peek().value || []
    return type === Type.Value ? fn(g, state, extra) : true
  }

export type Param = [string | [string] | [string, ...string[]], any][]
export type ConfigGenerator = Generator<Param, void, string>

const toConfig = (params: void | Param, or: Record<string, any>) =>
  !params
    ? or
    : params.reduce<Record<string, any>>(
        (o, [ns, p]) =>
          (Array.isArray(ns) ? ns : [ns]).reduce(
            (o, n, i, ns) => ((o[n] = i === 0 ? p : ns[0]), o),
            o,
          ),
        {},
      )

export type ConfigFn = () => ConfigGenerator
type Config = Param | ConfigFn
const toConfigGenerator = (config?: Config) =>
  !config || Array.isArray(config)
    ? function* () {
        yield config || []
      }
    : config

export const parse = (args: string[], config?: Config) => {
  const cg = toConfigGenerator(config)()
  let cfg = toConfig(cg.next().value, {})
  const g = peekable(argv(args))
  const root: Record<string, any> = {}
  let params = root
  const varg: string[] = []
  for (const [type, arg] of g) {
    if (type === Type.Value) {
      const c = cg.next(arg)
      if (!c.done && c.value) {
        params = params[arg] = {}
        cfg = toConfig(c.value, {})
      } else {
        varg.push(arg)
      }
    } else {
      const key = typeof cfg[arg] === 'string' ? cfg[arg] : arg
      const p = cfg[key]
      if (!p) {
        const { done, value = [] } = g.peek()
        const extra = !done && value[0] === Type.Key ? value[1] : ''
        throw new Error(
          `unknown parameter: ${type === Type.Long ? '--' : '-'}${arg}${extra}`,
        )
      } else {
        try {
          params[key] = p(g, params[key])
        } catch (e: any) {
          const { done, value = [] } = g.peek()
          const extra = !done && value[0] === Type.Key ? value[1] : ''
          throw new Error(
            `${e.message} for: ${
              type === Type.Long ? '--' : '-'
            }${arg}${extra}`,
          )
        }
      }
    }
  }

  return [root, varg]
}
