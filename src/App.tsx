import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Music, 
  Settings2, 
  Zap, 
  Download, 
  Trash2, 
  Volume2, 
  Play, 
  Pause, 
  Repeat,
  RefreshCw,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  FileMusic,
  Wind,
  Plus,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Track, MorphSettings, DEFAULT_SETTINGS, RobloxSettings, DEFAULT_ROBLOX_SETTINGS } from './types';
import { generateNewTitle } from './services/openRouterService';
import { morphAudio } from './services/audioProcessor';
import { uploadAudioToRoblox } from './services/robloxAssetService';

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<MorphSettings>(DEFAULT_SETTINGS);
  const [robloxSettings, setRobloxSettings] = useState<RobloxSettings>(DEFAULT_ROBLOX_SETTINGS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      const newTracks: Track[] = newFiles.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        originalTitle: file.name.replace(/\.[^/.]+$/, ""),
        morphedTitle: 'Calculating...',
        status: 'pending',
        progress: 0,
        previewUrl: URL.createObjectURL(file),
        uploadStatus: 'idle',
        uploadProgress: 0,
        settings: { ...globalSettings }
      }));
      setTracks(prev => [...prev, ...newTracks]);
    }
  };

  const removeTrack = (id: string) => {
    setTracks(prev => {
      const track = prev.find(t => t.id === id);
      if (track?.previewUrl) URL.revokeObjectURL(track.previewUrl);
      if (track?.morphedUrl) URL.revokeObjectURL(track.morphedUrl);
      return prev.filter(t => t.id !== id);
    });
  };

  const processBatch = async () => {
    if (tracks.length === 0) return;
    setIsProcessing(true);

    const updatedTracks = [...tracks];

    for (let i = 0; i < updatedTracks.length; i++) {
      const track = updatedTracks[i];
      if (track.status === 'completed') continue;

      try {
        setTracks(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'processing', progress: 10 } : t));
        
        // 1. Generate AI Title
        const newTitle = await generateNewTitle(track.originalTitle);
        setTracks(prev => prev.map((t, idx) => idx === i ? { ...t, morphedTitle: newTitle, progress: 35 } : t));

        // 2. Morph Audio
        const morphedBlob = await morphAudio(track.file, track.settings);
        const morphedUrl = URL.createObjectURL(morphedBlob);

        setTracks(prev => prev.map((t, idx) => idx === i ? { 
          ...t, 
          morphedUrl,
          progress: robloxSettings.enabled ? 60 : 100,
          uploadStatus: robloxSettings.enabled ? 'uploading' : 'skipped',
          uploadProgress: robloxSettings.enabled ? 0 : 100,
        } : t));

        if (robloxSettings.enabled) {
          try {
            const robloxResult = await uploadAudioToRoblox(
              morphedBlob,
              newTitle,
              robloxSettings,
              (uploadProgress, uploadStatus) => {
                setTracks(prev => prev.map((t, idx) => idx === i ? {
                  ...t,
                  uploadStatus,
                  uploadProgress,
                  progress: Math.min(99, 60 + Math.round(uploadProgress * 0.39)),
                } : t));
              }
            );

            setTracks(prev => prev.map((t, idx) => idx === i ? {
              ...t,
              status: 'completed',
              progress: 100,
              uploadStatus: robloxResult.status,
              uploadProgress: 100,
              robloxAssetId: robloxResult.assetId,
              robloxModerationState: robloxResult.moderationState,
              uploadError: robloxResult.message,
            } : t));
          } catch (uploadError: any) {
            setTracks(prev => prev.map((t, idx) => idx === i ? {
              ...t,
              status: 'completed',
              progress: 100,
              uploadStatus: 'error',
              uploadProgress: 100,
              uploadError: uploadError.message || 'Roblox upload failed',
            } : t));
          }
        } else {
          setTracks(prev => prev.map((t, idx) => idx === i ? {
            ...t,
            status: 'completed',
            progress: 100,
          } : t));
        }

      } catch (err: any) {
        console.error(err);
        setTracks(prev => prev.map((t, idx) => idx === i ? { 
          ...t, 
          status: 'error', 
          error: err.message || 'Processing failed' 
        } : t));
      }
    }

    setIsProcessing(false);
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#10b981', '#f59e0b']
    });
  };

  const downloadTrack = (track: Track) => {
    if (!track.morphedUrl) return;
    const link = document.createElement('a');
    link.href = track.morphedUrl;
    link.download = `${track.morphedTitle}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = () => {
    tracks.filter(t => t.status === 'completed').forEach(downloadTrack);
  };

  return (
    <div className="min-h-screen bg-[#0a0502] text-white font-sans selection:bg-orange-500/30">
      {/* Dynamic Background Atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-950/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-950/20 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-lg">
                <Wind className="w-8 h-8 text-black" strokeWidth={2.5} />
              </div>
              <h1 className="text-4xl font-bold tracking-tighter uppercase italic">SonicMorph AI</h1>
            </div>
            <p className="text-zinc-400 font-mono text-sm uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-3 h-3 text-orange-500" /> Professional Multi-Track Signature Alteration
            </p>
          </div>

          <div className="flex items-center gap-3">
             <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors rounded-full text-sm font-bold uppercase tracking-wider"
            >
              <Plus className="w-4 h-4" /> Import Tracks
            </button>
            <button 
              onClick={processBatch}
              disabled={isProcessing || tracks.length === 0}
              className="flex items-center gap-2 px-8 py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all rounded-full text-sm font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)]"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {isProcessing ? 'Morphing...' : 'Start Morphing'}
            </button>
          </div>
        </header>

        {/* Global Settings Bar */}
        <section className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 mb-12 flex flex-wrap items-center gap-8 shadow-2xl">
           <div className="flex items-center gap-2 text-zinc-500">
             <Settings2 className="w-5 h-5" />
             <span className="text-xs font-bold uppercase tracking-widest">Global Master Settings</span>
           </div>
           
           <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
             <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500">
               <span>Pitch Shift</span>
               <span className="text-orange-400">{globalSettings.pitch.toFixed(1)} ST</span>
             </div>
             <input 
               type="range" min="-2" max="2" step="0.1" 
               value={globalSettings.pitch}
               onChange={(e) => setGlobalSettings(prev => ({ ...prev, pitch: parseFloat(e.target.value) }))}
               className="w-full accent-orange-500 h-1 rounded-full cursor-pointer"
             />
           </div>

           <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
             <div className="flex justify-between items-center text-[10px] uppercase font-bold text-zinc-500">
               <span>Tempo/Signature</span>
               <span className="text-blue-400">{globalSettings.tempo.toFixed(2)}x</span>
             </div>
             <input 
               type="range" min="0.8" max="1.2" step="0.01" 
               value={globalSettings.tempo}
               onChange={(e) => setGlobalSettings(prev => ({ ...prev, tempo: parseFloat(e.target.value) }))}
               className="w-full accent-blue-500 h-1 rounded-full cursor-pointer"
             />
           </div>

           <div className="flex items-center gap-4 border-l border-zinc-800 pl-8">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={globalSettings.bassBoost}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, bassBoost: e.target.checked }))}
                  className="hidden"
                />
                <div className={`w-10 h-5 rounded-full transition-colors flex items-center p-1 ${globalSettings.bassBoost ? 'bg-orange-500' : 'bg-zinc-700'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform ${globalSettings.bassBoost ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors">Bass Deepener</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group border-l border-zinc-800 pl-8 ml-4">
                <input 
                  type="checkbox" 
                  checked={globalSettings.scrubMetadata}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, scrubMetadata: e.target.checked }))}
                  className="hidden"
                />
                <div className={`w-10 h-5 rounded-full transition-colors flex items-center p-1 ${globalSettings.scrubMetadata ? 'bg-blue-500' : 'bg-zinc-700'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform ${globalSettings.scrubMetadata ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors">Metadata Purge</span>
              </label>
           </div>
        </section>

        {/* Roblox Upload Settings */}
        <section className="bg-zinc-950/60 border border-zinc-800 rounded-3xl p-6 mb-12 grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-6 shadow-2xl">
          <div className="flex items-start gap-3 text-zinc-400">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-widest">Roblox Auto Upload</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={robloxSettings.enabled}
                    onChange={(e) => setRobloxSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="hidden"
                  />
                  <div className={`w-10 h-5 rounded-full transition-colors flex items-center p-1 ${robloxSettings.enabled ? 'bg-blue-500' : 'bg-zinc-700'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full transition-transform ${robloxSettings.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </label>
              </div>
              <p className="mt-2 text-[11px] text-zinc-600 max-w-sm leading-relaxed">
                Upload runs after morphing, one track at a time. API keys entered here stay in this browser session.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-zinc-600">API Key</span>
              <input
                type="password"
                value={robloxSettings.apiKey}
                onChange={(e) => setRobloxSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                disabled={!robloxSettings.enabled}
                placeholder="Roblox Open Cloud key"
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-40"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-zinc-600">Creator Type</span>
              <select
                value={robloxSettings.creatorType}
                onChange={(e) => setRobloxSettings(prev => ({ ...prev, creatorType: e.target.value as RobloxSettings['creatorType'] }))}
                disabled={!robloxSettings.enabled}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-40"
              >
                <option value="userId">User</option>
                <option value="groupId">Group</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-zinc-600">Creator ID</span>
              <input
                type="text"
                inputMode="numeric"
                value={robloxSettings.creatorId}
                onChange={(e) => setRobloxSettings(prev => ({ ...prev, creatorId: e.target.value.replace(/\D/g, '') }))}
                disabled={!robloxSettings.enabled}
                placeholder={robloxSettings.creatorType === 'userId' ? 'User ID' : 'Group ID'}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-40"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-zinc-600">Description</span>
              <input
                type="text"
                value={robloxSettings.description}
                onChange={(e) => setRobloxSettings(prev => ({ ...prev, description: e.target.value }))}
                disabled={!robloxSettings.enabled}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-40"
              />
            </label>
          </div>
        </section>

        {/* Tracks List */}
        <div className="space-y-4 relative">
          <AnimatePresence mode="popLayout">
            {tracks.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-zinc-800 rounded-[40px] bg-zinc-900/20"
              >
                <div className="p-6 bg-zinc-900 rounded-full mb-6 border border-zinc-800">
                   <Upload className="w-12 h-12 text-zinc-600" />
                </div>
                <h3 className="text-xl font-bold uppercase italic mb-2 tracking-tighter">No Tracks Imported</h3>
                <p className="text-zinc-500 text-sm max-w-xs text-center font-medium leading-relaxed">
                  Bulk upload tracks to modify their structure and metadata for unique distribution.
                </p>
              </motion.div>
            ) : (
              tracks.map((track) => (
                <motion.div
                  key={track.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all shadow-xl"
                >
                  <div className="flex flex-col md:flex-row md:items-center p-4 gap-6">
                    {/* Track Icon & Preview */}
                    <div className="relative w-16 h-16 shrink-0 bg-zinc-950 rounded-xl flex items-center justify-center border border-zinc-800 group-hover:border-orange-500/50 transition-colors">
                      <Music className={`w-8 h-8 ${track.status === 'completed' ? 'text-orange-500' : 'text-zinc-700'}`} />
                      {track.status === 'processing' && (
                        <div className="absolute inset-0 border-2 border-orange-500 border-t-transparent rounded-xl animate-spin" />
                      )}
                    </div>

                    {/* Meta Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-lg truncate tracking-tight">{track.originalTitle}</h4>
                        <span className="text-[10px] text-zinc-600 font-mono uppercase bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-800 shrink-0">
                          .{(track.file.type.split('/')[1] || 'audio').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Zap className="w-3 h-3 text-orange-500 shrink-0" />
                        <p className={`text-xs uppercase font-bold tracking-wider truncate transition-colors ${track.status === 'completed' ? 'text-blue-400' : 'text-zinc-500 italic animate-pulse'}`}>
                          {track.status === 'completed' ? `Morphed as: ${track.morphedTitle}` : 'Waiting for AI restyling...'}
                        </p>
                        {track.status === 'completed' && track.settings.scrubMetadata && (
                          <span className="text-[9px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full tracking-tighter uppercase ml-2 animate-pulse">
                            Metadata Purged
                          </span>
                        )}
                      </div>
                      {track.uploadStatus && track.uploadStatus !== 'idle' && (
                        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase font-black tracking-wider">
                          <span className={`px-2 py-0.5 rounded-full border ${
                            track.uploadStatus === 'accepted'
                              ? 'bg-green-500/10 text-green-400 border-green-500/30'
                              : track.uploadStatus === 'rejected' || track.uploadStatus === 'error'
                                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          }`}>
                            Roblox: {track.uploadStatus}
                          </span>
                          {typeof track.uploadProgress === 'number' && ['uploading', 'processing', 'reviewing'].includes(track.uploadStatus) && (
                            <span className="text-zinc-500">{track.uploadProgress}%</span>
                          )}
                          {track.robloxAssetId && (
                            <a
                              href={`https://create.roblox.com/store/asset/${track.robloxAssetId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-300 hover:text-blue-200"
                            >
                              Asset ID: {track.robloxAssetId}
                            </a>
                          )}
                          {track.robloxModerationState && (
                            <span className="text-zinc-500">{track.robloxModerationState.replace('MODERATION_STATE_', '')}</span>
                          )}
                          {track.uploadError && (
                            <span className="text-red-300 normal-case tracking-normal truncate max-w-[360px]">{track.uploadError}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Progress / Actions */}
                    <div className="flex items-center gap-4">
                       <div className="hidden lg:flex flex-col items-end gap-1 min-w-[120px]">
                          <span className="text-[10px] uppercase font-black text-zinc-600 tracking-tighter">Processing Pk</span>
                          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                             <motion.div 
                              className="h-full bg-orange-500 shadow-[0_0_10px_#f97316]"
                              initial={{ width: 0 }}
                              animate={{ width: `${track.progress}%` }}
                             />
                          </div>
                       </div>

                       <div className="flex items-center gap-2 ml-4">
                          {track.status === 'completed' ? (
                            <button 
                              onClick={() => downloadTrack(track)}
                              className="p-3 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-black rounded-lg transition-all"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          ) : (
                            <button 
                              onClick={() => removeTrack(track.id)}
                              className="p-3 bg-red-500/5 hover:bg-red-500/20 text-zinc-600 hover:text-red-400 rounded-lg transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                          <button className="p-3 bg-zinc-950/50 text-zinc-500 hover:text-white rounded-lg transition-all">
                            <MoreVertical className="w-5 h-5" />
                          </button>
                       </div>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className={`absolute top-0 right-0 p-2 ${track.status === 'completed' ? 'text-green-500' : 'text-zinc-800'}`}>
                    {track.status === 'completed' && <CheckCircle2 className="w-4 h-4 fill-green-500/10" />}
                    {track.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        {tracks.some(t => t.status === 'completed') && !isProcessing && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-800 px-8 py-4 rounded-full shadow-2xl flex items-center gap-8"
          >
             <div className="flex items-center gap-3">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
               <span className="text-sm font-bold uppercase tracking-widest">
                 {tracks.filter(t => t.status === 'completed').length} Tracks Ready
               </span>
             </div>
             <button 
              onClick={downloadAll}
              className="px-6 py-2 bg-white text-black rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2"
             >
               <Download className="w-4 h-4" /> Download All Morphed
             </button>
          </motion.div>
        )}
      </div>

      <input 
        type="file" 
        multiple 
        accept="audio/*" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800;900&family=JetBrains+Mono&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
        }

        .font-mono {
          font-family: 'JetBrains Mono', monospace;
        }

        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid currentColor;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
}
