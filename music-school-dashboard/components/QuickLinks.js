import { ExternalLink, Music, Brain, FileText } from 'lucide-react';
import { generateSmartUrls } from '@/lib/config';

export default function QuickLinks({ student }) {
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
      name: "Theta Music Trainer", 
      icon: <Brain className="w-5 h-5" />,
      url: smartUrls.thetaMusic.url,
      instruction: smartUrls.thetaMusic.instruction,
      requiresAuth: smartUrls.thetaMusic.requiresAuth,
      credentials: smartUrls.thetaMusic.credentials,
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
  
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-800 mb-3">Quick Access</h3>
      {links.map((link) => (
        <a
          key={link.name}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 bg-white rounded-lg border hover:shadow-md transition-shadow group"
        >
          <div className={`${link.color} text-white p-2 rounded-lg`}>
            {link.icon}
          </div>
          <div className="flex-1">
            <div className="font-medium">{link.name}</div>
            <div className="text-sm text-gray-500">{link.instruction}</div>
            {link.requiresAuth && link.credentials && (
              <div className="text-xs text-yellow-600 mt-1">
                🔑 {link.credentials.passwordHint}
              </div>
            )}
          </div>
          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        </a>
      ))}
    </div>
  );
}
