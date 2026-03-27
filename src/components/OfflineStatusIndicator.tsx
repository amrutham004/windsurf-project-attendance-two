import { useState, useEffect } from 'react';
import { Wifi, WifiOff, CloudOff, RefreshCw, Loader2 } from 'lucide-react';
import { offlineManager, OfflineStats } from '@/lib/offlineManager';
import { useTranslation } from '@/lib/i18n';

const OfflineStatusIndicator = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<OfflineStats>({
    pending: 0,
    failed: 0,
    total: 0,
    isOnline: navigator.onLine,
    syncInProgress: false,
  });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const unsubscribe = offlineManager.subscribe((newStats) => {
      setStats(newStats);
    });
    return unsubscribe;
  }, []);

  const handleManualSync = () => {
    offlineManager.syncPendingRecords();
  };

  const handleClearFailed = () => {
    offlineManager.clearFailedRecords();
  };

  // Don't show anything if online and no pending records
  if (stats.isOnline && stats.pending === 0 && stats.failed === 0) {
    return null;
  }

  return (
    <div className="relative">
      {/* Status Badge */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
          !stats.isOnline
            ? 'text-red-300 bg-red-500/20 hover:bg-red-500/30'
            : stats.pending > 0
            ? 'text-yellow-300 bg-yellow-500/20 hover:bg-yellow-500/30'
            : stats.failed > 0
            ? 'text-orange-300 bg-orange-500/20 hover:bg-orange-500/30'
            : 'text-teal-100/80 hover:bg-white/10'
        }`}
        title={stats.isOnline ? t('offline.online') : t('offline.offline')}
      >
        {!stats.isOnline ? (
          <WifiOff size={16} />
        ) : stats.syncInProgress ? (
          <Loader2 size={16} className="animate-spin" />
        ) : stats.pending > 0 || stats.failed > 0 ? (
          <CloudOff size={16} />
        ) : (
          <Wifi size={16} />
        )}

        {/* Pending count badge */}
        {(stats.pending > 0 || stats.failed > 0) && (
          <span className="text-xs font-bold">
            {stats.pending + stats.failed}
          </span>
        )}
      </button>

      {/* Details Dropdown */}
      {showDetails && (
        <div className="absolute right-0 top-full mt-1 bg-blue-900/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl overflow-hidden min-w-[260px] z-50 p-4 space-y-3">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {stats.isOnline ? (
              <>
                <Wifi size={16} className="text-green-400" />
                <span className="text-green-300 text-sm font-medium">{t('offline.online')}</span>
              </>
            ) : (
              <>
                <WifiOff size={16} className="text-red-400" />
                <span className="text-red-300 text-sm font-medium">{t('offline.offline')}</span>
              </>
            )}
          </div>

          {/* Pending Records */}
          {stats.pending > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <p className="text-yellow-200 text-sm font-medium">
                {stats.pending} {t('offline.pendingRecords')}
              </p>
              <p className="text-yellow-200/60 text-xs mt-1">
                {stats.isOnline ? t('offline.syncingNow') : t('offline.willSyncWhenOnline')}
              </p>
            </div>
          )}

          {/* Failed Records */}
          {stats.failed > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-200 text-sm font-medium">
                {stats.failed} {t('offline.failedRecords')}
              </p>
              <button
                onClick={handleClearFailed}
                className="text-red-300/70 hover:text-red-200 text-xs mt-1 underline"
              >
                {t('offline.clearFailed')}
              </button>
            </div>
          )}

          {/* Sync Button */}
          {stats.isOnline && stats.pending > 0 && !stats.syncInProgress && (
            <button
              onClick={handleManualSync}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 rounded-lg text-teal-200 text-sm transition-colors"
            >
              <RefreshCw size={14} />
              {t('offline.syncNow')}
            </button>
          )}

          {stats.syncInProgress && (
            <div className="flex items-center justify-center gap-2 text-teal-300 text-sm">
              <Loader2 size={14} className="animate-spin" />
              {t('offline.syncing')}
            </div>
          )}

          {/* All synced message */}
          {stats.pending === 0 && stats.failed === 0 && stats.isOnline && (
            <p className="text-teal-200/60 text-xs text-center">
              {t('offline.allSynced')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default OfflineStatusIndicator;
