import { ExternalLink, Music, Gamepad2, FileText, Copy, ExternalLink as LinkIcon, Check } from 'lucide-react';
import { generateSmartUrls } from '@/lib/config';
import { useState } from 'react';

export default function QuickLinks({ student }) {
  const [showCredentials, setShowCredentials] = useState(false);
  const [currentCredentials, setCurrentCredentials] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Early return if no student is provided
  if (!student) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
        <p className="text-gray-500">Select a student to view quick links</p>
      </div>
    );
  }

  const smartUrls = {
    soundslice: generateSmartUrls.soundslice(student),
    thetaMusic: generateSmartUrls.thetaMusic(student),
    myMusicStaff: generateSmartUrls.myMusicStaff(student)
  };

  const links = [
    {
      name: "Soundslice Folder",
      icon: <Music className="w-5 h-5" />,
      url: smartUrls.soundslice.url,
      instruction: smartUrls.soundslice.instruction,
      requiresAuth: smartUrls.soundslice.requiresAuth,
      color: "bg-purple-500"
    },
    {
      name: "Theta Music Games", 
      icon: <Gamepad2 className="w-5 h-5" />,
      url: smartUrls.thetaMusic.url,
      instruction: smartUrls.thetaMusic.instruction,
      requiresAuth: smartUrls.thetaMusic.requiresAuth,
      credentials: smartUrls.thetaMusic.credentials,
      autoLogin: smartUrls.thetaMusic.autoLogin,
      color: "bg-green-500"
    },
    {
      name: "MyMusicStaff Profile",
      icon: <FileText className="w-5 h-5" />,
      url: smartUrls.myMusicStaff.url,
      instruction: smartUrls.myMusicStaff.instruction,
      requiresAuth: smartUrls.myMusicStaff.requiresAuth,
      color: "bg-blue-500"
    }
  ];
  
  const handleThetaMusicClick = (e, link) => {
    if (link.autoLogin && link.credentials) {
      e.preventDefault();
      setCurrentCredentials({
        username: link.credentials.username,
        password: link.credentials.password,
        url: link.url,
        serviceName: link.name
      });
      setShowCredentials(true);
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      console.log(`${type} copied to clipboard`);
      // Reset the success state after 2 seconds
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
    const loginUrl = currentCredentials.url;
    
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
    <>
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800 mb-3">Quick Access</h3>
        {links.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={link.name === "Theta Music Games" ? (e) => handleThetaMusicClick(e, link) : undefined}
            className="flex items-center gap-3 p-4 bg-white rounded-lg border hover:shadow-md transition-shadow group"
          >
            <div className={`${link.color} text-white p-2 rounded-lg`}>
              {link.icon}
            </div>
            <div className="flex-1">
              <div className="font-medium">{link.name}</div>
              <div className="text-sm text-gray-500">{link.instruction}</div>
              {link.requiresAuth && link.credentials && !link.autoLogin && (
                <div className="text-xs text-yellow-600 mt-1">
                  🔑 {link.credentials.passwordHint}
                </div>
              )}
              {link.autoLogin && (
                <div className="text-xs text-green-600 mt-1">
                  ⚡ Auto-fill: {link.credentials.username}
                </div>
              )}
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          </a>
        ))}
      </div>

      {/* Credentials Modal */}
      {showCredentials && currentCredentials && (
        <div className="fixed inset-0 backdrop-blur-sm bg-white bg-opacity-10 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border">
            <div className="text-center mb-4">
              <Gamepad2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-gray-800">
                {currentCredentials.serviceName} Login
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
                    value={currentCredentials.username}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 font-mono text-center text-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => copyToClipboard(currentCredentials.username, 'Credentials')}
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
          </div>
        </div>
      )}
    </>
  );
}
