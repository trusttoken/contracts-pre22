type Opaque<K, T> = T & { __TYPE__: K }
const HEX_REGEX = /^0x[\da-fA-F]*$/

/**
 * An hexadecimal string representing an ethereum address.
 * Always prefixed with 0x, always lowercase and of length 42.
 */
export type Address = Opaque<'Address', string>

export function makeAddress (value: string): Address {
  if (!HEX_REGEX.test(value) || value.length !== 42) {
    throw new TypeError(`Value "${value}" is not a valid address`)
  }
  return value.toLowerCase() as Address
}
