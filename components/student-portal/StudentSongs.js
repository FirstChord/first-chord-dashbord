import { ExternalLink } from 'lucide-react';
import { SheetMusicIcon } from '@/components/shared/FCIcons';

// "Your songs" — the pieces this student's tutor has assigned.
// Server component; renders nothing when there are no assignments.
export default function StudentSongs({ songs = [] }) {
  if (songs.length === 0) return null;

  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-md border border-[#2F6B3D]/25">
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Your Songs</h2>
      <ul className="space-y-3">
        {songs.map((song) => (
          <li
            key={song.songId}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-green-50 rounded-lg border-2 border-green-200"
          >
            <div className="flex items-center gap-3 min-w-0">
              <SheetMusicIcon className="w-8 h-8 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-gray-800">
                  {song.title}
                  <span className="font-normal text-gray-500"> — {song.artist}</span>
                </p>
                {song.studentNote && (
                  <p className="text-xs sm:text-sm text-gray-600">{song.studentNote}</p>
                )}
              </div>
            </div>
            <a
              href={song.soundsliceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-[#2F6B3D] text-white rounded-lg hover:bg-[#265732] transition-colors font-medium text-sm sm:text-base shrink-0"
            >
              Play <ExternalLink className="w-4 h-4" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
