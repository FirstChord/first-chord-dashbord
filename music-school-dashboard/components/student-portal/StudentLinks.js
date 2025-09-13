'use client';

import { Music, Gamepad2, ExternalLink, Copy, Check, ExternalLink as LinkIcon } from 'lucide-react';
import { useState } from 'react';

export default function StudentLinks({ student }) {
  const [showCredentials, setShowCredentials] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleThetaClick = (e) => {
    if (student.hasTheta) {
      e.preventDefault();
      setShowCredentials(true);
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      console.log(`${type} copied to clipboard`);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const openLoginPage = () => {
    // First, try to logout by opening the logout URL, then redirect to login
    const logoutUrl = 'https://trainer.thetamusic.com/en/user/logout';
    const loginUrl = 'https://trainer.thetamusic.com/en/user/login';
    
    // Open logout URL first
    const logoutTab = window.open(logoutUrl, '_blank');
    
    // After a short delay, redirect the same tab to the login page
    setTimeout(() => {
      if (logoutTab && !logoutTab.closed) {
        logoutTab.location.href = loginUrl;
      }
    }, 1500); // 1.5 second delay to allow logout to process
    
    setShowCredentials(false);
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

      {/* Credentials Modal */}
      {showCredentials && student.hasTheta && (
        <div className="fixed inset-0 backdrop-blur-sm bg-white bg-opacity-10 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border">
            <div className="text-center mb-4">
              <Gamepad2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-gray-800">
                Theta Music Games Login
              </h3>
              <p className="text-sm text-gray-600">
                Use this for both username and password
              </p>
            </div>

            <div className="space-y-4">
              {/* Single Credential */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username & Password
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={student.thetaCredentials.username}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 font-mono text-center text-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => copyToClipboard(student.thetaCredentials.username, 'Credentials')}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  copySuccess 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {copySuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={openLoginPage}
                className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <LinkIcon className="w-4 h-4" />
                Go to Login
              </button>
            </div>

            <button
              onClick={() => setShowCredentials(false)}
              className="w-full mt-3 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}