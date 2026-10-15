/** Isolated, loopback-only visual review fixture. Never used by the application server. */
import {createServer} from 'node:http';
import {readFileSync,createReadStream,existsSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import sharp from 'sharp';

const root=resolve('dist');
const examples=[['example-datacenter.png','An architectural study of an enterprise data center, soft natural light','photoreal','16:9'],['example-tower.png','A telecom tower above Islamabad, the city stretching to the horizon','natural','9:16'],['example-map.png','A satellite perspective on connected places and urban landscapes','corporate','4:3'],['diagram.svg','A clear diagram of a resilient cloud network','diagram','16:9']];
const assets=await Promise.all(Array.from({length:12},async(_,n)=>{
  const [filename,prompt,style,aspectRatio]=examples[n%examples.length];const meta=await sharp(readFileSync(resolve(root,'assets',filename))).metadata();
  return {id:'review-'+n,filename,url:'/assets/'+filename,prompt,style,aspectRatio,width:meta.width,height:meta.height,seed:847231+n,createdAt:new Date(Date.now()-n*3600000).toISOString(),operation:'generate',durationMs:84000};
}));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4'};
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/api/')){
    if(req.method!=='GET'){res.writeHead(405,{'content-type':'application/json'});return res.end(JSON.stringify({error:{message:'Visual fixture: actions do not modify saved data.'}}));}
    let data={};
    if(url.pathname==='/api/me')data={user:{id:'visual-review',displayName:'Studio Review',role:'user'}};
    if(url.pathname==='/api/images/history')data={assets:process.argv.includes('--empty')?[]:assets};
    if(url.pathname==='/api/images/capabilities')data={model:'Visual review fixture',generation:true,remix:false,controls:{},message:'Isolated design review. No inference service is connected.',remixMessage:'This preview contains sample assets. Real remix is verified separately.'};
    if(url.pathname==='/api/images/jobs/active')data={activeJob:null};
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify(data));
  }
  const file=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store'});createReadStream(file).pipe(res);
});
server.listen(Number(process.env.STUDIO_PREVIEW_PORT||4173),'127.0.0.1',()=>console.log('Isolated studio review: http://127.0.0.1:'+(process.env.STUDIO_PREVIEW_PORT||4173)+'/#images'));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>process.exit(0)));
