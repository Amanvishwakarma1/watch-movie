import { posterUrl } from '../media.js';

const mimeTypes = { mp4: 'video/mp4', webm: 'video/webm' };

export default function VideoPlayer({ movie }) {
  return (
    <div className="player-frame">
      {/* key: a <video> does not reload when only its <source> changes */}
      <video key={movie.video_url} controls playsInline preload="metadata" poster={posterUrl(movie.poster_url, 1280)}>
        <source src={movie.video_url} type={mimeTypes[movie.video_format]} />
        Your browser does not support video playback.
      </video>
    </div>
  );
}
