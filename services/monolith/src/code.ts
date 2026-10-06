import { randomInt } from 'node:crypto';

// no l/1/I/O/0 — codes get read aloud and pasted by hand
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const randomCode = (length = 7) => {
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
};
