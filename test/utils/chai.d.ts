/// <reference types="chai" />
/// <reference types="sinon-chai" />
declare namespace Chai {
  interface CloseTo {
    (expected: any, delta: number, message?: string): Assertion,
  }
}
