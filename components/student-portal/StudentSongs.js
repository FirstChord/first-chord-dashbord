import { ExternalLink, Check } from 'lucide-react';
import { SheetMusicIcon } from '@/components/shared/FCIcons';

// Student-facing labels for the statuses worth showing. 'assigned' is the
// default state and gets no chip; 'parked' rows never reach the portal.
const STATUS_CHIPS = {
  working: { label: 'Working on now', className: 'bg-amber-100 text-amber-800' },
  ready: { label: 'Ready to play', className: 'bg-blue-100 text-blue-800' },
  done: { label: 'Done', className: 'bg-green-200 text-green-900' },
};

// "Your songs" — the pieces this student's tutor has assigned, in order.
// Server component; renders nothing when there are no assignments.
export default function StudentSongs({ songs = [] }) {
  if (songs.length === 0) return null;

  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-md border border-[#2F6B3D]/25">
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Your Songs</h2>
      <ul className="space-y-3">
        {songs.map((song, index) => (
          <li
            key={song.songId}
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 rounded-lg border-2 ${
              song.status === 'done'
                ? 'bg-gray-50 border-gray-200'
                : 'bg-green-50 border-green-200'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <SheetMusicIcon className="w-8 h-8 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-gray-800">
                  <span className="text-gray-400">{index + 1}. </span>
                  {song.title}
                  <span className="font-normal text-gray-500"> — {song.artist}</span>
                  {STATUS_CHIPS[song.status] && (
                    <span
                      className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium align-middle ${STATUS_CHIPS[song.status].className}`}
                    >
                      {song.status === 'done' && <Check className="h-3 w-3" />}
                      {STATUS_CHIPS[song.status].label}
                    </span>
                  )}
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
