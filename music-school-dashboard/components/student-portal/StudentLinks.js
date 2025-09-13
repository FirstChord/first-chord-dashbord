'use client';

import { Music, Gamepad2, ExternalLink } from 'lucide-react';

export default function StudentLinks({ student }) {
  const handleThetaClick = () => {
    if (student.hasTheta) {
      // Open Theta Music in new tab
      window.open('https://trainer.thetamusic.com/en/user/login', '_blank');
      
      // Show credentials in a simple way
      setTimeout(() => {
        alert(`Your Theta Music login:
Username: ${student.thetaCredentials.username}
Password: ${student.thetaCredentials.password}

The login page is now open in a new tab!`);
      }, 500);
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-md">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        🎹 Your Practice Links
      </h2>
      
      <div className="space-y-4">
        {/* Soundslice Link */}
        {student.hasSoundslice ? (
          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border-2 border-purple-200 hover:border-purple-300 transition-colors">
            <div className="flex items-center gap-3">
              <Music className="w-6 h-6 text-purple-600" />
              <div>
                <h3 className="font-semibold text-gray-800">Soundslice Practice</h3>
                <p className="text-sm text-gray-600">Sheet music and play-along tracks</p>
              </div>
            </div>
            <a
              href={student.soundsliceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Open <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
            <div className="flex items-center gap-3 opacity-60">
              <Music className="w-6 h-6 text-gray-400" />
              <div>
                <h3 className="font-semibold text-gray-600">Soundslice Practice</h3>
                <p className="text-sm text-gray-500">Ask your tutor to set up your course</p>
              </div>
            </div>
          </div>
        )}

        {/* Theta Music Link */}
        {student.hasTheta ? (
          <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border-2 border-green-200 hover:border-green-300 transition-colors">
            <div className="flex items-center gap-3">
              <Gamepad2 className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-gray-800">Theta Music Games</h3>
                <p className="text-sm text-gray-600">Fun music theory games and exercises</p>
              </div>
            </div>
            <button
              onClick={handleThetaClick}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Play <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
            <div className="flex items-center gap-3 opacity-60">
              <Gamepad2 className="w-6 h-6 text-gray-400" />
              <div>
                <h3 className="font-semibold text-gray-600">Theta Music Games</h3>
                <p className="text-sm text-gray-500">Ask your tutor to set up your account</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Encouragement */}
      <div className="mt-6 p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
        <p className="text-yellow-800 font-medium">
          🌟 <strong>Keep it up!</strong> Regular practice is the key to becoming a great musician!
        </p>
      </div>
    </div>
  );
}