export function assertApprox(actual, expected, tolerance) {
  assert(actual.gt(expected.sub(tolerance)) && actual.lt(expected.add(tolerance)))
}
