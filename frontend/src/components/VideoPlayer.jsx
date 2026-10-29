import MuxPlayer from '@mux/mux-player-react/lazy';
import { posterUrl } from '../media.js';

// Mux streams in ~2 s HLS chunks. hls.js would otherwise keep buffering up to
// 10 minutes ahead on low-bitrate movies; stay 30-60 s ahead to save viewers' data.
const hlsConfig = { maxBufferLength: 30, maxMaxBufferLength: 60 };

export default function VideoPlayer({ movie }) {
  return (
    <div className="player-frame">
      {/* Mux serves adaptive HLS; the player handles it in every browser. */}
      <MuxPlayer
        key={movie.mux_playback_id}
        playbackId={movie.mux_playback_id}
        poster={posterUrl(movie.mux_playback_id, 1280)}
        metadata={{ video_title: movie.title }}
        accentColor="#e50914"
        streamType="on-demand"
        preload="metadata"
        _hlsConfig={hlsConfig}
        style={{ width: '100%', aspectRatio: '16 / 9' }}
      />
    </div>
  );
}
