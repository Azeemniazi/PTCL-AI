import {lookup} from 'node:dns/promises';
import {get} from 'node:https';
import type {IncomingMessage} from 'node:http';
import {isIP} from 'node:net';
import {ImageInputError,normalizeReference} from './image-engine.js';

export function publicImageAddress(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a=0,b=0,c=0]=address.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||
    (a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||(b===0&&(c===0||c===2))))||
    (a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
}
export function parseImageUrl(value: string): URL {
  let url: URL;
  try { url=new URL(value); } catch {throw new ImageInputError('Enter a valid HTTPS image URL.');}
  if(value.length>2048||url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||url.hash) throw new ImageInputError('Use a public HTTPS image URL without credentials, custom ports, or fragments.');
  return url;
}

/** Resolve every redirect and pin a public IPv4 address to prevent DNS rebinding/SSRF. */
export async function downloadImageUrl(value: string): Promise<Buffer> {
  let url=parseImageUrl(value);
  const signal=AbortSignal.timeout(15000);
  for(let redirects=0;redirects<=3;redirects++) {
    const addresses=await lookup(url.hostname,{all:true,family:4});
    signal.throwIfAborted();
    if(!addresses.length||addresses.some(a=>!publicImageAddress(a.address))) throw new ImageInputError('Private and local image URLs are not supported. Upload the image instead.');
    const address=addresses[0]!.address;
    const response=await new Promise<IncomingMessage>((resolve,reject)=>{
      const request=get(url,{signal,family:4,lookup:(_hostname,_options,callback)=>callback(null,address,4),headers:{accept:'image/png,image/jpeg,image/webp'}},resolve);
      request.on('error',reject);
    });
    if([301,302,303,307,308].includes(response.statusCode||0)) {
      const location=response.headers.location;response.destroy();
      if(!location||redirects===3) throw new ImageInputError('This URL redirects too many times. Upload the image instead.');
      url=parseImageUrl(new URL(location,url).href);continue;
    }
    if(response.statusCode!==200) {response.destroy();throw new ImageInputError('The image URL could not be loaded. Check the link or upload the image.');}
    const mime=(response.headers['content-type']||'').split(';')[0]!.toLowerCase();
    if(!['image/jpeg','image/png','image/webp'].includes(mime)) {response.destroy();throw new ImageInputError('This link must point directly to a JPG, PNG, or WEBP image.');}
    if(Number(response.headers['content-length'])>20*1048576) {response.destroy();throw new ImageInputError('Choose an image smaller than 20 MB.',413);}
    const chunks:Buffer[]=[];let size=0;
    for await(const part of response) {const bytes=Buffer.from(part);size+=bytes.length;if(size>20*1048576){response.destroy();throw new ImageInputError('Choose an image smaller than 20 MB.',413);}chunks.push(bytes);}
    return normalizeReference(Buffer.concat(chunks),mime);
  }
  throw new ImageInputError('The image could not be loaded. Upload it instead.');
}
