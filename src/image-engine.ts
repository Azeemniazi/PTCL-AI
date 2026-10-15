import http from 'node:http';
import https from 'node:https';
import sharp from 'sharp';

export interface ImageCapabilities {
  model: string;
  generation: boolean;
  remix: boolean;
  remixSupported: boolean;
  remixVerified: boolean;
  controls: { strength: boolean; guidance: boolean; quality: boolean };
  message: string;
  remixMessage: string;
}

export class ImageInputError extends Error {
  constructor(message: string, public status = 400, public code = 'invalid_image') { super(message); }
}

export interface EngineJsonResponse {
  ok: boolean;
  status: number;
  data: any;
  rawBody: string;
}

export function requestEngineJson(urlStr: string, options: {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<EngineJsonResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    const postData = options.body !== undefined
      ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
      : null;

    const headers: Record<string, string> = {
      ...(options.headers || {})
    };
    if (postData && !headers['content-type'] && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (postData && !headers['content-length'] && !headers['Content-Length']) {
      headers['Content-Length'] = String(Buffer.byteLength(postData));
    }

    const req = client.request(url, {
      method: options.method || 'GET',
      headers
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        let data: any = null;
        try {
          data = JSON.parse(rawBody);
        } catch {
          data = null;
        }
        resolve({
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
          status: res.statusCode || 0,
          data,
          rawBody
        });
      });
    });

    const timeoutMs = options.timeoutMs ?? 3600000;
    if (timeoutMs > 0) {
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`Image engine request timed out after ${Math.round(timeoutMs / 60000)} minutes.`));
      });
    } else {
      req.setTimeout(0);
    }

    if (options.signal) {
      if (options.signal.aborted) {
        req.destroy(new Error('Image synthesis was cancelled.'));
      } else {
        options.signal.addEventListener('abort', () => {
          req.destroy(new Error('Image synthesis was cancelled.'));
        }, { once: true });
      }
    }

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

const cache = new Map<string, { expires: number; value: Promise<ImageCapabilities> }>();
async function getJson(base: string, path: string): Promise<any> {
  try {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(4000) });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

/** Capability discovery is read-only. Model-specific remix still requires a real verification run. */
export async function probeImageEngine(base: string, verified = false): Promise<ImageCapabilities> {
  const key = `${base}:${verified}`, existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.value;
  const value = (async () => {
    const [native, schema, models, health] = base ? await Promise.all([
      getJson(base, '/sdcpp/v1/capabilities'), getJson(base, '/openapi.json'),
      getJson(base, '/sdapi/v1/sd-models'), getJson(base, '/health')
    ]) : [null, null, null, null];
    const features = native?.features_by_mode?.img_gen || native?.features || {};
    const modes = native?.supported_modes;
    const nativeImageMode = Array.isArray(modes) ? modes.includes('img_gen') : native?.current_mode === 'img_gen';
    const documented = !!schema?.paths?.['/sdapi/v1/img2img']?.post;
    const remixSupported = !!((nativeImageMode && features.init_image === true) || documented);
    const availableModel = Array.isArray(models) ? models[0] : null;
    const model = native?.model?.name || availableModel?.title || availableModel?.model_name || health?.model || 'Image engine';
    const generation = !!(nativeImageMode || availableModel || schema?.paths?.['/sdapi/v1/txt2img'] || (health?.ready !== false && health?.status === 'ok'));
    const remix = generation && remixSupported && verified;
    return { model: String(model), generation, remix, remixSupported, remixVerified: verified,
      // The existing engine uses fixed turbo guidance/steps; do not promise ineffective controls.
      controls: {strength: remix, guidance: false, quality: false},
      message: generation ? 'Connected to your image engine.' : 'Image engine unavailable. Create can produce a vector preview; image remix needs a connected engine.',
      remixMessage: remix ? 'Reference images and change strength are supported.' : !generation ? 'Connect the image engine to use Remix.' : !remixSupported ? 'This engine does not advertise image-to-image support. Configure a compatible sdapi engine.' : 'Image remix is awaiting model verification. Complete the reference-image canary before enabling IMAGE_REMIX_VERIFIED.' };
  })();
  cache.set(key, {expires: Date.now()+15000, value});
  return value;
}

export const STUDIO_STYLES = ['natural','photoreal','corporate','diagram','isometric','cyber','minimalist'];
export const STUDIO_RATIOS = ['1:1','16:9','9:16','4:3'];

export const TARGET_1080P_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '4:3': { width: 1440, height: 1080 }
};

export function estimateJobDurationMs(aspectRatio: string): number {
  if (aspectRatio === '16:9' || aspectRatio === '9:16') return 950000;
  if (aspectRatio === '4:3') return 700000;
  return 480000;
}
export function parseRemixFields(form: FormData) {
  const prompt = String(form.get('prompt') || '').trim();
  if (!prompt || prompt.length > 500) throw new ImageInputError('Describe your changes in 1–500 characters.', 400, 'invalid_prompt');
  const style = String(form.get('style') || 'natural'), aspectRatio = String(form.get('aspectRatio') || '1:1');
  if (!STUDIO_STYLES.includes(style) || !STUDIO_RATIOS.includes(aspectRatio)) throw new ImageInputError('Choose a supported style and format.');
  const sourceAssetId = String(form.get('sourceAssetId') || '').trim();
  const entry = form.get('image');
  const image = entry && typeof entry !== 'string' ? entry : null;
  if (Number(!!sourceAssetId) + Number(!!image) !== 1 || (entry !== null && !image)) throw new ImageInputError('Provide exactly one reference: a gallery image or an uploaded file.', 400, 'invalid_reference');
  const strength = form.has('strength') ? Number(form.get('strength')) : 0.65;
  if (!Number.isFinite(strength) || strength < 0.1 || strength > 0.9) throw new ImageInputError('Change strength must be between 0.1 and 0.9.');
  const seed = form.get('seed') ? Number(form.get('seed')) : Math.floor(Math.random()*9000000)+1000000;
  if (!Number.isSafeInteger(seed) || seed < 1 || seed > 2147483647) throw new ImageInputError('Seed must be a whole number between 1 and 2147483647.');
  const negativePrompt = String(form.get('negativePrompt') || '').trim();
  if (negativePrompt.length > 500) throw new ImageInputError('Keep the negative prompt within 500 characters.');
  return {prompt,style,aspectRatio,sourceAssetId,image,strength,seed,negativePrompt};
}

export async function normalizeReference(bytes: Buffer, mime: string, trustedAsset = false): Promise<Buffer> {
  if (!bytes.length || bytes.length > 20*1048576) throw new ImageInputError('Choose an image between 1 byte and 20 MB.',413);
  if (!trustedAsset && !['image/jpeg','image/png','image/webp'].includes(mime)) throw new ImageInputError('Choose a JPG, PNG, or WEBP image.',415);
  try {
    const image = sharp(bytes, {limitInputPixels:40000000});
    const meta = await image.metadata();
    if (!['jpeg','png','webp',...(trustedAsset ? ['svg'] : [])].includes(meta.format || '')) throw Error('Unsupported image format.');
    if (!meta.width || !meta.height || meta.width*meta.height > 40000000) throw Error('The image is too large.');
    return await image.rotate().resize({width:1536,height:1536,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).png().toBuffer();
  } catch { throw new ImageInputError('This image could not be decoded. Choose a valid image smaller than 40 megapixels.'); }
}

export async function remixImage(base: string, input: {
  prompt: string; negativePrompt?: string; width: number; height: number; seed: number; strength: number; steps?: number; reference: Buffer;
}, signal?: AbortSignal): Promise<Buffer> {
  const response = await requestEngineJson(`${base}/sdapi/v1/img2img`, {
    method: 'POST',
    body: {
      prompt: input.prompt,
      negative_prompt: input.negativePrompt || undefined,
      init_images: [input.reference.toString('base64')],
      denoising_strength: input.strength,
      width: input.width,
      height: input.height,
      seed: input.seed,
      steps: input.steps || 4,
      cfg_scale: 1.0
    },
    timeoutMs: 3600000,
    signal
  });
  if (!response.ok) {
    throw new ImageInputError(
      response.status === 404
        ? 'The image engine does not expose image-to-image generation.'
        : `Image remix failed on the engine (${response.status}). Please retry.`,
      502,
      'remix_engine_error'
    );
  }
  const data: any = response.data;
  const encoded = data?.images?.[0];
  if (typeof encoded !== 'string' || !encoded) {
    throw new ImageInputError('The remix engine returned no image. Your reference has been preserved.', 502, 'missing_remix_image');
  }
  const bytes = Buffer.from(encoded.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
  const meta = await sharp(bytes, { limitInputPixels: 40000000 }).metadata();
  if (!meta.width || !meta.height || meta.format === 'svg') {
    throw new ImageInputError('The remix engine returned an invalid image.', 502);
  }
  return bytes;
}
