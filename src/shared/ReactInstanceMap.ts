/**
 * This API should be called `delete` but we'd have to make sure to always
 * transform these to strings for IE support. When this transform is fully
 * supported we can rename it.
 */
export function remove(key: any) {
  key._reactInternals = undefined;
}

export function get(key: any) {
  return key._reactInternals;
}

export function has(key: any) {
  return key._reactInternals !== undefined;
}

export function set(key: any, value: any) {
  key._reactInternals = value;
}
