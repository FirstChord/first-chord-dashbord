import { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

export default function AuthStatus({ student }) {
  const [status, setStatus] = useState({
    soundslice: 'checking',
    myMusicStaff: 'checking',
    theta: 'checking'
  });

  useEffect(() => {
    // Check if services are accessible (this is a simple version)
    // In reality, you might ping each service or check cookies
    setTimeout(() => {
      setStatus({
        soundslice: 'logged-in',
        myMusicStaff: 'logged-in', 
        theta: 'needs-login'
      });
    }, 1000);
  }, [student]);

  const statusConfig = {
    'logged-in': { icon: CheckCircle, color: 'text-green-500', text: 'Ready' },
    'needs-login': { icon: AlertCircle, color: 'text-yellow-500', text: 'Login Required' },
    'checking': { icon: AlertCircle, color: 'text-gray-400', text: 'Checking...' }
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg mb-4">
      <h3 className="font-semibold mb-3">Service Status</h3>
      <div className="space-y-2">
        {Object.entries(status).map(([service, statusType]) => {
          const config = statusConfig[statusType] || statusConfig['checking']; // Fallback to 'checking'
          const Icon = config.icon;
          return (
            <div key={service} className="flex items-center justify-between">
              <span className="capitalize">{service.replace(/([A-Z])/g, ' $1').trim()}</span>
              <div className={`flex items-center gap-2 ${config.color}`}>
                <Icon className="w-4 h-4" />
                <span className="text-sm">{config.text}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
