// Shared non-sensitive formatting helpers used by the phone UI.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {rolldown} from 'rolldown';
await import('./generate-app-icons.mjs');
fs.copyFileSync(new URL('../lib/license-crop.mjs',import.meta.url),new URL('../public/license-crop.js',import.meta.url));
fs.copyFileSync(new URL('../lib/license-data.mjs',import.meta.url),new URL('../public/license-data.js',import.meta.url));
fs.copyFileSync(new URL('../lib/license-image.mjs',import.meta.url),new URL('../public/license-image.js',import.meta.url));
fs.writeFileSync(new URL('../ui/mobile-template.ts',import.meta.url),'// Generated from ui/mobile.html\nexport const mobileHtml='+JSON.stringify(fs.readFileSync(new URL('../ui/mobile.html',import.meta.url),'utf8'))+';\n');
fs.mkdirSync(new URL('../public/vendor/',import.meta.url),{recursive:true});
const bundle=await rolldown({input:new URL('../lib/mobile-license-reader.mjs',import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/,'$1:'),platform:'browser'});
await bundle.write({file:new URL('../public/vendor/license-reader.js',import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/,'$1:'),format:'es',minify:true});await bundle.close();
const appRoot=fileURLToPath(new URL('../',import.meta.url));
const neural=await rolldown({input:path.join(appRoot,'lib/neural-license-worker.mjs'),platform:'browser',external:['fs','path','crypto','url','os','module'],plugins:[{name:'cpu-only-runtime',resolveId(source){if(source==='onnxruntime-web')return path.join(appRoot,'node_modules/onnxruntime-web/dist/ort.wasm.bundle.min.mjs');}}]});
await neural.write({file:path.join(appRoot,'public/vendor/neural-worker.js'),format:'es',minify:true,codeSplitting:false});await neural.close();
const runtime=path.join(appRoot,'public/vendor/neural-runtime');fs.mkdirSync(runtime,{recursive:true});
for(const name of ['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])fs.copyFileSync(path.join(appRoot,'node_modules/onnxruntime-web/dist',name),path.join(runtime,name));
fs.copyFileSync(path.join(appRoot,'public/vendor/neural-models/ONNX-LICENSE.txt'),path.join(runtime,'LICENSE.txt'));
const modelRoot=path.join(appRoot,'public/vendor/neural-models'),manifest=JSON.parse(fs.readFileSync(path.join(modelRoot,'manifest.json'),'utf8'));
for(const model of manifest.models){const bytes=fs.readFileSync(path.join(modelRoot,model.file));if(createHash('sha256').update(bytes).digest('hex')!==model.sha256)throw new Error('Neural model checksum mismatch: '+model.file);}
const ocr=new URL('../public/vendor/ocr/',import.meta.url);fs.mkdirSync(new URL('core/',ocr),{recursive:true});fs.mkdirSync(new URL('lang-best-v1/',ocr),{recursive:true});
fs.copyFileSync(new URL('../node_modules/tesseract.js/dist/worker.min.js',import.meta.url),new URL('worker.min.js',ocr));
for(const name of fs.readdirSync(new URL('../node_modules/tesseract.js-core/',import.meta.url)).filter(n=>/^tesseract-core.*\.wasm\.js$/.test(n)))fs.copyFileSync(new URL('../node_modules/tesseract.js-core/'+name,import.meta.url),new URL('core/'+name,ocr));
fs.copyFileSync(new URL('../node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',import.meta.url),new URL('lang-best-v1/eng.traineddata.gz',ocr));
fs.copyFileSync(new URL('../node_modules/tesseract.js/LICENSE.md',import.meta.url),new URL('TESSERACT-LICENSE.txt',ocr));
fs.copyFileSync(new URL('../node_modules/tesseract.js-core/LICENSE',import.meta.url),new URL('CORE-LICENSE.txt',ocr));
