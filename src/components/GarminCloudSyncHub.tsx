import React, { useState } from 'react';
import { GarminCloudAccount, Workout } from '../types/workout';
import { useAuth } from '../context/AuthContext';
import {
  validateGarminPersonalApiKey,
  pullGarminActivitiesWithPersonalKey,
} from '../services/garminConnectService';
import {
  Watch,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  FolderArchive,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Info,
  Eye,
  EyeOff,
  Trash2,
  Calendar,
  Clock,
  Sparkles,
  Cloud,
} from 'lucide-react';

interface GarminCloudSyncHubProps {
  cloudAccount: GarminCloudAccount;
  onUpdateAccount: (updated: GarminCloudAccount) => void;
  onImportNewRuns: (runs: Workout[], message?: string) => void;
  distanceUnit: 'km' | 'mi';
  existingWorkouts: Workout[];
  onSwitchToZipTab?: () => void;
}

const getPresetStartDate = (preset: '30d' | '90d' | '1y' | '3y' | 'all'): string => {
  const d = new Date();
  if (preset === '30d') d.setDate(d.getDate() - 30);
  else if (preset === '90d') d.setDate(d.getDate() - 90);
  else if (preset === '1y') d.setFullYear(d.getFullYear() - 1);
  else if (preset === '3y') d.setFullYear(d.getFullYear() - 3);
  else if (preset === 'all') return '2015-01-01';
  return d.toISOString().slice(0, 10);
};

export const GarminCloudSyncHub: React.FC<GarminCloudSyncHubProps> = ({
  cloudAccount,
  onUpdateAccount,
  onImportNewRuns,
  distanceUnit,
  existingWorkouts,
  onSwitchToZipTab,
}) => {
  const { user } = useAuth();
  const [apiKeyInput, setApiKeyInput] = useState(cloudAccount.personalApiKey || '');
  const [showKeyText, setShowKeyText] = useState(false);
  const [deviceNameInput, setDeviceNameInput] = useState(cloudAccount.deviceName || 'Garmin Forerunner');
  const [emailInput, setEmailInput] = useState(cloudAccount.email || '');

  // Date window state
  const todayStr = new Date().toISOString().slice(0, 10);
  const [activePreset, setActivePreset] = useState<'30d' | '90d' | '1y' | '3y' | 'all' | 'custom'>('1y');
  const [syncStartDate, setSyncStartDate] = useState(() => getPresetStartDate('1y'));
  const [syncEndDate, setSyncEndDate] = useState(todayStr);
  const [syncProgressMsg, setSyncProgressMsg] = useState<string | null>(null);

  // UI state
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEditingKey, setIsEditingKey] = useState(!cloudAccount.personalApiKey);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Validate and save Personal API Key
  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKeyInput.trim();

    if (!cleanKey) {
      setStatusMsg({ type: 'error', text: 'Please enter your Garmin Connect Personal API Key.' });
      return;
    }

    setIsValidatingKey(true);
    setStatusMsg(null);

    try {
      const validation = await validateGarminPersonalApiKey(cleanKey);

      if (!validation.isValid || !validation.accessToken) {
        setStatusMsg({
          type: 'error',
          text: validation.error || 'Failed to authenticate with this Personal API Key. Please verify the key in Garmin Connect.',
        });
        setIsValidatingKey(false);
        return;
      }

      // Key is valid! Save to account state
      const updated: GarminCloudAccount = {
        ...cloudAccount,
        isConnected: true,
        personalApiKey: cleanKey,
        accessToken: validation.accessToken,
        tokenExpiresAt: Date.now() + (validation.expiresIn || 3600) * 1000,
        email: emailInput.trim() || cloudAccount.email || 'Garmin Connect User',
        deviceName: deviceNameInput.trim() || cloudAccount.deviceName || 'Garmin Watch',
        lastSyncTime: cloudAccount.lastSyncTime || 'Pending First Sync',
        autoSync: true,
        pendingActivitiesCount: 0,
      };

      onUpdateAccount(updated);
      setIsEditingKey(false);
      setStatusMsg({
        type: 'success',
        text: 'Personal API Key verified and saved! You can now pull authentic activity data directly from Garmin.',
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Error validating key with Garmin Personal API.',
      });
    } finally {
      setIsValidatingKey(false);
    }
  };

  const handleSelectPreset = (preset: '30d' | '90d' | '1y' | '3y' | 'all') => {
    setActivePreset(preset);
    setSyncStartDate(getPresetStartDate(preset));
    setSyncEndDate(todayStr);
  };

  // Pull authentic activities from Garmin using Personal API Key with historical date range
  const handlePullActivities = async () => {
    if (!cloudAccount.personalApiKey) {
      setIsEditingKey(true);
      setStatusMsg({ type: 'error', text: 'Please save your Garmin Personal API Key first.' });
      return;
    }

    if (!syncStartDate) {
      setStatusMsg({ type: 'error', text: 'Please select a start date from which activities should be pulled.' });
      return;
    }

    setIsSyncing(true);
    setStatusMsg(null);
    setSyncProgressMsg(`Connecting to Garmin Connect Personal API...`);

    try {
      const result = await pullGarminActivitiesWithPersonalKey(cloudAccount, existingWorkouts, {
        startDate: syncStartDate,
        endDate: syncEndDate || undefined,
        onProgress: (total, page, msg) => {
          setSyncProgressMsg(msg);
        },
      });

      if (result.newActivities.length > 0) {
        onImportNewRuns(result.newActivities);
        const destinationNotice = user
          ? ` and persisted to Cloud Firestore for ${user.email}`
          : ' (held in browser memory; sign in to save to Cloud Firestore)';
        setStatusMsg({
          type: 'success',
          text: `Successfully imported ${result.newActivities.length} authentic run(s) since ${syncStartDate}${destinationNotice} (${result.duplicatesCount} duplicate(s) skipped)!`,
        });
      } else {
        setStatusMsg({
          type: 'info',
          text: result.message || `Garmin Connect checked: No new activities found on or after ${syncStartDate}.`,
        });
      }

      // Update sync timestamp
      onUpdateAccount({
        ...cloudAccount,
        lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pendingActivitiesCount: 0,
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Error fetching activities from Garmin Personal API.',
      });
    } finally {
      setIsSyncing(false);
      setSyncProgressMsg(null);
    }
  };

  // Disconnect / Remove Key
  const handleRemoveKey = () => {
    onUpdateAccount({
      isConnected: false,
      email: '',
      deviceName: '',
      lastSyncTime: '',
      autoSync: false,
      pendingActivitiesCount: 0,
      personalApiKey: undefined,
      accessToken: undefined,
      tokenExpiresAt: undefined,
    });
    setApiKeyInput('');
    setIsEditingKey(true);
    setStatusMsg({
      type: 'info',
      text: 'Garmin Personal API Key removed.',
    });
  };

  const maskedKey = cloudAccount.personalApiKey
    ? `${cloudAccount.personalApiKey.slice(0, 6)}••••••••${cloudAccount.personalApiKey.slice(-4)}`
    : '';

  return (
    <div className="space-y-6">
      {/* Overview & Key Status Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-xs ${
                cloudAccount.isConnected && cloudAccount.personalApiKey
                  ? 'bg-emerald-500 text-white'
                  : 'bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400'
              }`}
            >
              <KeyRound className="h-5 w-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Garmin Connect Personal API
                </h3>
                {cloudAccount.isConnected && cloudAccount.personalApiKey ? (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>API Key Active</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-400">
                    Key Required
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Direct pull flow using your self-generated Garmin Personal API Key
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cloudAccount.isConnected && cloudAccount.personalApiKey ? (
              <>
                <button
                  type="button"
                  onClick={handlePullActivities}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-orange-500 disabled:opacity-60 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Pulling Activities...' : 'Pull Activities'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingKey(!isEditingKey)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                >
                  {isEditingKey ? 'Close Key Settings' : 'Edit Key'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingKey(true)}
                className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-500 transition-colors"
              >
                <KeyRound className="h-4 w-4" />
                <span>Configure Personal API Key</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Notification Message */}
        {statusMsg && (
          <div
            className={`mt-4 flex items-start gap-2.5 rounded-lg p-3 text-xs border ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : statusMsg.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : statusMsg.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            )}
            <span className="leading-relaxed">{statusMsg.text}</span>
          </div>
        )}

        {/* Connected Details Grid */}
        {cloudAccount.isConnected && cloudAccount.personalApiKey && !isEditingKey && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Personal API Key</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                <KeyRound className="h-3.5 w-3.5 text-orange-500" />
                {maskedKey}
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Garmin Device</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                <Watch className="h-3.5 w-3.5 text-orange-500" />
                {cloudAccount.deviceName || 'Garmin Watch'}
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Last Activities Pull</span>
              <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                {cloudAccount.lastSyncTime || 'Pending First Sync'}
              </span>
            </div>
          </div>
        )}

        {/* Cloud Firestore Persistence Status Banner */}
        <div
          className={`mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg p-3 text-xs border ${
            user
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-amber-50/70 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  <strong>Cloud Firestore Active:</strong> Syncing activities to your private profile (<strong>{user.email}</strong>).
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>Guest Mode:</strong> You are not signed in. Activities will be kept in browser session memory only.
                </span>
              </>
            )}
          </div>
          {!user && (
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              Sign in via top navigation bar to persist data to Firestore.
            </span>
          )}
        </div>
      </div>

      {/* Historical Activity Sync & Date Selection Window */}
      {cloudAccount.isConnected && cloudAccount.personalApiKey && !isEditingKey && (
        <div className="rounded-xl border border-orange-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Historical Activity Sync Window</span>
                  <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
                    No 50-Run Limit
                  </span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select the start date to review historical data. StridePulse will automatically page through Garmin Connect and pull all runs on or after this date.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePullActivities}
              disabled={isSyncing || !syncStartDate}
              className="flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-500 disabled:opacity-60 transition-colors shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Pulling History...' : 'Pull Historical Runs'}</span>
            </button>
          </div>

          {/* Quick Date Presets */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
              Quick Historical Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: '30d', label: 'Past 30 Days' },
                { id: '90d', label: 'Past 90 Days' },
                { id: '1y', label: 'Past 1 Year (Recommended)' },
                { id: '3y', label: 'Past 3 Years' },
                { id: 'all', label: 'All-Time (Since 2015)' },
              ].map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id as any)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                    activePreset === preset.id
                      ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 font-semibold shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Picker Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-orange-500" />
                <span>Pull Activities From (Start Date)</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={syncStartDate}
                max={syncEndDate || todayStr}
                onChange={e => {
                  setSyncStartDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                All authentic running sessions on or after this date will be retrieved.
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>To Date (End Date)</span>
              </label>
              <input
                type="date"
                value={syncEndDate}
                min={syncStartDate}
                max={todayStr}
                onChange={e => {
                  setSyncEndDate(e.target.value);
                  setActivePreset('custom');
                }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Defaults to today. Change to review a specific historical window or race block.
              </span>
            </div>
          </div>

          {/* Sync Progress Live Indicator */}
          {isSyncing && syncProgressMsg && (
            <div className="flex items-center gap-3 rounded-lg bg-orange-50 border border-orange-200 p-3 text-xs text-orange-900 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-200 animate-pulse">
              <RefreshCw className="h-4 w-4 animate-spin text-orange-600 dark:text-orange-400 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-semibold">{syncProgressMsg}</p>
                <p className="text-[11px] text-orange-700 dark:text-orange-300">
                  Paging through Garmin Connect history... Duplicate runs will be automatically detected and skipped.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* API Key Setup / Edit Form */}
      {isEditingKey && (
        <form
          onSubmit={handleSaveApiKey}
          className="rounded-xl border border-orange-200 bg-orange-50/40 p-5 dark:border-orange-950 dark:bg-orange-950/20 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-orange-200/60 pb-3 dark:border-orange-900/60">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Enter Your Garmin Personal API Key
              </h4>
            </div>
            {cloudAccount.personalApiKey && (
              <button
                type="button"
                onClick={() => setIsEditingKey(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Step-by-Step Instructions */}
          <div className="rounded-lg bg-white p-3.5 border border-orange-100 dark:bg-slate-900 dark:border-slate-800 space-y-2 text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>How to generate your key in Garmin Connect:</span>
              <a
                href="https://connect.garmin.com/modern/settings/personal-api-key"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:underline dark:text-orange-400"
              >
                <span>Open Garmin Connect API Settings</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              <li>Log in to Garmin Connect Web and navigate to <strong>Profile &amp; Account &rarr; Account Settings &rarr; Personal API Key</strong>.</li>
              <li>Click <strong>Create Key</strong>, accept the terms, and choose an expiration period.</li>
              <li>Copy your generated Personal API Key and paste it into the field below.</li>
            </ol>
          </div>

          {/* Input field */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Personal API Key
            </label>
            <div className="relative">
              <input
                type={showKeyText ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="Paste your Garmin Personal API Key here..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowKeyText(!showKeyText)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title={showKeyText ? 'Hide Key' : 'Show Key'}
              >
                {showKeyText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Garmin Watch Model (Optional)
              </label>
              <input
                type="text"
                value={deviceNameInput}
                onChange={e => setDeviceNameInput(e.target.value)}
                placeholder="e.g. Forerunner 965, Fenix 8"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Garmin Account Email (Optional)
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="your-email@example.com"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Form action buttons */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {cloudAccount.personalApiKey && (
                <button
                  type="button"
                  onClick={handleRemoveKey}
                  className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-medium"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove Key</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isValidatingKey}
              className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-500 disabled:opacity-60 transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{isValidatingKey ? 'Validating Key...' : 'Verify & Save Key'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Historical Data & Batch ZIP Ingestion Guidance */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
              <FolderArchive className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Multi-Year History &amp; ZIP Archive Ingestion
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pull recent activities via Personal API, or drag and drop your full Garmin archive
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
              <KeyRound className="h-4 w-4 text-orange-500" />
              <span>Personal API Pull Flow</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Your Personal API Key allows StridePulse to pull your latest completed workouts on demand. When you finish a run on your watch and sync with your phone, click <strong>"Pull Activities"</strong> to ingest them into your private Firestore database.
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200/80 dark:bg-slate-800/50 dark:border-slate-700/60 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <FolderArchive className="h-4 w-4 text-amber-500" />
              <span>Complete Historical ZIP Archive</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              If you have years of past runs, the fastest route is exporting your Garmin Connect data archive (<code className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">.ZIP</code>) and dropping it into the <strong>Batch Files &amp; ZIP Archive</strong> tab. All historical FIT activities are parsed with authentic GPS coordinates, laps, and cadence.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
