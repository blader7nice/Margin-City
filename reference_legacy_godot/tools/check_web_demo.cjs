// Offline smoke-test for the standalone browser demo. No npm dependencies.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const html = fs.readFileSync(__dirname + '/../demo-web/index.html', 'utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const drawFn = () => {};
const ctx = new Proxy({}, { get(target, name) {
  if (name === 'createLinearGradient' || name === 'createRadialGradient') return () => ({addColorStop:drawFn});
  if (name in target) return target[name];
  return drawFn;
}, set(target,name,val) {target[name]=val;return true;}});
const nodes = {};
const getNode=id=>nodes[id]??(nodes[id]={id,width:750,height:225,innerHTML:'',textContent:'',disabled:false,dataset:{},getContext:()=>ctx,addEventListener:drawFn,classList:{add:drawFn,remove:drawFn}});
let ticker=null;
const context = vm.createContext({
  console,performance:{now:()=>0},window:{addEventListener:drawFn},
  document:{getElementById:getNode,querySelectorAll:()=>[]},
  requestAnimationFrame:drawFn,
  setInterval:cb=>{ticker=cb;return 1;},clearInterval:()=>{ticker=null;},
});
new vm.Script(js).runInContext(context);
vm.runInContext('update(0.016);draw();chartDraw()',context);
vm.runInContext('player.x=2440;showTerminal();trade("LONG")',context);
assert(ticker,'replay timer scheduled');
for(let i=0;i<8;i++){let cb=ticker;assert(cb);cb();}
const result=vm.runInContext('({completed,animating,visibleBars,cash})',context);
assert.strictEqual(result.completed,true);
assert.strictEqual(result.visibleBars,20);
assert(!result.animating);
assert(Math.abs(result.cash-1002.5311425682508)<0.0001,result.cash);
console.log('PASS: standalone web demo parses/renders under mock canvas, LONG replay finishes with deterministic net PnL');
