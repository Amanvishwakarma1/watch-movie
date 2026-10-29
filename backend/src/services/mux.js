import Mux from '@mux/mux-node';
import { config } from '../config.js';

const mux = new Mux({ tokenId: config.mux.tokenId, tokenSecret: config.mux.tokenSecret });

// Tags every asset we create so the API only ever publishes its own uploads.
const PASSTHROUGH = 'nightscreen';

// The browser PUTs the video straight to this Mux URL, so media never
// passes through the (small, free-tier) API server.
export async function createDirectUpload(corsOrigin) {
  const upload = await mux.video.uploads.create({
    cors_origin: corsOrigin,
    new_asset_settings: {
      playback_policies: ['public'],
      video_quality: 'basic',
      passthrough: PASSTHROUGH
    }
  });
  return { uploadId: upload.id, uploadUrl: upload.url, maxBytes: config.maxVideoBytes };
}

async function find(call) {
  try {
    return await call();
  } catch (error) {
    if (error?.status === 404) return null;
    throw new Error(error?.error?.error?.messages?.[0] || error.message || 'Mux lookup failed.');
  }
}

// status: waiting (still uploading) | processing | ready | errored
export async function getUploadState(uploadId) {
  const upload = await find(() => mux.video.uploads.retrieve(uploadId));
  if (!upload) return null;
  if (upload.status === 'errored' || upload.status === 'cancelled' || upload.status === 'timed_out') {
    return { status: 'errored', error: upload.error?.message || `Upload ${upload.status.replace('_', ' ')}.` };
  }
  if (!upload.asset_id) return { status: 'waiting' };

  const asset = await find(() => mux.video.assets.retrieve(upload.asset_id));
  if (!asset || asset.passthrough !== PASSTHROUGH) return null;
  if (asset.status === 'errored') {
    return { status: 'errored', assetId: asset.id, error: asset.errors?.messages?.[0] || 'Mux could not process this video.' };
  }
  const playbackId = asset.playback_ids?.find(p => p.policy === 'public')?.id;
  if (asset.status !== 'ready' || !playbackId) return { status: 'processing', assetId: asset.id };
  return { status: 'ready', assetId: asset.id, playbackId, duration: asset.duration };
}

// Removes the upload's asset (or cancels the upload if the file never arrived).
export async function discardUpload(uploadId) {
  try {
    const upload = await find(() => mux.video.uploads.retrieve(uploadId));
    if (!upload) return;
    if (upload.asset_id) await deleteAsset(upload.asset_id);
    else if (upload.status === 'waiting') await mux.video.uploads.cancel(uploadId);
  } catch (error) {
    console.error(`Mux cleanup failed for upload ${uploadId}:`, error.message);
  }
}

export async function deleteAsset(assetId) {
  if (!assetId) return;
  try {
    await mux.video.assets.delete(assetId);
  } catch (error) {
    if (error?.status === 404) return;
    console.error(`Mux cleanup failed for asset ${assetId}:`, error.message);
  }
}
