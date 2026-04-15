import { useState } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import { serviceAuth } from '@/lib/config';

export default function SetupWizard({ tutorName, onComplete }) {
  const [completedSteps, setCompletedSteps] = useState({
    chromeProfile: false,
    soundslice: false,
    myMusicStaff: false,
    bitwarden: false,
    testStudent: false
  });

  const markComplete = (step) => {
    setCompletedSteps(prev => ({ ...prev, [step]: true }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">
          One-Time Setup for {tutorName}
        </h2>
        
        <div className="space-y-6">
          {/* Step 1: Chrome Profile - Simplified for Mac user accounts */}
          <SetupStep
            number="1"
            title="Verify Chrome Setup"
            completed={completedSteps.chromeProfile}
            onComplete={() => markComplete('chromeProfile')}
          >
            <p className="text-sm text-gray-600">
              You're logged into your Mac account as {tutorName}.<br/>
              Chrome is already set up with your profile.
            </p>
            <p className="text-sm text-green-600 mt-2">
              ✓ No action needed - click "Mark Done"
            </p>
          </SetupStep>

          {/* Step 2: Soundslice (Shared) */}
          <SetupStep
            number="2"
            title="Log into Soundslice (Shared School Account)"
            completed={completedSteps.soundslice}
            onComplete={() => markComplete('soundslice')}
          >
            <div className="bg-blue-50 p-3 rounded">
              <p className="text-sm">
                <strong>Username:</strong> {serviceAuth.soundslice.username}<br/>
                <strong>Password:</strong> [Check password manager]<br/>
                <strong>Important:</strong> Check "Remember Me" / "Stay Logged In"
              </p>
            </div>
            <a 
              href="https://www.soundslice.com/login" 
              target="_blank"
              className="text-blue-600 text-sm underline"
            >
              Open Soundslice Login →
            </a>
          </SetupStep>

          {/* Step 3: MyMusicStaff (Individual) */}
          <SetupStep
            number="3"
            title="Log into MyMusicStaff (Your Personal Account)"
            completed={completedSteps.myMusicStaff}
            onComplete={() => markComplete('myMusicStaff')}
          >
            <div className="bg-green-50 p-3 rounded">
              <p className="text-sm">
                <strong>Your Username:</strong> {serviceAuth.myMusicStaff.accounts[tutorName]}<br/>
                <strong>Password:</strong> [Your personal MMS password]<br/>
                <strong>Important:</strong> Check "Remember Me"
              </p>
            </div>
            <a 
              href="https://yourschool.mymusicstaff.com/login" 
              target="_blank"
              className="text-blue-600 text-sm underline"
            >
              Open MyMusicStaff Login →
            </a>
          </SetupStep>

          {/* Step 4: Password Manager */}
          <SetupStep
            number="4"
            title="Set Up Bitwarden for Student Logins"
            completed={completedSteps.bitwarden}
            onComplete={() => markComplete('bitwarden')}
          >
            <ol className="text-sm space-y-1">
              <li>1. Install Bitwarden extension</li>
              <li>2. Log into school's Bitwarden account</li>
              <li>3. Verify you can see "Theta Students" folder</li>
              <li>4. Test autofill on a Theta login page</li>
            </ol>
          </SetupStep>

          {/* Step 5: Test */}
          <SetupStep
            number="5"
            title="Test with One Student"
            completed={completedSteps.testStudent}
            onComplete={() => markComplete('testStudent')}
          >
            <p className="text-sm">
              Go back to dashboard and click on Emma Thompson. Verify:
            </p>
            <ul className="text-sm mt-2 space-y-1">
              <li>✓ Soundslice opens to her folder (no login needed)</li>
              <li>✓ MyMusicStaff opens to her profile (no login needed)</li>
              <li>✓ Theta login auto-fills with Bitwarden</li>
            </ul>
          </SetupStep>
        </div>

        <div className="mt-8 flex justify-between">
          <button
            onClick={onComplete}
            className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Close Setup
          </button>
          
          {Object.values(completedSteps).every(v => v) && (
            <button
              onClick={onComplete}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              ✓ Setup Complete!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SetupStep({ number, title, completed, onComplete, children }) {
  return (
    <div className={`border rounded-lg p-4 ${completed ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
              {number}
            </span>
            {title}
          </h3>
          <div className="mt-3 ml-8">
            {children}
          </div>
        </div>
        <button
          onClick={onComplete}
          className={`ml-4 px-3 py-1 rounded text-sm ${
            completed 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          {completed ? '✓ Done' : 'Mark Done'}
        </button>
      </div>
    </div>
  );
}
