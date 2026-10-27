import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if running as installed standalone app
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isAppleDevice);

    // Listen for Chrome / Android beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  if (isStandalone || dismissed) {
    return null;
  }

  // Only show banner if we have deferred prompt (Android/Chrome/Edge) or on iOS Safari
  if (!deferredPrompt && !isIOS) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  return (
    <>
      {/* Floating Install Prompt Banner for Mobile */}
      <div className="fixed bottom-16 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-40 bg-white border border-gray-200/90 rounded-2xl shadow-xl p-3.5 flex items-center justify-between gap-3 animate-slide-up">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/images/logo.png"
            alt="The Cheesy Slice"
            className="w-11 h-11 rounded-xl object-contain bg-amber-50 border border-amber-200 p-1 flex-shrink-0"
          />
          <div className="min-w-0">
            <h4 className="text-sm font-extrabold text-gray-900 leading-tight truncate">
              The Cheesy Slice App
            </h4>
            <p className="text-[11px] text-gray-500 font-medium truncate">
              {isIOS ? 'Install on iPhone home screen' : 'Install for 1-tap counter billing'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer"
          >
            <Download size={14} />
            <span>Install</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg transition-colors cursor-pointer"
            aria-label="Dismiss install banner"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* iOS Safari Installation Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl animate-scale-up">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/images/logo.png"
                  alt="The Cheesy Slice Logo"
                  className="w-12 h-12 rounded-2xl object-contain bg-amber-50 border border-amber-200 p-1 shadow-xs"
                />
                <div>
                  <h3 className="text-base font-black text-gray-900">Install on iPhone</h3>
                  <p className="text-xs text-gray-500">Quick 3-step setup in Safari</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-full cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-gray-700">
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-sm flex-shrink-0">
                  1
                </div>
                <div className="flex-1">
                  Tap the <strong className="text-gray-900">Share</strong> button in the bottom Safari toolbar (
                  <Share size={13} className="inline mx-1 text-blue-600" />).
                </div>
              </div>

              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-sm flex-shrink-0">
                  2
                </div>
                <div className="flex-1">
                  Scroll down the menu and tap <strong className="text-gray-900">"Add to Home Screen"</strong> (
                  <PlusSquare size={13} className="inline mx-1 text-amber-600" />).
                </div>
              </div>

              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm flex-shrink-0">
                  3
                </div>
                <div className="flex-1">
                  Tap <strong className="text-gray-900">"Add"</strong> at the top right to open full-screen anytime!
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm py-3 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Got It!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
