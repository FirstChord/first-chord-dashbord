import { ExternalLink } from 'lucide-react';
import { SheetMusicIcon } from '@/components/shared/FCIcons';

export default function StudentLinks({ student }) {
  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-md border border-[#2F6B3D]/25">
      <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">
        Your Practice Links
      </h2>

      <div className="space-y-4">
        {/* Soundslice Link */}
        {student.hasSoundslice ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-purple-50 rounded-lg border-2 border-purple-200 hover:border-purple-300 transition-colors gap-3 sm:gap-0">
            <div className="flex items-center gap-3">
              <SheetMusicIcon className="w-8 h-8 sm:w-9 sm:h-9" />
              <div>
                <h3 className="font-semibold text-gray-800 text-sm sm:text-base">Soundslice Practice</h3>
                <p className="text-xs sm:text-sm text-gray-600">Sheet music and play-along tracks</p>
              </div>
            </div>
            <a
              href={student.soundsliceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm sm:text-base"
            >
              Open <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
            <div className="flex items-center gap-3 opacity-60">
              <SheetMusicIcon className="w-9 h-9 grayscale opacity-60" />
              <div>
                <h3 className="font-semibold text-gray-600">Soundslice Practice</h3>
                <p className="text-sm text-gray-500">Ask your tutor to set up your course</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
