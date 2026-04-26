const hasOwn = Object.prototype.hasOwnProperty;

function is(x: unknown, y: unknown) {
  if (x === y) {
    return x !== 0 || y !== 0 || 1 / (x as number) === 1 / (y as number);
  }
  // eslint-disable-next-line no-self-compare
  return x !== x && y !== y;
}

type Indexed = Record<string, unknown>;

export default function shallowEqual(objA: object, objB: object): boolean {
  if (is(objA, objB)) return true;

  if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) {
    return false;
  }

  const a = objA as Indexed;
  const b = objB as Indexed;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    if (!hasOwn.call(b, keysA[i]) || !is(a[keysA[i]], b[keysA[i]])) {
      return false;
    }
  }

  return true;
}
