// Local image preparation. No network requests or recognition service.
export const cardCorners=rect=>[{x:rect.x,y:rect.y},{x:rect.x+rect.w,y:rect.y},{x:rect.x+rect.w,y:rect.y+rect.h},{x:rect.x,y:rect.y+rect.h}];
export function validCardCorners(points){
 if(!Array.isArray(points)||points.length!==4||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>1||p.y>1))return false;
 const crosses=points.map((p,i)=>{const q=points[(i+1)%4],r=points[(i+2)%4];return (q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x);});
 const area=Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%4];return sum+p.x*q.y-q.x*p.y;},0))/2;
 return crosses.every(n=>n>.0001)&&area>.01&&points.every((p,i)=>Math.hypot(p.x-points[(i+1)%4].x,p.y-points[(i+1)%4].y)>.03);
}
export function cardProjection(points){
 if(!validCardCorners(points))throw new Error('Place the four handles on the card corners without crossing them.');
 const [p,q,r,s]=points,dx1=q.x-r.x,dx2=s.x-r.x,dx3=p.x-q.x+r.x-s.x,dy1=q.y-r.y,dy2=s.y-r.y,dy3=p.y-q.y+r.y-s.y,den=dx1*dy2-dx2*dy1;
 const g=Math.abs(dx3)+Math.abs(dy3)<1e-10?0:(dx3*dy2-dx2*dy3)/den,h=Math.abs(dx3)+Math.abs(dy3)<1e-10?0:(dx1*dy3-dx3*dy1)/den;
 return (u,v)=>{const z=g*u+h*v+1;return {x:((q.x-p.x+g*q.x)*u+(s.x-p.x+h*s.x)*v+p.x)/z,y:((q.y-p.y+g*q.y)*u+(s.y-p.y+h*s.y)*v+p.y)/z};};
}
export function straightenLicenseImage(image,points,turn=0){
 const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height,rotatedWidth=turn%2?height:width,rotatedHeight=turn%2?width:height,scale=Math.min(1,3000/Math.max(rotatedWidth,rotatedHeight)),sw=Math.round(rotatedWidth*scale),sh=Math.round(rotatedHeight*scale),source=document.createElement('canvas');source.width=sw;source.height=sh;const ctx=source.getContext('2d',{willReadFrequently:true});
 ctx.save();ctx.scale(scale,scale);if(turn===1)ctx.transform(0,1,-1,0,height,0);if(turn===2)ctx.transform(-1,0,0,-1,width,height);if(turn===3)ctx.transform(0,-1,1,0,0,width);ctx.drawImage(image,0,0);ctx.restore();
 const project=cardProjection(points),edge=Math.max(Math.hypot((points[1].x-points[0].x)*sw,(points[1].y-points[0].y)*sh),Math.hypot((points[2].x-points[3].x)*sw,(points[2].y-points[3].y)*sh)),target=document.createElement('canvas');target.width=Math.round(Math.min(2600,Math.max(1000,edge)));target.height=Math.round(target.width/1.586);
 const input=ctx.getImageData(0,0,sw,sh).data,out=target.getContext('2d').createImageData(target.width,target.height),w=target.width,h=target.height;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=project(x/(w-1),y/(h-1)),sx=Math.max(0,Math.min(sw-1,p.x*(sw-1))),sy=Math.max(0,Math.min(sh-1,p.y*(sh-1))),x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(sw-1,x0+1),y1=Math.min(sh-1,y0+1),fx=sx-x0,fy=sy-y0,k=(y*w+x)*4;for(let c=0;c<3;c++)out.data[k+c]=input[(y0*sw+x0)*4+c]*(1-fx)*(1-fy)+input[(y0*sw+x1)*4+c]*fx*(1-fy)+input[(y1*sw+x0)*4+c]*(1-fx)*fy+input[(y1*sw+x1)*4+c]*fx*fy;out.data[k+3]=255;}
 target.getContext('2d').putImageData(out,0,0);return target;
}
export function imageQuality(pixels,width,height,originalWidth=width){
 const gray=new Float32Array(width*height);let total=0,squared=0,clipped=0;
 for(let i=0;i<gray.length;i++){const v=.299*pixels[i*4]+.587*pixels[i*4+1]+.114*pixels[i*4+2];gray[i]=v;total+=v;squared+=v*v;if(v>250)clipped++;}
 const mean=total/gray.length,contrast=Math.sqrt(Math.max(0,squared/gray.length-mean*mean));let sum=0,sum2=0,n=0;
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=y*width+x,v=4*gray[i]-gray[i-1]-gray[i+1]-gray[i-width]-gray[i+width];sum+=v;sum2+=v*v;n++;}
 const sharpness=n?Math.max(0,sum2/n-(sum/n)**2):0,warnings=[];
 if(originalWidth<1000)warnings.push('Move closer: the ID is small in this photo.');
 if(mean<65)warnings.push('Add even light: this photo is dark.');
 if(contrast<23)warnings.push('Low contrast: check lighting and reflections.');
 if(sharpness<35)warnings.push('Check focus: the text may be blurred.');
 if(clipped/gray.length>.7&&contrast<35)warnings.push('Possible overexposure: tilt the card away from bright light.');
 return {warnings,sharpness,contrast,mean};
}
export function inspectLicenseImage(image){const canvas=document.createElement('canvas'),width=image.naturalWidth||image.width,height=image.naturalHeight||image.height,scale=Math.min(1,800/width);canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);return imageQuality(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,width);}
