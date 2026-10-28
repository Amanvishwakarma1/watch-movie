import { v2 as cloudinary } from 'cloudinary';
import crypto from 'node:crypto';
import { config } from '../config.js';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true
});

// MOV/QuickTime is left out on purpose: Chrome and Firefox cannot play most of it.
export const uploadKinds = {
  poster: { resourceType: 'image', folder: 'movie-streaming/posters', formats: 'jpg,png,webp' },
  video: { resourceType: 'video', folder: 'movie-streaming/videos', formats: 'mp4,webm' }
};

const publicIdPattern = /^movie-streaming\/(posters|videos)\/[0-9a-f-]{36}$/;

export function isOwnPublicId(publicId, kind) {
  return typeof publicId === 'string'
    && publicIdPattern.test(publicId)
    && publicId.startsWith(`${uploadKinds[kind].folder}/`);
}

// The browser uploads straight to Cloudinary with these signed params, so
// media never passes through the (small, free-tier) API server.
export function signUpload(kind) {
  const { resourceType, folder, formats } = uploadKinds[kind];
  const params = {
    public_id: `${folder}/${crypto.randomUUID()}`,
    allowed_formats: formats,
    timestamp: Math.round(Date.now() / 1000)
  };
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/${resourceType}/upload`,
    params: {
      ...params,
      api_key: config.cloudinary.apiKey,
      signature: cloudinary.utils.api_sign_request(params, config.cloudinary.apiSecret)
    },
    maxBytes: kind === 'video' ? config.maxVideoBytes : config.maxPosterBytes
  };
}

// Returns the stored asset, or null if it does not exist on Cloudinary.
export async function getAsset(publicId, resourceType) {
  try {
    return await cloudinary.api.resource(publicId, { resource_type: resourceType });
  } catch (error) {
    if (error?.error?.http_code === 404) return null;
    throw new Error(error?.error?.message || error.message || 'Cloudinary lookup failed.');
  }
}

export async function deleteAsset(publicId, resourceType) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true
    });
  } catch (error) {
    console.error(`Cloudinary cleanup failed for ${publicId}:`, error?.error?.message || error.message);
  }
}
