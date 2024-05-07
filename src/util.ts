export function filterMap<In,Out>(array: In[], func: (val: In) => Out | undefined): Out[] {
  const results: Out[] = [];
  for (const elem of array) {
    const result = func(elem);
    if (result !== undefined) {
      results.push(result);
    }
  }
  return results;
}
