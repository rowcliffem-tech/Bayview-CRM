import {PaddleOCR} from '@paddleocr/paddleocr-js';
// CPU-only runtime is selected at build time. One WASM thread works in
// Safari without changing the site's authentication/isolation headers.
let engine,queue=Promise.resolve();
const settings={worker:false,textDetectionModelName:'PP-OCRv5_mobile_det',textRecognitionModelName:'en_PP-OCRv5_mobile_rec',textDetectionModelAsset:{url:self.location.origin+'/vendor/neural-models/det.tar'},textRecognitionModelAsset:{url:self.location.origin+'/vendor/neural-models/en-rec.tar'},textRecognitionBatchSize:1,ortOptions:{backend:'wasm',numThreads:1,wasmPaths:self.location.origin+'/vendor/neural-runtime/',simd:true}};
self.onmessage=event=>{const {id,type,input}=event.data||{};queue=queue.then(async()=>{try{
 if(type==='init'){if(!engine)engine=await PaddleOCR.create(settings);self.postMessage({id,result:true});return;}
 if(type!=='read'||!engine)throw new Error('The licence reader is not ready.');
 if(!input||input.width*input.height>5000000)throw new Error('Choose a smaller photo.');
 // SDK 0.4.2's direct image adapter uses document. Its supported cv.Mat
 // input avoids DOM access in a Worker. The version is pinned and tested.
 const mat=engine.cv.matFromImageData(input);try{const [result]=await engine.predict(mat,{textDetLimitSideLen:1536,textDetLimitType:'max',textDetBoxThresh:.5,textRecScoreThresh:.3});self.postMessage({id,result});}finally{mat.delete();}
 }catch(error){self.postMessage({id,error:error instanceof Error?error.message:'The licence reader could not complete this photo.'});}});};
