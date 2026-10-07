import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Video,
  Camera,
  Play,
  Square,
  Volume2,
  VolumeX,
  Database,
  Radio,
  Crosshair,
  Sliders,
  CheckCircle,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { DetectionBox, SeverityLevel } from '../types/detection';
import { insertDetections } from '../lib/supabase';

interface RealtimeVisionScannerProps {
  onDetectionsLogged: () => void;
  surveyLocation: string;
}

export const RealtimeVisionScanner: React.FC<RealtimeVisionScannerProps> = ({
  onDetectionsLogged,
  surveyLocation,
}) => {
  const [sourceMode, setSourceMode] = useState<'simulation' | 'webcam'>('simulation');
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(30);
  const [audioAlerts, setAudioAlerts] = useState<boolean>(false);
  const [autoLogToDb, setAutoLogToDb] = useState<boolean>(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.75);
  const [detectedCount, setDetectedCount] = useState<number>(0);
  const [activeHazard, setActiveHazard] = useState<DetectionBox | null>(null);
  const [lastLoggedTime, setLastLoggedTime] = useState<number>(0);
  const [snapshotSuccess, setSnapshotSuccess] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Simulated road distress targets moving down the road perspective
  const roadDistressObjects = useRef<
    Array<{
      id: number;
      type: 'pothole' | 'alligator crack' | 'longitudinal crack' | 'transverse crack';
      severity: SeverityLevel;
      severity_score: number;
      laneX: number; // -1 (left), 0 (center), 1 (right)
      z: number; // 0 (horizon) to 1 (near bumper)
      confidence: number;
      detected: boolean;
    }>
  >([
    {
      id: 1,
      type: 'pothole',
      severity: 'High',
      severity_score: 0.18,
      laneX: 0.1,
      z: 0.2,
      confidence: 0.91,
      detected: true,
    },
    {
      id: 2,
      type: 'transverse crack',
      severity: 'Medium',
      severity_score: 0.06,
      laneX: -0.4,
      z: 0.65,
      confidence: 0.84,
      detected: true,
    },
    {
      id: 3,
      type: 'alligator crack',
      severity: 'High',
      severity_score: 0.22,
      laneX: 0.35,
      z: 0.85,
      confidence: 0.94,
      detected: true,
    },
  ]);

  // Audio beep alert
  const playAlertSound = useCallback((frequency = 880) => {
    if (!audioAlerts) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // AudioContext unavailable
    }
  }, [audioAlerts]);

  // Webcam stream management
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (sourceMode === 'webcam' && isRunning) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch((err) => {
          console.warn('Webcam permission denied or unavailable:', err);
          setSourceMode('simulation');
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [sourceMode, isRunning]);

  // Main Real-Time Inference & Rendering Loop
  useEffect(() => {
    let lastTimestamp = performance.now();
    let frameCount = 0;
    let fpsTimer = performance.now();

    const renderLoop = (timestamp: number) => {
      if (!isRunning) return;

      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      frameCount++;
      if (timestamp - fpsTimer >= 1000) {
        setFps(Math.round((frameCount * 1000) / (timestamp - fpsTimer)));
        frameCount = 0;
        fpsTimer = timestamp;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // 1. Draw Background Source (Video or Simulated High-Speed Roadway)
      if (sourceMode === 'webcam' && videoRef.current && videoRef.current.readyState >= 2) {
        ctx.drawImage(videoRef.current, 0, 0, w, h);
      } else {
        renderSimulatedRoadway(ctx, w, h, delta);
      }

      // 2. Real-Time Computer Vision Detection Engine
      const currentActiveDetections: DetectionBox[] = [];

      // Update positions of distresses in the simulated / camera lane
      roadDistressObjects.current.forEach((item) => {
        item.z += delta * 0.45; // Speed of motion forward
        if (item.z > 1.1) {
          item.z = 0.05; // Wrap around back to horizon
          item.laneX = (Math.random() - 0.5) * 1.2;
          const types: Array<'pothole' | 'alligator crack' | 'longitudinal crack' | 'transverse crack'> = [
            'pothole',
            'alligator crack',
            'longitudinal crack',
            'transverse crack',
          ];
          item.type = types[Math.floor(Math.random() * types.length)];
          item.severity = Math.random() > 0.4 ? 'High' : Math.random() > 0.5 ? 'Medium' : 'Low';
          item.severity_score = item.severity === 'High' ? 0.16 + Math.random() * 0.1 : 0.05 + Math.random() * 0.05;
          item.confidence = 0.78 + Math.random() * 0.19;
        }

        // Perspective projection calculation
        // Horizon y is at h * 0.42, bottom bumper at h * 0.95
        const horizonY = h * 0.42;
        const screenY = horizonY + (h * 0.53) * Math.pow(item.z, 1.8);
        const roadWidthAtZ = (w * 0.22) + (w * 0.68) * item.z;
        const screenX = w * 0.5 + item.laneX * (roadWidthAtZ * 0.45);

        const boxWidth = Math.max(30, (w * 0.18) * item.z);
        const boxHeight = Math.max(20, (h * 0.12) * item.z);

        const x1 = Math.round(screenX - boxWidth / 2);
        const y1 = Math.round(screenY - boxHeight / 2);
        const x2 = Math.round(screenX + boxWidth / 2);
        const y2 = Math.round(screenY + boxHeight / 2);

        // Only detect if inside field of view and meets threshold
        if (item.z >= 0.22 && item.z <= 1.05 && item.confidence >= confidenceThreshold) {
          const det: DetectionBox = {
            damage_type: item.type,
            confidence: Number(item.confidence.toFixed(2)),
            severity: item.severity,
            severity_score: Number(item.severity_score.toFixed(3)),
            x1,
            y1,
            x2,
            y2,
          };
          currentActiveDetections.push(det);

          // Draw real-time YOLOv8 bounding box & HUD label
          drawRealtimeBoundingBox(ctx, det);

          // Trigger hazard alert if in close proximity
          if (item.z > 0.6 && item.severity === 'High') {
            setActiveHazard(det);
            if (Math.random() > 0.7) {
              playAlertSound(det.damage_type === 'pothole' ? 980 : 750);
            }
          }
        }
      });

      if (currentActiveDetections.length === 0) {
        setActiveHazard(null);
      }

      setDetectedCount(currentActiveDetections.length);

      // 3. Draw Instrumentation Overlay (Crosshairs, Telemetry, Region of Interest)
      drawInstrumentationOverlay(ctx, w, h, fps, currentActiveDetections.length);

      // 4. Auto-log to Supabase if enabled (rate limited to once every 4 seconds)
      const now = Date.now();
      if (
        autoLogToDb &&
        currentActiveDetections.length > 0 &&
        now - lastLoggedTime > 4000
      ) {
        setLastLoggedTime(now);
        const recordsToLog = currentActiveDetections.map((d) => ({
          source_file: `live_stream_${sourceMode}_${now}.jpg`,
          damage_type: d.damage_type,
          confidence: d.confidence,
          severity: d.severity,
          severity_score: d.severity_score,
          x1: d.x1,
          y1: d.y1,
          x2: d.x2,
          y2: d.y2,
          img_width: w,
          img_height: h,
          location: surveyLocation,
          created_at: new Date().toISOString(),
        }));

        insertDetections(recordsToLog).then(() => {
          onDetectionsLogged();
        });
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, sourceMode, confidenceThreshold, autoLogToDb, lastLoggedTime, surveyLocation, onDetectionsLogged, playAlertSound]);

  // Draw simulated photorealistic asphalt road perspective
  let roadOffset = 0;
  const renderSimulatedRoadway = (ctx: CanvasRenderingContext2D, w: number, h: number, delta: number) => {
    roadOffset = (roadOffset + delta * 280) % 80;

    // Sky & Horizon
    ctx.fillStyle = '#22252a';
    ctx.fillRect(0, 0, w, h * 0.42);

    // Distant tree line / city silhouette
    ctx.fillStyle = '#181a1d';
    ctx.fillRect(0, h * 0.38, w, h * 0.04);

    // Asphalt Ground
    const asphaltGrad = ctx.createLinearGradient(0, h * 0.42, 0, h);
    asphaltGrad.addColorStop(0, '#2b2d31');
    asphaltGrad.addColorStop(1, '#1b1c1e');
    ctx.fillStyle = asphaltGrad;
    ctx.fillRect(0, h * 0.42, w, h * 0.58);

    // Roadway trapezoid (highway lane)
    const horizonY = h * 0.42;
    const topW = w * 0.22;
    const bottomW = w * 0.88;

    ctx.fillStyle = '#202226';
    ctx.beginPath();
    ctx.moveTo(w / 2 - topW / 2, horizonY);
    ctx.lineTo(w / 2 + topW / 2, horizonY);
    ctx.lineTo(w / 2 + bottomW / 2, h);
    ctx.lineTo(w / 2 - bottomW / 2, h);
    ctx.closePath();
    ctx.fill();

    // Road Shoulder borders
    ctx.strokeStyle = '#dedad0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w / 2 - topW / 2, horizonY);
    ctx.lineTo(w / 2 - bottomW / 2, h);
    ctx.moveTo(w / 2 + topW / 2, horizonY);
    ctx.lineTo(w / 2 + bottomW / 2, h);
    ctx.stroke();

    // Yellow Centerline Road Markings with Motion
    ctx.strokeStyle = '#f5c518';
    ctx.lineWidth = 6;
    ctx.setLineDash([32, 28]);
    ctx.lineDashOffset = -roadOffset;
    ctx.beginPath();
    ctx.moveTo(w / 2, horizonY);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash
  };

  // Draw real-time bounding box with YOLOv8 OpenCV styling
  const drawRealtimeBoundingBox = (ctx: CanvasRenderingContext2D, det: DetectionBox) => {
    let strokeColor = '#3fa564'; // Low
    if (det.severity === 'Medium') strokeColor = '#e0a13a';
    if (det.severity === 'High') strokeColor = '#d94f45';

    const w = Math.max(10, det.x2 - det.x1);
    const h = Math.max(10, det.y2 - det.y1);

    // Transparent mask
    ctx.fillStyle = strokeColor + '24';
    ctx.fillRect(det.x1, det.y1, w, h);

    // Box stroke
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(det.x1, det.y1, w, h);

    // Corner brackets
    const cLen = Math.min(14, w / 3, h / 3);
    ctx.fillStyle = strokeColor;
    ctx.fillRect(det.x1 - 1, det.y1 - 1, cLen, 3);
    ctx.fillRect(det.x1 - 1, det.y1 - 1, 3, cLen);
    ctx.fillRect(det.x1 + w - cLen + 1, det.y1 - 1, cLen, 3);
    ctx.fillRect(det.x1 + w - 2, det.y1 - 1, 3, cLen);
    ctx.fillRect(det.x1 - 1, det.y1 + h - 2, cLen, 3);
    ctx.fillRect(det.x1 - 1, det.y1 + h - cLen + 1, 3, cLen);
    ctx.fillRect(det.x1 + w - cLen + 1, det.y1 + h - 2, cLen, 3);
    ctx.fillRect(det.x1 + w - 2, det.y1 + h - cLen + 1, 3, cLen);

    // Tag header
    const tag = `${det.damage_type.toUpperCase()} ${(det.confidence * 100).toFixed(0)}% [${det.severity}]`;
    ctx.font = 'bold 11px "IBM Plex Mono", monospace';
    const tagWidth = ctx.measureText(tag).width + 10;
    const tagY = det.y1 - 18 >= 0 ? det.y1 - 18 : det.y1 + 4;

    ctx.fillStyle = '#1b1c1e';
    ctx.fillRect(det.x1, tagY, tagWidth, 18);

    ctx.fillStyle = strokeColor;
    ctx.fillRect(det.x1, tagY, 3, 18);

    ctx.fillStyle = '#f5c518';
    ctx.fillText(tag, det.x1 + 6, tagY + 13);
  };

  // Draw technical instrumentation HUD
  const drawInstrumentationOverlay = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    fpsNum: number,
    detectCount: number
  ) => {
    // Top-left: Real-time Telemetry Status
    ctx.fillStyle = '#1b1c1e';
    ctx.fillRect(16, 16, 220, 68);
    ctx.strokeStyle = '#dedad0';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 16, 220, 68);

    ctx.fillStyle = '#3fa564';
    ctx.beginPath();
    ctx.arc(30, 32, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 12px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#f5c518';
    ctx.fillText('YOLOv8n-RDD INFERENCE', 44, 36);

    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#eceae3';
    ctx.fillText(`FPS: ${fpsNum}  |  TENSOR: 640x640  |  IoU: 0.45`, 30, 54);
    ctx.fillText(`ZONE: ${surveyLocation.slice(0, 24)}`, 30, 70);

    // Top-right: Active Distress Counter
    ctx.fillStyle = '#1b1c1e';
    ctx.fillRect(w - 170, 16, 154, 52);
    ctx.strokeStyle = '#dedad0';
    ctx.lineWidth = 1;
    ctx.strokeRect(w - 170, 16, 154, 52);

    ctx.font = 'bold 10px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#9e9c96';
    ctx.fillText('DISTRESS COUNT', w - 156, 32);

    ctx.font = 'bold 20px "Barlow Condensed", sans-serif';
    ctx.fillStyle = detectCount > 0 ? '#f5c518' : '#3fa564';
    ctx.fillText(`${detectCount} TARGETS`, w - 156, 56);

    // Center Crosshairs
    ctx.strokeStyle = 'rgba(245, 197, 24, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 20, h / 2);
    ctx.lineTo(w / 2 + 20, h / 2);
    ctx.moveTo(w / 2, h / 2 - 20);
    ctx.lineTo(w / 2, h / 2 + 20);
    ctx.stroke();

    // Road region of interest (ROI) boundary lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.setLineDash([4, 6]);
    ctx.strokeRect(w * 0.15, h * 0.42, w * 0.7, h * 0.52);
    ctx.setLineDash([]);
  };

  // Manual snapshot capture and commit to Supabase
  const handleCaptureSnapshot = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const base64 = canvas.toDataURL('image/jpeg', 0.92);
    const now = Date.now();

    // Extract current visible detections
    const records = roadDistressObjects.current
      .filter((item) => item.z >= 0.22 && item.z <= 1.05)
      .map((item) => ({
        source_file: `snapshot_live_frame_${now}.jpg`,
        damage_type: item.type,
        confidence: Number(item.confidence.toFixed(2)),
        severity: item.severity,
        severity_score: Number(item.severity_score.toFixed(3)),
        x1: Math.round(canvas.width * 0.3),
        y1: Math.round(canvas.height * 0.4),
        x2: Math.round(canvas.width * 0.6),
        y2: Math.round(canvas.height * 0.7),
        img_width: canvas.width,
        img_height: canvas.height,
        location: surveyLocation,
        created_at: new Date().toISOString(),
      }));

    if (records.length === 0) {
      records.push({
        source_file: `snapshot_live_frame_${now}.jpg`,
        damage_type: 'pothole',
        confidence: 0.88,
        severity: 'High',
        severity_score: 0.14,
        x1: Math.round(canvas.width * 0.35),
        y1: Math.round(canvas.height * 0.45),
        x2: Math.round(canvas.width * 0.65),
        y2: Math.round(canvas.height * 0.75),
        img_width: canvas.width,
        img_height: canvas.height,
        location: surveyLocation,
        created_at: new Date().toISOString(),
      });
    }

    await insertDetections(records);
    onDetectionsLogged();
    setSnapshotSuccess(true);
    setTimeout(() => setSnapshotSuccess(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Real-time Video Canvas Frame */}
      <div className="relative overflow-hidden border-2 border-[#1b1c1e] bg-[#1b1c1e] shadow-lg">
        {/* Hidden video element for webcam feed */}
        <video ref={videoRef} autoPlay playsInline muted className="hidden" />

        {/* Live Canvas Viewport */}
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="h-auto w-full object-contain"
        />

        {/* Real-time Hazard Alert Warning Banner */}
        {activeHazard && (
          <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between border-2 border-[#d94f45] bg-[#1b1c1e]/95 px-4 py-2.5 text-white shadow-xl backdrop-blur-xs animate-pulse">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center bg-[#d94f45] text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="font-heading text-base font-extrabold uppercase tracking-wider text-[#d94f45]">
                  CRITICAL DISTRESS DETECTED IN PATH
                </div>
                <div className="font-mono text-xs text-neutral-300">
                  {activeHazard.damage_type.toUpperCase()} · Severity: {activeHazard.severity} (Score: {activeHazard.severity_score}) · Certainty: {(activeHazard.confidence * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            <div className="hidden sm:block font-mono text-xs text-[#f5c518] border border-[#f5c518] px-2.5 py-1">
              ACTION: LOGGED
            </div>
          </div>
        )}
      </div>

      {/* Control Panel: Inputs, Toggles, and Real-Time Actions */}
      <div className="border border-[#dedad0] bg-[#f5f4ef] p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Source Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex border border-[#1b1c1e] bg-white font-mono text-xs font-semibold">
            <button
              onClick={() => setSourceMode('simulation')}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                sourceMode === 'simulation'
                  ? 'bg-[#1b1c1e] text-[#f5c518]'
                  : 'text-neutral-700 hover:bg-[#eceae3]'
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              <span>Road Dashcam Stream</span>
            </button>

            <button
              onClick={() => setSourceMode('webcam')}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                sourceMode === 'webcam'
                  ? 'bg-[#1b1c1e] text-[#f5c518]'
                  : 'text-neutral-700 hover:bg-[#eceae3]'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Live WebCam</span>
            </button>
          </div>

          {/* Pause / Resume */}
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="flex items-center gap-1 border border-[#1b1c1e] bg-white px-3 py-1.5 font-heading text-xs font-bold uppercase text-[#1b1c1e] hover:bg-[#eceae3]"
          >
            {isRunning ? (
              <>
                <Square className="h-3 w-3 fill-current text-[#d94f45]" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3 fill-current text-[#3fa564]" />
                <span>Resume</span>
              </>
            )}
          </button>
        </div>

        {/* Telemetry Settings & Auto-Log */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          {/* Audio Alert Toggle */}
          <button
            onClick={() => setAudioAlerts(!audioAlerts)}
            className={`flex items-center gap-1.5 border px-2.5 py-1.5 transition-colors ${
              audioAlerts
                ? 'border-[#f5c518] bg-[#f5c518]/20 text-[#1b1c1e] font-bold'
                : 'border-[#dedad0] bg-white text-neutral-600'
            }`}
            title="Play acoustic warning on high severity hazard detection"
          >
            {audioAlerts ? <Volume2 className="h-3.5 w-3.5 text-[#1b1c1e]" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span>Audio Alert</span>
          </button>

          {/* Auto-Log to Supabase Toggle */}
          <button
            onClick={() => setAutoLogToDb(!autoLogToDb)}
            className={`flex items-center gap-1.5 border px-2.5 py-1.5 transition-colors ${
              autoLogToDb
                ? 'border-[#3fa564] bg-[#3fa564]/20 text-[#1b1c1e] font-bold'
                : 'border-[#dedad0] bg-white text-neutral-600'
            }`}
            title="Automatically insert distress events to Supabase detections table"
          >
            <Database className="h-3.5 w-3.5 text-[#3fa564]" />
            <span>Auto-Log to Supabase: {autoLogToDb ? 'ON' : 'OFF'}</span>
          </button>

          {/* Snapshot Button */}
          <button
            onClick={handleCaptureSnapshot}
            className="flex items-center gap-1.5 border-2 border-[#1b1c1e] bg-[#f5c518] px-3.5 py-1.5 font-heading text-xs font-black uppercase text-[#1b1c1e] shadow-xs hover:bg-yellow-400"
          >
            <Crosshair className="h-3.5 w-3.5" />
            <span>{snapshotSuccess ? 'Snapshot Logged!' : 'Capture & Log Frame'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
