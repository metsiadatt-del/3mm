import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import postcss from 'postcss';
const workerSource=readFileSync(new URL('./service-worker.js',import.meta.url),'utf8');
function worker() {
  const handlers:Record<string,(event:Record<string,unknown>)=>void>={};const saved=new Map<string,Response>();const deleted:string[]=[];let fail=false;let fetched=0;
  const cache={addAll:async(urls:string[])=>{for(const url of urls)saved.set(new URL(url,'https://met.test/').pathname,new Response(url==='\/index.html'?'offline app':'asset'));},match:async(request:string|Request|URL)=>{const raw=typeof request==='string'?request:'url' in request?request.url:request.toString();return saved.get(new URL(raw,'https://met.test/').pathname);}};
  const self={location:{origin:'https://met.test',href:'https://met.test/sw.js'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name:string,handler:(event:Record<string,unknown>)=>void)=>{handlers[name]=handler;}};
  const caches={open:async()=>cache,keys:async()=>['met-static-old','another-app-cache'],delete:async(key:string)=>{deleted.push(key);return true;}};
  const fetch=async(request:string|Request|URL)=>{fetched++;if(fail)throw new Error('offline');const raw=typeof request==='string'?request:'url' in request?request.url:request.toString();const path=new URL(raw,'https://met.test/').pathname;if(path==='/precache.json')return new Response(JSON.stringify(['/index.html','/assets/main.js']));return new Response('online');};
  vm.runInNewContext(workerSource,{self,caches,fetch,URL,Response,Error});
  async function lifecycle(name:string){let pending:Promise<unknown>|undefined;handlers[name]({waitUntil:(p:Promise<unknown>)=>pending=p});await pending;}
  async function request(path:string,navigate=false){let response:Promise<Response>|undefined;handlers.fetch({request:{url:new URL(path,'https://met.test').href,method:'GET',mode:navigate?'navigate':'cors'},respondWith:(p:Promise<Response>)=>response=p});return response?await response:undefined;}
  return {saved,deleted,lifecycle,request,setOffline:()=>{fail=true;},fetched:()=>fetched};
}
test('PWA caches shell and assets, removes only its own stale cache and serves offline navigation',async()=>{const w=worker();await w.lifecycle('install');assert.ok(w.saved.has('/index.html'));assert.ok(w.saved.has('/assets/main.js'));await w.lifecycle('activate');assert.deepEqual(w.deleted,['met-static-old']);w.setOffline();assert.equal(await(await w.request('/treasury',true))!.text(),'offline app');assert.equal(await(await w.request('/assets/main.js'))!.text(),'asset');const calls=w.fetched();assert.equal(await w.request('https://unrelated.test/personal'),undefined);assert.equal(w.fetched(),calls);});
test('Manifest includes valid PNG icons, standalone mode and RTL settings',()=>{const manifest=JSON.parse(readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));assert.equal(manifest.display,'standalone');assert.equal(manifest.dir,'rtl');assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');for(const icon of manifest.icons){const path=new URL(`../public${icon.src}`,import.meta.url);assert.ok(existsSync(path));assert.equal(readFileSync(path).subarray(1,4).toString(),'PNG');}});
test('Static document root serves compiled JavaScript and a complete offline shell',()=>{
  const root=new URL('../',import.meta.url);
  const html=readFileSync(new URL('index.html',root),'utf8');
  assert.doesNotMatch(html,/src=["'][^"']*\.(?:tsx?|jsx)["']/);
  assert.match(html,/type="module"[^>]*src="\.\/assets\/[^"']+\.js"/);
  for(const match of html.matchAll(/(?:src|href)="([^"']+)"/g)) assert.ok(existsSync(new URL(match[1],root)),match[1]);
  for(const path of JSON.parse(readFileSync(new URL('precache.json',root),'utf8'))) assert.ok(existsSync(new URL(path,root)),path);
  assert.match(readFileSync(new URL('src/index.html',root),'utf8'),/src="\.\/main.tsx"/);
});
test('All stylesheet rules parse and include light, dark, mobile, print and reduced-motion variants',()=>{const css=readFileSync(new URL('./styles.css',import.meta.url),'utf8');const parsed=postcss.parse(css);assert.ok(parsed.nodes.length>100);for(const rule of ['data-theme=light','prefers-reduced-motion','@media print','max-width:767px','safe-area-inset-bottom'])assert.ok(css.includes(rule));});
