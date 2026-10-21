// Scientific calculator. Parses the expression itself (no eval), so typing code does nothing.
// Supports + - × ÷ ^ %, brackets, unary minus, n!, pi, e, and functions like sin, sqrt, log.

export type AngleMode = 'deg' | 'rad';

type Token =
  | { t: 'num'; v: number }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '^' | '%' | 'neg' | '!' }
  | { t: 'fn'; v: string }
  | { t: '(' }
  | { t: ')' };

const FUNCS: Record<string, (x: number, mode: AngleMode) => number> = {
  sin: (x, m) => Math.sin(m === 'deg' ? (x * Math.PI) / 180 : x),
  cos: (x, m) => Math.cos(m === 'deg' ? (x * Math.PI) / 180 : x),
  tan: (x, m) => Math.tan(m === 'deg' ? (x * Math.PI) / 180 : x),
  asin: (x, m) => (m === 'deg' ? (Math.asin(x) * 180) / Math.PI : Math.asin(x)),
  acos: (x, m) => (m === 'deg' ? (Math.acos(x) * 180) / Math.PI : Math.acos(x)),
  atan: (x, m) => (m === 'deg' ? (Math.atan(x) * 180) / Math.PI : Math.atan(x)),
  sqrt: (x) => Math.sqrt(x),
  cbrt: (x) => Math.cbrt(x),
  abs: (x) => Math.abs(x),
  ln: (x) => Math.log(x),
  log: (x) => Math.log10(x),
  exp: (x) => Math.exp(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  round: (x) => Math.round(x),
};

const CONSTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E };

const PREC: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
  neg: 3,
  '^': 4,
  '!': 5,
};
const RIGHT = new Set(['^', 'neg']);

export class CalcError extends Error {}

function tokenize(src: string): Token[] {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').toLowerCase();
  const out: Token[] = [];
  let i = 0;
  const prevIsValue = () => {
    const p = out.at(-1);
    return !!p && (p.t === 'num' || p.t === ')' || (p.t === 'op' && p.v === '!'));
  };
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(s.slice(i));
    if (num) {
      if (prevIsValue()) throw new CalcError('Missing operator');
      out.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const word = /^[a-zπ]+/.exec(s.slice(i));
    if (word) {
      const w = word[0];
      // implied multiplication: 2pi, 3sin(x), (2)(3)
      if (prevIsValue()) out.push({ t: 'op', v: '*' });
      if (w in CONSTS) out.push({ t: 'num', v: CONSTS[w]! });
      else if (w in FUNCS) out.push({ t: 'fn', v: w });
      else throw new CalcError(`Unknown: ${w}`);
      i += w.length;
      continue;
    }
    if (c === '(') {
      if (prevIsValue()) out.push({ t: 'op', v: '*' });
      out.push({ t: '(' });
    } else if (c === ')') out.push({ t: ')' });
    else if (c === '-' && !prevIsValue()) out.push({ t: 'op', v: 'neg' });
    else if (c === '+' && !prevIsValue()) {
      /* unary plus: ignore */
    } else if ('+-*/^%!'.includes(c)) out.push({ t: 'op', v: c as '+' });
    else throw new CalcError(`Unexpected "${c}"`);
    i++;
  }
  return out;
}

function toRpn(tokens: Token[]): Token[] {
  const out: Token[] = [];
  const stack: Token[] = [];
  for (const tok of tokens) {
    if (tok.t === 'num') out.push(tok);
    else if (tok.t === 'fn' || tok.t === '(') stack.push(tok);
    else if (tok.t === ')') {
      while (stack.length && stack.at(-1)!.t !== '(') out.push(stack.pop()!);
      if (!stack.length) throw new CalcError('Unmatched )');
      stack.pop();
      if (stack.at(-1)?.t === 'fn') out.push(stack.pop()!);
    } else {
      if (tok.v === '!') {
        out.push(tok); // postfix: applies straight away
        continue;
      }
      while (stack.length) {
        const top = stack.at(-1)!;
        if (top.t === 'fn') {
          out.push(stack.pop()!);
          continue;
        }
        if (top.t !== 'op') break;
        const higher = PREC[top.v]! > PREC[tok.v]!;
        const equalLeft = PREC[top.v] === PREC[tok.v] && !RIGHT.has(tok.v);
        if (higher || equalLeft) out.push(stack.pop()!);
        else break;
      }
      stack.push(tok);
    }
  }
  while (stack.length) {
    const t = stack.pop()!;
    if (t.t === '(') throw new CalcError('Unmatched (');
    out.push(t);
  }
  return out;
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new CalcError('Factorial needs a whole number');
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export function evaluate(expr: string, mode: AngleMode = 'deg'): number {
  if (!expr.trim()) throw new CalcError('Empty');
  const rpn = toRpn(tokenize(expr));
  const st: number[] = [];
  const pop = () => {
    const v = st.pop();
    if (v === undefined) throw new CalcError('Incomplete expression');
    return v;
  };
  for (const tok of rpn) {
    if (tok.t === 'num') st.push(tok.v);
    else if (tok.t === 'fn') st.push(FUNCS[tok.v]!(pop(), mode));
    else if (tok.t === 'op') {
      if (tok.v === 'neg') st.push(-pop());
      else if (tok.v === '!') st.push(factorial(pop()));
      else {
        const b = pop();
        const a = pop();
        st.push(
          tok.v === '+'
            ? a + b
            : tok.v === '-'
              ? a - b
              : tok.v === '*'
                ? a * b
                : tok.v === '/'
                  ? a / b
                  : tok.v === '%'
                    ? a % b
                    : a ** b,
        );
      }
    }
  }
  if (st.length !== 1) throw new CalcError('Incomplete expression');
  return st[0]!;
}

/** Tidy number for display: no floating-point noise like 0.30000000000000004. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return Number.isNaN(n) ? 'Not a number' : n > 0 ? '∞' : '-∞';
  if (Math.abs(n) >= 1e15 || (n !== 0 && Math.abs(n) < 1e-9))
    return n.toExponential(8).replace(/\.?0+e/, 'e');
  return String(Number(n.toPrecision(12)));
}
