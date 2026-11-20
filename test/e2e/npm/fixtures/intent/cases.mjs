// A dependency probe must not modify the candidate, including when users run node --test directly.
function probe(moduleName, dependencyName, stub, assertions) {
  return (
    header +
    `import {copyFile,mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";import {join} from "node:path";import {pathToFileURL} from "node:url";
const dir=await mkdtemp(join(tmpdir(),"intent-link-"));try{
await copyFile(new URL("./"+${JSON.stringify(moduleName)},import.meta.url),join(dir,${JSON.stringify(moduleName)}));
if(${JSON.stringify(moduleName)}==="quote.mjs")await copyFile(new URL("./money.mjs",import.meta.url),join(dir,"money.mjs"));
await writeFile(join(dir,${JSON.stringify(dependencyName)}),${JSON.stringify(stub)});
const subject=await import(pathToFileURL(join(dir,${JSON.stringify(moduleName)}))); ${assertions}
}finally{await rm(dir,{recursive:true,force:true});}`
  );
}
const header = 'import assert from "node:assert/strict";\n';
export const cases = {
  small: {
    prompt:
      "Fix greet(name) to return Hello, <name>! and preserve Unicode names. Keep the protected test unchanged.",
    source: { "greet.mjs": "export const greet = () => 'Hi';" },
    tests: {
      greeting: [
        "Exact greetings for Ada and 陈🌍",
        header +
          'import {greet} from "./greet.mjs";assert.equal(greet("Ada"),"Hello, Ada!");assert.equal(greet("陈🌍"),"Hello, 陈🌍!");',
      ],
    },
    extra:
      header +
      'import {greet} from "./greet.mjs"; for(const n of ["","山🌳","Ana María"])assert.equal(greet(n),"Hello, "+n+"!");',
  },
  medium: {
    prompt:
      "Implement validQuantity(q) in quantity.mjs and transfer(stock,from,to,q) in transfer.mjs. A positive safe integer may be transferred between different existing warehouses if stock suffices. Return a new stock object preserving the input. Reject all invalid transfers. Use validQuantity from quantity.mjs; preserve protected tests.",
    source: {
      "quantity.mjs": "export const validQuantity=q=>false;",
      "transfer.mjs": "export const transfer=(stock,from,to,q)=>stock;",
    },
    tests: {
      quantity: [
        "Check positive safe integers; reject fractions, strings, nonpositive and unsafe integers.",
        header +
          'import {validQuantity as v} from "./quantity.mjs";assert.equal(v(2),true);for(const q of [0,-2,1.5,"2",2**53])assert.equal(v(q),false);',
      ],
      transfer: [
        "Verify stock arithmetic, nonmutation, insufficient stock, invalid quantity, unknown/same warehouse.",
        header +
          'import {transfer} from "./transfer.mjs"; const s=Object.freeze({A:4,B:1,C:2});assert.deepEqual(transfer(s,"A","B",2),{A:2,B:3,C:2});for(const args of [["A","B",5],["A","A",1],["Z","B",1],["A","Z",1],["A","B",1.5]])assert.throws(()=>transfer(s,...args));assert.deepEqual(s,{A:4,B:1,C:2});',
      ],
      delegation: [
        "An instrumented quantity module records the argument and can veto an otherwise valid transfer.",
        probe(
          "transfer.mjs",
          "quantity.mjs",
          "export function validQuantity(q){globalThis.quantitySeen=q;return false;}",
          'assert.throws(()=>subject.transfer({a:5,b:0},"a","b",2));assert.equal(globalThis.quantitySeen,2);',
        ),
      ],
    },
    extra:
      header +
      'import {transfer} from "./transfer.mjs";const x=Object.freeze({a:9,b:0,c:0});const y=transfer(x,"a","b",9);assert.deepEqual(transfer(y,"b","c",3),{a:0,b:6,c:3});assert.deepEqual(y,{a:0,b:9,c:0});',
  },
  large: {
    prompt:
      "Implement the three existing named exports. cents(n) validates and returns nonnegative safe integers, otherwise throws. subtotal(lines) sums qty*unitCents for positive safe integer quantities, validates cents and overflow, returns zero for empty lines. quote(lines,discount,shipping) uses subtotal, caps discount at subtotal, waives shipping when the post-discount subtotal is at least 5000, otherwise charges shipping; return {subtotal,discount,shipping,total}. Reject invalid money and overflow, preserve the input and protected tests.",
    source: {
      "money.mjs": "export const cents=n=>n;",
      "items.mjs": "export const subtotal=lines=>0;",
      "quote.mjs": "export const quote=(lines,discount,shipping)=>({});",
    },
    tests: {
      money: [
        "Valid/invalid safe-integer cents.",
        header +
          'import {cents} from "./money.mjs";for(const n of [0,7,Number.MAX_SAFE_INTEGER])assert.equal(cents(n),n);for(const n of [-1,1.2,2**53,"2",NaN])assert.throws(()=>cents(n));',
      ],
      items: [
        "Subtotal for frozen lines, empty input, unit/quantity validation and product/sum overflow.",
        header +
          'import {subtotal} from "./items.mjs";assert.equal(subtotal([]),0);const a=Object.freeze([Object.freeze({qty:2,unitCents:75}),Object.freeze({qty:3,unitCents:20})]);assert.equal(subtotal(a),210);for(const [qty,unitCents] of [[0,2],[1.5,2],[2,-1],[2,Number.MAX_SAFE_INTEGER]])assert.throws(()=>subtotal([{qty,unitCents}]));assert.throws(()=>subtotal([{qty:1,unitCents:Number.MAX_SAFE_INTEGER},{qty:1,unitCents:1}]));',
      ],
      quote: [
        "Exact quotes at/under free shipping threshold, capped discount, invalid amounts/lines, overflow and input nonmutation.",
        header +
          'import {quote} from "./quote.mjs";const a=Object.freeze([Object.freeze({qty:2,unitCents:2600})]);for(const [d,ship,total] of [[200,0,5000],[201,80,5079],[9999,80,80]])assert.deepEqual(quote(a,d,80),{subtotal:5200,discount:Math.min(d,5200),shipping:ship,total});for(const [d,s] of [[-1,0],[0,-1],[1.2,0]])assert.throws(()=>quote(a,d,s));assert.throws(()=>quote([{qty:0,unitCents:1}],0,0));assert.throws(()=>quote([{qty:1,unitCents:1}],0,Number.MAX_SAFE_INTEGER));',
      ],
      linkage: [
        "Replace subtotal in an isolated copy and verify quote uses the imported subtotal.",
        probe(
          "quote.mjs",
          "items.mjs",
          "export const subtotal=lines=>(globalThis.linesSeen=lines,300)",
          "const a=[];assert.deepEqual(subject.quote(a,4,9),{subtotal:300,discount:4,shipping:9,total:305});assert.equal(globalThis.linesSeen,a);",
        ),
      ],
    },
    extra:
      header +
      'import {quote} from "./quote.mjs";assert.deepEqual(quote([{qty:1,unitCents:5001}],2,47),{subtotal:5001,discount:2,shipping:47,total:5046});assert.deepEqual(quote([],3,20),{subtotal:0,discount:0,shipping:20,total:20});',
  },
};
export async function makeInput(name, dir) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { resolve, join } = await import("node:path");
  const fixture = cases[name];
  if (!fixture) throw Error("Unknown fixture");
  const projectDir = resolve(dir);
  await mkdir(projectDir);
  const files = [],
    checks = [];
  for (const [path, content] of Object.entries(fixture.source)) {
    await writeFile(join(projectDir, path), content);
    files.push({ path, editable: true });
  }
  for (const [id, [description, content]] of Object.entries(fixture.tests)) {
    const path = `${id}.test.mjs`;
    await writeFile(join(projectDir, path), content);
    files.push({ path, editable: false });
    checks.push({ id, description, command: "node", args: [path] });
  }
  return { projectDir, prompt: fixture.prompt, files, checks };
}
