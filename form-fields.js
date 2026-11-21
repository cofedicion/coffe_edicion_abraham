const namePattern = /^[\p{L}\p{M}][\p{L}\p{M} .'’\-]*$/u;

export function validName(value, maxLength = 60) {
  return value.length >= 2 && value.length <= maxLength && namePattern.test(value);
}

export function validMessage(value, maxLength = 300) {
  return value.length <= maxLength && !/[\u0000-\u0008\u000B-\u001F\u007F]/u.test(value);
}
