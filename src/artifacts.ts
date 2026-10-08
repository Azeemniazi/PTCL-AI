import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from './config.js';

export class ArtifactStore {
  private client = config.s3.endpoint ? new S3Client({region:config.s3.region,endpoint:config.s3.endpoint,forcePathStyle:config.s3.forcePathStyle,credentials:{accessKeyId:config.s3.accessKey,secretAccessKey:config.s3.secretKey}}) : undefined;
  private bucket(kind:'audio'|'snapshot'){return kind==='audio'?config.s3.audioBucket:config.s3.snapshotsBucket}
  async get(kind:'audio'|'snapshot',key:string){if(!this.client)throw new Error('Artifact storage is not configured.');const result=await this.client.send(new GetObjectCommand({Bucket:this.bucket(kind),Key:key}));if(!result.Body)throw new Error('Artifact not found.');return result.Body}
  async getBuffer(kind:'audio'|'snapshot',key:string){const body=await this.get(kind,key);return Buffer.from(await body.transformToByteArray())}
  async delete(kind:'audio'|'snapshot',key?:string){if(!this.client||!key)return;await this.client.send(new DeleteObjectCommand({Bucket:this.bucket(kind),Key:key}))}
}
export const artifacts=new ArtifactStore();
