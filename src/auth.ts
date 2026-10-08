import type { Express, NextFunction, Request, Response } from 'express';
import { generators, Issuer, type Client } from 'openid-client';
import { config } from './config.js';
import type { User } from './models.js';
import { repository } from './repository.js';

declare module 'express-session' { interface SessionData {user?:User; oidcState?:string; oidcNonce?:string} }

export async function configureAuth(app:Express){
  let client:Client|undefined;
  if(config.authMode==='entra'){
    const issuer=await Issuer.discover(`https://login.microsoftonline.com/${config.entra.tenantId}/v2.0/.well-known/openid-configuration`);
    client=new issuer.Client({client_id:config.entra.clientId,client_secret:config.entra.clientSecret,redirect_uris:[config.entra.redirectUri],response_types:['code']});
  }
  app.use(async(req,_res,next)=>{if(config.authMode==='dev'&&!req.session.user)req.session.user=await repository.upsertUser({tenantId:'development',objectId:'azeemniazi',email:'azeemniazi@cloudcore.local',displayName:'Azeem Niazi',role:'admin'});next()});
  app.post('/auth/login',async(req,res)=>{if(config.authMode==='dev'){const{username,password}=req.body??{};if((username==='azeemniazi'||username==='azeemniazi@cloudcore.local')&&password==='fatimaarif'){const user=await repository.upsertUser({tenantId:'development',objectId:'azeemniazi',email:'azeemniazi@cloudcore.local',displayName:'Azeem Niazi',role:'admin'});await new Promise<void>((resolve,reject)=>req.session.regenerate(err=>err?reject(err):resolve()));req.session.user=user;await new Promise<void>((resolve,reject)=>req.session.save(err=>err?reject(err):resolve()));return res.json({status:'ok',user})}return res.status(401).json({error:{code:'invalid_credentials',message:'Invalid username or password.'}})}return res.status(400).json({error:{code:'not_supported',message:'Use Entra ID in production.'}})});
  app.get('/auth/login',(req,res)=>{if(config.authMode==='dev')return res.redirect('/#home');const state=generators.state(),nonce=generators.nonce();req.session.oidcState=state;req.session.oidcNonce=nonce;res.redirect(client!.authorizationUrl({scope:'openid profile email',state,nonce}))});
  app.get('/auth/callback',async(req,res,next)=>{try{if(!client)throw new Error('Entra authentication is not configured.');const params=client.callbackParams(req);const oidcState=req.session.oidcState,oidcNonce=req.session.oidcNonce;const tokens=await client.callback(config.entra.redirectUri,params,{state:oidcState,nonce:oidcNonce});const claims=tokens.claims();const objectId=String(claims.oid??claims.sub);const role=config.entra.adminObjectIds.has(objectId)?'admin':'member';const user=await repository.upsertUser({tenantId:String(claims.tid??config.entra.tenantId),objectId,email:String(claims.preferred_username??claims.email??''),displayName:String(claims.name??claims.preferred_username??'CloudCore user'),role});await new Promise<void>((resolve,reject)=>req.session.regenerate(err=>err?reject(err):resolve()));req.session.user=user;await new Promise<void>((resolve,reject)=>req.session.save(err=>err?reject(err):resolve()));res.redirect('/#home')}catch(error){next(error)}});
  app.post('/auth/logout',(req,res,next)=>req.session.destroy(error=>{if(error)return next(error);res.clearCookie('cloudcore.sid');res.redirect('/')}));
}

export function requireUser(req:Request,res:Response,next:NextFunction){if(!req.session.user)return res.status(401).json({error:{code:'authentication_required',message:'Sign in to use CloudCore AI.'}});res.locals.user=req.session.user;next()}
