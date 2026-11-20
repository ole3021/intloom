export const solutions = {
  small: {
    "greet.mjs": `export const greet = name => \`Hello, \${name}!\`;\n`,
  },
  medium: {
    "quantity.mjs":
      "export const validQuantity = q => Number.isSafeInteger(q) && q > 0;\n",
    "transfer.mjs": `import {validQuantity} from './quantity.mjs';
export function transfer(stock, from, to, q) {
  if (!validQuantity(q) || from === to || !Object.hasOwn(stock, from) || !Object.hasOwn(stock, to) || stock[from] < q) throw Error('Invalid transfer');
  return {...stock, [from]: stock[from] - q, [to]: stock[to] + q};
}\n`,
  },
  large: {
    "money.mjs": `export function cents(n) {
  if (!Number.isSafeInteger(n) || n < 0) throw Error('Invalid cents');
  return n;
}\n`,
    "items.mjs": `import {cents} from './money.mjs';
export function subtotal(lines) {
  let total = 0;
  for (const {qty, unitCents} of lines) {
    if (!Number.isSafeInteger(qty) || qty <= 0) throw Error('Invalid quantity');
    total = cents(total + cents(qty * cents(unitCents)));
  }
  return total;
}\n`,
    "quote.mjs": `import {cents} from './money.mjs';
import {subtotal} from './items.mjs';
export function quote(lines, discount, shipping) {
  const sum = subtotal(lines);
  discount = Math.min(cents(discount), sum);
  shipping = cents(shipping);
  if (sum - discount >= 5000) shipping = 0;
  return {subtotal: sum, discount, shipping, total: cents(sum - discount + shipping)};
}\n`,
  },
};
