import React, { useState, useEffect } from 'react';
import { GarminCloudAccount, Workout } from '../types/workout';
import {
  openGarminOAuthPopup,
  syncAuthenticGarminActivities,
} from '../services/garminConnectService';
import {
  Watch,
  Cloud,
  CheckCircle2,
  RefreshCw,
  FolderArchive,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Info,
  Link2,
  Unlink,
} from 'lucide-react';

interface GarminCloudSyncHubProps {
  cloudAccount: GarminCloudAccount;
  onUpdateAccount: (updated: GarminCloudAccount) => void;
  onImportNewRuns: (runs: Workout[], message?: string) => void;
  distanceUnit: 'km' | 'mi';
  existingWorkouts: Workout[];
  onSwitchToZipTab?: () => void;
}

export const GarminCloudSyncHub: React.FC<GarminCloudSyncHubProps> = ({
  cloudAccount,
  onUpdateAccount,
  onImportNewRuns,
  distanceUnit,
  existingWorkouts,
  onSwitchToZipTab,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  
  // Connection form inputs
  const [emailInput, setEmailInput] = useState(cloudAccount.email || '');
  const [deviceNameInput, setDeviceNameInput] = useState(cloudAccount.deviceName || 'Garmin Watch');
  const [connectMethod, setConnectMethod] = useState<'oauth' | 'credentials'>('oauth');
  const [clientIdInput, setClientIdInput] = useState('');

  // Listen for OAuth postMessage callback from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }

      if (event.data?.type === 'GARMIN_AUTH_SUCCESS') {
        const email = event.data.email || emailInput || 'Garmin Connected User';
        const deviceName = event.data.deviceName || deviceNameInput || 'Garmin Watch';

        onUpdateAccount({
          isConnected: true,
          email,
          deviceName,
          lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          autoSync: true,
          pendingActivitiesCount: 0,
        });

        setShowConnectModal(false);
        setSyncStatusMsg({
          type: 'success',
          text: `Garmin Connect authorized successfully for ${email}. You can now sync activities!`,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [emailInput, deviceNameInput, onUpdateAccount]);

  // Initiate real OAuth authorization popup
  const handleLaunchGarminOAuth = () => {
    const redirectUri = `${window.location.origin}/auth/garmin/callback`;
    const popup = openGarminOAuthPopup(redirectUri, clientIdInput || undefined);

    if (!popup) {
      setSyncStatusMsg({
        type: 'error',
        text: 'Popup was blocked by your browser. Please allow popups for this site to authorize Garmin Connect.',
      });
      return;
    }

    setSyncStatusMsg({
      type: 'info',
      text: 'Garmin Connect authorization popup opened. Sign in to your Garmin account to complete linking.',
    });
  };

  // Manual Account linking submission
  const handleSaveConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setSyncStatusMsg({ type: 'error', text: 'Please enter your Garmin Connect email or user ID.' });
      return;
    }

    onUpdateAccount({
      isConnected: true,
      email: emailInput.trim(),
      deviceName: deviceNameInput.trim() || 'Garmin Watch',
      lastSyncTime: 'Never',
      autoSync: true,
      pendingActivitiesCount: 0,
    });

    setShowConnectModal(false);
    setSyncStatusMsg({
      type: 'success',
      text: `Garmin Connect linked to ${emailInput.trim()} (${deviceNameInput.trim() || 'Garmin Watch'}).`,
    });
  };

  // Trigger real sync from Garmin Connect
  const handleSyncLatest = async () => {
    if (!cloudAccount.isConnected) {
      setShowConnectModal(true);
      return;
    }

    setIsSyncing(true);
    setSyncStatusMsg(null);

    try {
      const result = await syncAuthenticGarminActivities(cloudAccount, existingWorkouts, 30);

      if (result.newActivities.length > 0) {
        onImportNewRuns(result.newActivities);
        setSyncStatusMsg({
          type: 'success',
          text: `Synced ${result.newActivities.length} authentic run(s) from Garmin Connect!`,
        });
      } else {
        setSyncStatusMsg({
          type: 'info',
          text: result.message || 'Garmin Connect checked: No new activities found since last sync.',
        });
      }

      onUpdateAccount({
        ...cloudAccount,
        lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pendingActivitiesCount: 0,
      });
    } catch (err: any) {
      setSyncStatusMsg({
        type: 'error',
        text: err.message || 'Error communicating with Garmin Connect.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Disconnect Garmin account
  const handleDisconnect = () => {
    onUpdateAccount({
      isConnected: false,
      email: '',
      deviceName: '',
      lastSyncTime: '',
      autoSync: false,
      pendingActivitiesCount: 0,
    });
    setSyncStatusMsg({
      type: 'info',
      text: 'Garmin Connect account disconnected.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Connection Status Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-xs ${
                cloudAccount.isConnected
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <Cloud className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Garmin Connect Cloud Integration
                </h3>
                {cloudAccount.isConnected ? (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Linked</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-400">
                    Not Linked
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Direct activity synchronization with your official Garmin Connect profile
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cloudAccount.isConnected ? (
              <>
                <button
                  type="button"
                  onClick={handleSyncLatest}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-orange-500 disabled:opacity-60 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Checking Garmin...' : 'Sync Latest Runs'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  <span>Disconnect</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowConnectModal(true)}
                className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-500 transition-colors"
              >
                <Link2 className="h-4 w-4" />
                <span>Link Garmin Account</span>
              </button>
            )}
          </div>
        </div>

        {/* Sync Status Banner */}
        {syncStatusMsg && (
          <div
            className={`mt-4 flex items-start gap-2.5 rounded-lg p-3 text-xs border ${
              syncStatusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : syncStatusMsg.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
            }`}
          >
            {syncStatusMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : syncStatusMsg.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            )}
            <span className="leading-relaxed">{syncStatusMsg.text}</span>
          </div>
        )}

        {/* Connected Device Details */}
        {cloudAccount.isConnected ? (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Garmin Watch Device</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                <Watch className="h-3.5 w-3.5 text-orange-500" />
                {cloudAccount.deviceName || 'Garmin Device'}
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Linked Garmin ID</span>
              <span className="font-bold text-slate-900 dark:text-white truncate block mt-0.5">
                {cloudAccount.email}
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Last Cloud Sync</span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                {cloudAccount.lastSyncTime || 'Pending First Sync'}
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-2">
            <p className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Info className="h-4 w-4 text-orange-500" />
              <span>How authentic Garmin syncing works:</span>
            </p>
            <p>
              Link your Garmin Connect account to pull genuine activity data directly from your watch into StridePulse. All workouts are saved securely to your private Firestore database.
            </p>
          </div>
        )}
      </div>

      {/* Historical Data & Batch ZIP Ingestion Guidance */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
              <FolderArchive className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Historical Activity Import &amp; Multi-Year Archives
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Import your entire multi-year running history without API rate limits or mock data
              </p>
            </div>
          </div>

          {onSwitchToZipTab && (
            <button
              type="button"
              onClick={onSwitchToZipTab}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-orange-600 dark:hover:bg-orange-500 transition-colors shrink-0 shadow-xs"
            >
              <span>Batch Files &amp; ZIP Tab</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200/80 dark:bg-slate-800/50 dark:border-slate-700/60 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Cloud className="h-4 w-4 text-orange-500" />
              <span>Live Cloud Feed</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Use the <strong>"Sync Latest Runs"</strong> button above whenever you finish a new workout on your watch. It queries Garmin Connect for newly uploaded activities and pushes them directly to your Firestore database.
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200/80 dark:bg-slate-800/50 dark:border-slate-700/60 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <FolderArchive className="h-4 w-4 text-amber-500" />
              <span>Complete Historical ZIP Archive</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              To import years of historical Garmin activities at once, export your archive from Garmin Connect (<code className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">.ZIP</code>) and drop it into the <strong>Batch Files &amp; ZIP Archive</strong> tab. StridePulse extracts and parses all FIT activities automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Link Account Modal / Configuration Form */}
      {showConnectModal && (
        <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-5 dark:border-orange-950 dark:bg-orange-950/20 space-y-4">
          <div className="flex items-center justify-between border-b border-orange-200/60 pb-3 dark:border-orange-900/60">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Link Real Garmin Connect Account
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowConnectModal(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Cancel
            </button>
          </div>

          {/* Linking Method Tabs */}
          <div className="flex gap-2 border-b border-orange-200/40 pb-2">
            <button
              type="button"
              onClick={() => setConnectMethod('oauth')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                connectMethod === 'oauth'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-orange-100/50 dark:hover:bg-slate-800'
              }`}
            >
              Garmin Connect OAuth
            </button>
            <button
              type="button"
              onClick={() => setConnectMethod('credentials')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                connectMethod === 'credentials'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-orange-100/50 dark:hover:bg-slate-800'
              }`}
            >
              Garmin Account ID
            </button>
          </div>

          {connectMethod === 'oauth' ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Connect directly through Garmin's OAuth portal. When you click below, an authorization window will open directly to Garmin Connect to authorize activity access.
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Garmin OAuth Client ID (Optional if set in environment)
                </label>
                <input
                  type="text"
                  value={clientIdInput}
                  onChange={e => setClientIdInput(e.target.value)}
                  placeholder="Leave blank to use default application Client ID"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Callback URL: <code className="font-mono text-[10px]">{window.location.origin}/auth/garmin/callback</code>
                </span>
                <button
                  type="button"
                  onClick={handleLaunchGarminOAuth}
                  className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-500 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Garmin Authorization</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveConnection} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Garmin Connect Email / Username
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder="your-email@example.com"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Garmin Watch Model
                  </label>
                  <select
                    value={deviceNameInput}
                    onChange={e => setDeviceNameInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Garmin Forerunner 965">Garmin Forerunner 965</option>
                    <option value="Garmin Forerunner 265 / 255">Garmin Forerunner 265 / 255</option>
                    <option value="Garmin Forerunner 165 / 55">Garmin Forerunner 165 / 55</option>
                    <option value="Garmin Fenix 7 / 8">Garmin Fenix 7 / 8</option>
                    <option value="Garmin Epix Gen 2">Garmin Epix Gen 2</option>
                    <option value="Garmin Enduro 2 / 3">Garmin Enduro 2 / 3</option>
                    <option value="Garmin Venu 3 / Sq">Garmin Venu 3 / Sq</option>
                    <option value="Garmin Instinct 2 / Solar">Garmin Instinct 2 / Solar</option>
                    <option value="Other Garmin Device">Other Garmin Device</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-500">
                  Links this profile to authenticate with Garmin Connect
                </span>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-500 shadow-xs transition-colors"
                >
                  Link Account
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
