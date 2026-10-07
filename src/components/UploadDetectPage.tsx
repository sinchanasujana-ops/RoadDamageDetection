import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sliders,
  ExternalLink,
  ChevronRight,
  Database,
  Eye,
  Info,
  Radio,
  Video,
  Cpu,
  Camera,
  SwitchCamera,
  X,
  Aperture,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DetectionApiResponse, DetectionBox, DetectionRecord, SeverityLevel } from '../types/detection';
import {
  callDetectionApi,
  getDetectionApiUrl,
  saveDetectionApiUrl,
  getEngineMode,
  setEngineMode,
} from '../lib/api';
import { insertDetections } from '../lib/supabase';
import { RealtimeVisionScanner } from './RealtimeVisionScanner';

// Sample inspection images for instant testing
const SAMPLE_IMAGES = [
  {
    name: 'sample_pothole.jpg',
    label: 'Highway Pothole Distress',
    location: 'District 4 - Highway 101 N',
    path: '/src/assets/images/sample_road_pothole_1791345258858.jpg',
  },
  {
    name: 'sample_alligator.jpg',
    label: 'Alligator Fatigue Cracking',
    location: 'Central Corridor - Main St',
    path: '/src/assets/images/sample_alligator_cracking_1791345271548.jpg',
  },
  {
    name: 'sample_longitudinal.jpg',
    label: 'Longitudinal Joint Crack',
    location: 'Harbor Blvd & 5th Ave',
    path: '/src/assets/images/sample_longitudinal_crack_1791345283574.jpg',
  },
];

interface UploadDetectPageProps {
  onDetectionsLogged: () => void;
  onOpenPowerBiModal: () => void;
}

export const UploadDetectPage: React.FC<UploadDetectPageProps> = ({
  onDetectionsLogged,
  onOpenPowerBiModal,
}) => {
  const [activeWorkflow, setActiveWorkflow] = useState<'upload' | 'realtime'>('upload');
  const [inputSourceMode, setInputSourceMode] = useState<'upload' | 'camera'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<string>('District 4 - Highway 101 N');
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiResult, setApiResult] = useState<DetectionApiResponse | null>(null);
  const [saveStatus, setSaveStatus] = useState<{
    saved: boolean;
    usedSupabase: boolean;
    count: number;
    error?: string;
  } | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showApiSettings, setShowApiSettings] = useState<boolean>(false);
  const [engineMode, setEngineModeState] = useState<'builtin' | 'external'>(getEngineMode());
  const [currentApiUrl, setCurrentApiUrl] = useState<string>(getDetectionApiUrl());
  const [activeImageView, setActiveImageView] = useState<'annotated' | 'original'>('annotated');
  const [selectedDetectionIdx, setSelectedDetectionIdx] = useState<number | null>(null);

  // Camera integration state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isCameraLoading, setIsCameraLoading] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturedFromCamera, setIsCapturedFromCamera] = useState<boolean>(false);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Set default sample image on mount so user sees ready-to-test UI immediately
  useEffect(() => {
    loadSampleImage(SAMPLE_IMAGES[0]);
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Stop camera if user switches to Real-time video workflow tab
  useEffect(() => {
    if (activeWorkflow === 'realtime') {
      stopCameraStream();
    }
  }, [activeWorkflow]);

  const stopCameraStream = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
    setIsCameraLoading(false);
  };

  const startCamera = async (facing: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    setIsCameraLoading(true);
    stopCameraStream();

    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
      } catch {
        // Fallback constraint
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play();
      }
      setIsCameraActive(true);
      setIsCameraLoading(false);
      setInputSourceMode('camera');
    } catch (err: any) {
      console.warn('Camera access request failed:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera permissions in your browser or use the file upload option.'
          : 'Unable to connect to camera device. Please check hardware connection or upload a photo directly.'
      );
      setIsCameraActive(false);
      setIsCameraLoading(false);
    }
  };

  const switchFacingMode = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    await startCamera(nextFacing);
  };

  const captureCameraPhoto = () => {
    if (!cameraVideoRef.current) return;
    const video = cameraVideoRef.current;
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Trigger visual shutter flash
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 220);

    ctx.drawImage(video, 0, 0, vw, vh);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `road_capture_${timestamp}.jpg`;
          const file = new File([blob], filename, { type: 'image/jpeg' });
          setIsCapturedFromCamera(true);
          processSelectedFile(file);
          stopCameraStream();
          setInputSourceMode('upload');
        }
      },
      'image/jpeg',
      0.95
    );
  };

  const loadSampleImage = async (sample: typeof SAMPLE_IMAGES[0]) => {
    stopCameraStream();
    setIsCapturedFromCamera(false);
    try {
      const res = await fetch(sample.path);
      const blob = await res.blob();
      const file = new File([blob], sample.name, { type: 'image/jpeg' });
      setSelectedFile(file);
      setLocation(sample.location);
      setApiResult(null);
      setSaveStatus(null);
      setErrorMessage(null);

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      const img = new Image();
      img.onload = () => {
        setImgDimensions({
          width: img.naturalWidth || 800,
          height: img.naturalHeight || 600,
        });
      };
      img.src = url;
    } catch (e) {
      console.error('Failed to load sample image:', e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCapturedFromCamera(false);
      processSelectedFile(file);
    }
  };

  const handleMobileCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCapturedFromCamera(true);
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    setSelectedFile(file);
    setApiResult(null);
    setSaveStatus(null);
    setErrorMessage(null);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const img = new Image();
    img.onload = () => {
      setImgDimensions({
        width: img.naturalWidth || 800,
        height: img.naturalHeight || 600,
      });
    };
    img.src = url;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setIsCapturedFromCamera(false);
      processSelectedFile(file);
    }
  };

  const handleToggleEngine = (mode: 'builtin' | 'external') => {
    setEngineMode(mode);
    setEngineModeState(mode);
  };

  const handleSaveApiUrl = () => {
    saveDetectionApiUrl(currentApiUrl);
    setShowApiSettings(false);
  };

  const handleRunDetection = async (forceSimulate = false) => {
    if (!selectedFile || !previewUrl) {
      setErrorMessage('Please select, take, or upload a pavement photo first.');
      return;
    }
    if (!location.trim()) {
      setErrorMessage('Please provide a survey location before running detection.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setApiResult(null);
    setSaveStatus(null);

    try {
      const response = await callDetectionApi(
        selectedFile,
        location.trim(),
        imgDimensions,
        previewUrl,
        forceSimulate
      );

      setApiResult(response);
      setActiveImageView('annotated');

      // Save each detection row to Supabase table `detections`
      if (response.detections && response.detections.length > 0) {
        const recordsToInsert = response.detections.map((det) => ({
          source_file: selectedFile.name,
          damage_type: det.damage_type,
          confidence: det.confidence,
          severity: det.severity,
          severity_score: det.severity_score,
          x1: det.x1,
          y1: det.y1,
          x2: det.x2,
          y2: det.y2,
          img_width: imgDimensions.width,
          img_height: imgDimensions.height,
          location: location.trim(),
          created_at: new Date().toISOString(),
        }));

        const result = await insertDetections(recordsToInsert);
        setSaveStatus({
          saved: result.success,
          usedSupabase: result.usedSupabase,
          count: result.insertedCount,
          error: result.error,
        });

        onDetectionsLogged();
      } else {
        setSaveStatus({
          saved: true,
          usedSupabase: true,
          count: 0,
        });
      }

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
    } catch (err: any) {
      console.error('Detection execution error:', err);
      setErrorMessage(
        `Computer Vision Detection Error: ${err.message || 'Please check engine configuration.'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityBadgeClass = (severity: SeverityLevel) => {
    switch (severity) {
      case 'High':
        return 'bg-[#d94f45] text-white border-[#d94f45]';
      case 'Medium':
        return 'bg-[#e0a13a] text-white border-[#e0a13a]';
      case 'Low':
        return 'bg-[#3fa564] text-white border-[#3fa564]';
      default:
        return 'bg-neutral-600 text-white border-neutral-600';
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Title & Technical Protocol Banner */}
      <div className="mb-6 border-b border-[#dedad0] pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 bg-[#f5c518]"></span>
              <h1 className="font-heading text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#1b1c1e]">
                Pavement Distress Inference &amp; Telemetry
              </h1>
            </div>
            <p className="font-mono text-xs text-neutral-600 mt-1">
              Autonomous YOLOv8 road damage detection via device camera photo or survey file uploads
            </p>
          </div>

          {/* Workflow Toggle: Photo Inspection vs Real-time Video Stream */}
          <div className="flex items-center gap-2">
            <div className="flex border-2 border-[#1b1c1e] bg-white font-mono text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setActiveWorkflow('upload');
                }}
                className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${
                  activeWorkflow === 'upload'
                    ? 'bg-[#1b1c1e] text-[#f5c518]'
                    : 'text-neutral-700 hover:bg-[#eceae3]'
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Photo Inspection</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setActiveWorkflow('realtime');
                }}
                className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${
                  activeWorkflow === 'realtime'
                    ? 'bg-[#1b1c1e] text-[#f5c518]'
                    : 'text-neutral-700 hover:bg-[#eceae3]'
                }`}
              >
                <Radio className="h-3.5 w-3.5 text-[#d94f45] animate-pulse" />
                <span>Real-Time Live Vision</span>
              </button>
            </div>

            <button
              onClick={() => setShowApiSettings(!showApiSettings)}
              className="flex items-center gap-1.5 border border-[#1b1c1e] bg-white px-3 py-2 font-mono text-xs text-[#1b1c1e] hover:bg-[#eceae3] transition-colors"
              title="Configure computer vision inference engine"
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>CV Engine</span>
            </button>
          </div>
        </div>

        {/* Engine Settings Drawer */}
        {showApiSettings && (
          <div className="mt-4 border border-[#1b1c1e] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-[#dedad0] pb-2">
              <span className="font-heading text-sm font-bold uppercase text-[#1b1c1e]">
                Computer Vision Model Configuration
              </span>
              <span className="font-mono text-[11px] text-[#3fa564] font-bold">
                ✓ Full-Stack Self-Contained Engine Active
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-mono text-xs font-bold text-neutral-700 mb-1">
                  Inference Mode
                </label>
                <div className="flex gap-2 font-mono text-xs">
                  <button
                    onClick={() => handleToggleEngine('builtin')}
                    className={`border px-3 py-1.5 font-bold ${
                      engineMode === 'builtin'
                        ? 'border-[#1b1c1e] bg-[#1b1c1e] text-[#f5c518]'
                        : 'border-[#dedad0] bg-white text-neutral-600'
                    }`}
                  >
                    Built-in Self-Contained Engine (/api/detect)
                  </button>
                  <button
                    onClick={() => handleToggleEngine('external')}
                    className={`border px-3 py-1.5 font-bold ${
                      engineMode === 'external'
                        ? 'border-[#1b1c1e] bg-[#1b1c1e] text-[#f5c518]'
                        : 'border-[#dedad0] bg-white text-neutral-600'
                    }`}
                  >
                    External Python Microservice
                  </button>
                </div>
              </div>

              {engineMode === 'external' && (
                <div className="pt-2">
                  <label className="block font-mono text-xs font-bold text-neutral-700 mb-1">
                    External Endpoint URL (VITE_DETECTION_API_URL)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentApiUrl}
                      onChange={(e) => setCurrentApiUrl(e.target.value)}
                      placeholder="http://localhost:8000/detect"
                      className="flex-1 border border-[#dedad0] bg-[#f5f4ef] px-3 py-1.5 font-mono text-xs text-[#1b1c1e]"
                    />
                    <button
                      onClick={handleSaveApiUrl}
                      className="border border-[#1b1c1e] bg-[#1b1c1e] px-4 py-1.5 font-heading text-xs font-bold uppercase text-white hover:bg-black"
                    >
                      Save URL
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* WORKFLOW VIEW 1: REAL-TIME LIVE VISION SCANNER */}
      {activeWorkflow === 'realtime' && (
        <div className="space-y-6">
          <div className="border border-[#dedad0] bg-[#f5f4ef] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-heading text-lg font-bold uppercase text-[#1b1c1e]">
                Autonomous Road Distress Scanner (Real-Time 30 FPS)
              </h3>
              <p className="font-mono text-xs text-neutral-600">
                Live computer vision stream tracking potholes and cracks directly in the browser
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-neutral-500">Survey Zone:</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="border border-[#dedad0] bg-white px-2 py-1 font-bold text-[#1b1c1e]"
              />
            </div>
          </div>

          <RealtimeVisionScanner
            onDetectionsLogged={onDetectionsLogged}
            surveyLocation={location}
          />
        </div>
      )}

      {/* WORKFLOW VIEW 2: PHOTO INSPECTION (UPLOAD OR DEVICE CAMERA CAPTURE) */}
      {activeWorkflow === 'upload' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Input Form (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Presets Bar */}
              <div className="border border-[#dedad0] bg-[#f5f4ef] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-heading text-xs font-bold uppercase tracking-wider text-neutral-700">
                    Preset Survey Samples
                  </span>
                  <span className="font-mono text-[10px] text-neutral-500">1-click test</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {SAMPLE_IMAGES.map((sample) => (
                    <button
                      key={sample.name}
                      type="button"
                      onClick={() => loadSampleImage(sample)}
                      className="group relative flex flex-col items-center border border-[#dedad0] bg-white p-1.5 text-left transition-all hover:border-[#1b1c1e] hover:shadow-xs"
                    >
                      <div className="h-14 w-full overflow-hidden bg-neutral-200">
                        <img
                          src={sample.path}
                          alt={sample.label}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                      <span className="mt-1 line-clamp-1 w-full font-mono text-[10px] font-semibold text-[#1b1c1e]">
                        {sample.label.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* INPUT MODE SELECTOR: Upload File vs Take Photo with Device Camera */}
              <div className="flex border-2 border-[#1b1c1e] bg-white font-mono text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    setInputSourceMode('upload');
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors ${
                    !isCameraActive && inputSourceMode === 'upload'
                      ? 'bg-[#1b1c1e] text-[#f5c518]'
                      : 'text-neutral-700 hover:bg-[#eceae3]'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload File / Browse</span>
                </button>

                <button
                  type="button"
                  onClick={() => startCamera()}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 transition-colors ${
                    isCameraActive || inputSourceMode === 'camera'
                      ? 'bg-[#1b1c1e] text-[#f5c518]'
                      : 'text-neutral-700 hover:bg-[#eceae3]'
                  }`}
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Take Photo (Camera)</span>
                </button>
              </div>

              {/* Camera Error Alert */}
              {cameraError && (
                <div className="border border-[#d94f45] bg-[#d94f45]/10 p-3 text-xs text-[#d94f45] font-mono flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Camera Notice</div>
                    <div>{cameraError}</div>
                  </div>
                </div>
              )}

              {/* Hidden file and mobile camera inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={mobileCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleMobileCameraCapture}
                className="hidden"
              />

              {/* VIEW A: LIVE CAMERA VIEWFINDER CARD */}
              {isCameraActive ? (
                <div className="relative border-2 border-[#1b1c1e] bg-[#1b1c1e] overflow-hidden shadow-md">
                  {/* Visual Flash effect */}
                  {flashEffect && (
                    <div className="absolute inset-0 z-30 bg-white opacity-90 transition-opacity duration-200 pointer-events-none" />
                  )}

                  {/* Header bar on viewfinder */}
                  <div className="flex items-center justify-between border-b border-neutral-700 bg-neutral-900/90 px-3 py-2 text-white font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#d94f45] animate-ping" />
                      <span className="font-bold text-[#f5c518]">LIVE CAMERA VIEWFINDER</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={switchFacingMode}
                        className="flex items-center gap-1 border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:border-white hover:text-white"
                        title="Switch between front and rear cameras"
                      >
                        <SwitchCamera className="h-3 w-3" />
                        <span>Flip</span>
                      </button>

                      <button
                        type="button"
                        onClick={stopCameraStream}
                        className="p-1 text-neutral-400 hover:text-white"
                        title="Close Camera"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Live video viewport with targeting overlay */}
                  <div className="relative min-h-[280px] bg-black flex items-center justify-center">
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-auto max-h-[360px] object-cover"
                    />

                    {/* Camera alignment crosshairs */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                      <div className="relative w-48 h-36 border-2 border-dashed border-[#f5c518]/70 flex items-center justify-center">
                        <div className="w-4 h-0.5 bg-[#f5c518] absolute" />
                        <div className="h-4 w-0.5 bg-[#f5c518] absolute" />
                        <span className="absolute -bottom-6 font-mono text-[10px] text-[#f5c518] uppercase tracking-wider bg-black/60 px-1.5 py-0.5">
                          Target Road Distress
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Shutter controls footer */}
                  <div className="border-t border-neutral-800 bg-[#1b1c1e] p-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => mobileCameraInputRef.current?.click()}
                      className="font-mono text-[11px] text-neutral-400 hover:text-[#f5c518] underline"
                      title="Open full-screen native camera app"
                    >
                      Use Native Camera App
                    </button>

                    <button
                      type="button"
                      onClick={captureCameraPhoto}
                      className="flex items-center gap-2 border-2 border-[#1b1c1e] bg-[#f5c518] px-5 py-2.5 font-heading text-sm font-black uppercase tracking-wider text-[#1b1c1e] shadow-md hover:bg-yellow-400 active:scale-95 transition-transform"
                    >
                      <Aperture className="h-4 w-4" />
                      <span>Take Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={stopCameraStream}
                      className="font-mono text-xs text-neutral-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* VIEW B: DRAG & DROP ZONE WITH CAMERA SHORTCUT */
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="group relative flex min-h-[220px] flex-col items-center justify-center border-2 border-dashed border-[#1b1c1e] bg-[#f5f4ef] p-6 text-center transition-colors hover:bg-white"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-12 w-12 items-center justify-center border border-[#1b1c1e] bg-white text-[#1b1c1e] transition-transform hover:scale-105"
                      title="Browse computer files"
                    >
                      <Upload className="h-6 w-6 text-[#1b1c1e]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="flex h-12 w-12 items-center justify-center border-2 border-[#1b1c1e] bg-[#f5c518] text-[#1b1c1e] transition-transform hover:scale-105"
                      title="Open Device Camera to take a photo"
                    >
                      <Camera className="h-6 w-6 text-[#1b1c1e]" />
                    </button>
                  </div>

                  <div className="mt-4 font-heading text-lg font-bold uppercase tracking-wide text-[#1b1c1e]">
                    Take Photo or Drop Road Image
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="font-bold text-[#1b1c1e] underline decoration-[#f5c518] decoration-2 hover:text-black"
                    >
                      Open Live Camera
                    </button>
                    <span className="text-neutral-400">·</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-neutral-700 underline hover:text-black"
                    >
                      Browse Files
                    </button>
                    <span className="text-neutral-400">·</span>
                    <button
                      type="button"
                      onClick={() => mobileCameraInputRef.current?.click()}
                      className="text-neutral-500 hover:text-neutral-800"
                    >
                      Phone Camera
                    </button>
                  </div>

                  {selectedFile && (
                    <div className="mt-4 inline-flex items-center gap-2 border border-[#1b1c1e] bg-white px-3 py-1 font-mono text-xs font-semibold text-[#1b1c1e]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#3fa564]" />
                      <span className="truncate max-w-[180px]">{selectedFile.name}</span>
                      <span className="text-neutral-400">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                      {isCapturedFromCamera && (
                        <span className="bg-[#f5c518] px-1.5 py-0.2 text-[10px] font-bold text-[#1b1c1e]">
                          Camera Photo
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Retake Camera Photo Bar if a photo is already loaded */}
              {selectedFile && !isCameraActive && (
                <div className="flex items-center justify-between border border-[#dedad0] bg-white px-3 py-2 font-mono text-xs">
                  <div className="flex items-center gap-1.5 text-neutral-600">
                    <Camera className="h-3.5 w-3.5 text-[#1b1c1e]" />
                    <span>Need another photo of this pothole?</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="flex items-center gap-1 border border-[#1b1c1e] bg-[#f5f4ef] px-2.5 py-1 font-bold text-[#1b1c1e] hover:bg-[#dedad0]"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Take New Photo</span>
                  </button>
                </div>
              )}

              {/* Location Input Field */}
              <div className="border border-[#dedad0] bg-[#f5f4ef] p-4">
                <label className="block font-heading text-sm font-bold uppercase tracking-wider text-[#1b1c1e] mb-1">
                  Survey Location (City / Sector / Milepost)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Seattle - 4th Ave, District 4 - Highway 101 N"
                  className="w-full border border-[#dedad0] bg-white px-3 py-2.5 font-mono text-xs text-[#1b1c1e] focus:border-[#1b1c1e] focus:outline-hidden"
                />
                <span className="mt-1 block font-mono text-[10px] text-neutral-500">
                  Committed to Supabase <code className="font-bold">location</code> column
                </span>
              </div>

              {/* Action Button: Run YOLOv8 Detection */}
              <button
                type="button"
                onClick={() => handleRunDetection(false)}
                disabled={isLoading || !selectedFile || isCameraActive}
                className="flex w-full items-center justify-center gap-2 border-2 border-[#1b1c1e] bg-[#f5c518] py-3.5 font-heading text-lg font-black uppercase tracking-wider text-[#1b1c1e] shadow-sm transition-all hover:bg-yellow-400 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RotateCcw className="h-5 w-5 animate-spin text-[#1b1c1e]" />
                    <span>Executing YOLOv8 Inference...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 fill-[#1b1c1e]" />
                    <span>Run YOLOv8 Detection</span>
                  </>
                )}
              </button>

              {/* Error Box */}
              {errorMessage && (
                <div className="border-2 border-[#d94f45] bg-[#d94f45]/10 p-4">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-5 w-5 shrink-0 text-[#d94f45] mt-0.5" />
                    <div className="space-y-2 text-xs">
                      <div className="font-heading text-sm font-bold uppercase text-[#d94f45]">
                        Detection Engine Alert
                      </div>
                      <p className="font-mono text-neutral-800 leading-relaxed">{errorMessage}</p>
                      <button
                        onClick={() => handleRunDetection(true)}
                        className="mt-2 inline-flex items-center gap-1.5 border border-[#1b1c1e] bg-[#1b1c1e] px-3 py-1.5 font-heading text-xs font-bold uppercase text-white hover:bg-black"
                      >
                        <span>Run Client Vision Fallback</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Photo Preview & Sensor Viewport (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="border border-[#dedad0] bg-[#f5f4ef] p-4">
                <div className="mb-3 flex items-center justify-between border-b border-[#dedad0] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-base font-bold uppercase text-[#1b1c1e]">
                      Viewport Sensor Display
                    </span>
                    <span className="font-mono text-xs text-neutral-500">
                      {imgDimensions.width} &times; {imgDimensions.height} px
                    </span>
                  </div>

                  {apiResult && (
                    <div className="flex border border-[#1b1c1e] font-mono text-xs">
                      <button
                        onClick={() => setActiveImageView('annotated')}
                        className={`px-2.5 py-1 font-semibold uppercase ${
                          activeImageView === 'annotated'
                            ? 'bg-[#1b1c1e] text-[#f5c518]'
                            : 'bg-white text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        Annotated (YOLOv8)
                      </button>
                      <button
                        onClick={() => setActiveImageView('original')}
                        className={`px-2.5 py-1 font-semibold uppercase ${
                          activeImageView === 'original'
                            ? 'bg-[#1b1c1e] text-[#f5c518]'
                            : 'bg-white text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        Raw Image
                      </button>
                    </div>
                  )}
                </div>

                {/* Image Canvas Container */}
                <div className="relative min-h-[360px] w-full overflow-hidden border border-[#dedad0] bg-[#1b1c1e] flex items-center justify-center">
                  {isLoading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs text-white">
                      <RotateCcw className="h-8 w-8 animate-spin text-[#f5c518] mb-3" />
                      <span className="font-heading text-lg font-bold uppercase tracking-wider text-[#f5c518]">
                        Processing YOLOv8 Inference
                      </span>
                      <span className="font-mono text-xs text-neutral-400 mt-1">
                        Detecting potholes &amp; cracking distresses...
                      </span>
                    </div>
                  )}

                  {previewUrl ? (
                    <img
                      src={
                        activeImageView === 'annotated' && apiResult?.annotated_image_base64
                          ? apiResult.annotated_image_base64
                          : previewUrl
                      }
                      alt="Road Inspection View"
                      className="max-h-[500px] w-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-neutral-500">
                      <ImageIcon className="h-12 w-12 text-neutral-600 mb-2" />
                      <span className="font-mono text-xs">Awaiting pavement image capture or upload</span>
                    </div>
                  )}
                </div>

                {/* Telemetry info bar */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs text-neutral-600 border-t border-[#dedad0] pt-2">
                  <div>
                    Location: <strong className="text-[#1b1c1e]">{location}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Source:</span>
                    <strong className="text-[#1b1c1e]">
                      {selectedFile ? selectedFile.name : 'None'}
                    </strong>
                    {isCapturedFromCamera && (
                      <span className="border border-[#1b1c1e] bg-[#f5c518] px-1.5 py-0.2 text-[10px] font-bold text-[#1b1c1e]">
                        Live Camera Photo
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RESULTS SECTION: Smooth slide-in animation underneath form */}
          <AnimatePresence>
            {apiResult && (
              <motion.div
                ref={resultsRef}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="mt-10 space-y-6"
              >
                <div className="road-marking-divider"></div>

                <div className="border-2 border-[#1b1c1e] bg-white p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#dedad0] pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 bg-[#3fa564]"></span>
                        <h2 className="font-heading text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-[#1b1c1e]">
                          YOLOv8 Distress Detections &amp; Severity Assessment
                        </h2>
                      </div>
                      <p className="font-mono text-xs text-neutral-600 mt-1">
                        YOLOv8n-RDD 640x640 tensor matrix, IoU Non-Maximum Suppression, and severity scoring
                      </p>
                    </div>

                    {saveStatus && (
                      <div className="flex items-center gap-3 border border-[#dedad0] bg-[#f5f4ef] px-4 py-2 font-mono text-xs">
                        <Database className="h-4 w-4 text-[#1b1c1e]" />
                        <div>
                          <div className="font-bold text-[#1b1c1e]">
                            {saveStatus.usedSupabase
                              ? 'Committed to Supabase `detections`'
                              : 'Logged to Local Cache (Ready for Supabase)'}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {saveStatus.count} distress records recorded
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Detections Summary Counters */}
                  <div className="my-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="border border-[#dedad0] bg-[#f5f4ef] p-3 text-center">
                      <span className="block font-mono text-[10px] uppercase text-neutral-500">Total Detections</span>
                      <span className="font-heading text-3xl font-black text-[#1b1c1e] tabular-nums">
                        {apiResult.detections.length}
                      </span>
                    </div>
                    <div className="border border-[#dedad0] bg-[#f5f4ef] p-3 text-center">
                      <span className="block font-mono text-[10px] uppercase text-neutral-500">High Severity</span>
                      <span className="font-heading text-3xl font-black text-[#d94f45] tabular-nums">
                        {apiResult.detections.filter((d) => d.severity === 'High').length}
                      </span>
                    </div>
                    <div className="border border-[#dedad0] bg-[#f5f4ef] p-3 text-center">
                      <span className="block font-mono text-[10px] uppercase text-neutral-500">Medium Severity</span>
                      <span className="font-heading text-3xl font-black text-[#e0a13a] tabular-nums">
                        {apiResult.detections.filter((d) => d.severity === 'Medium').length}
                      </span>
                    </div>
                    <div className="border border-[#dedad0] bg-[#f5f4ef] p-3 text-center">
                      <span className="block font-mono text-[10px] uppercase text-neutral-500">Low Severity</span>
                      <span className="font-heading text-3xl font-black text-[#3fa564] tabular-nums">
                        {apiResult.detections.filter((d) => d.severity === 'Low').length}
                      </span>
                    </div>
                  </div>

                  {/* RESULTS TABLE */}
                  <div className="overflow-x-auto border border-[#1b1c1e]">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="border-b-2 border-[#1b1c1e] bg-[#1b1c1e] text-white font-heading text-sm uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Damage Type</th>
                          <th className="py-2.5 px-3">Confidence</th>
                          <th className="py-2.5 px-3">Severity</th>
                          <th className="py-2.5 px-3">Severity Score</th>
                          <th className="py-2.5 px-3">Bounding Box [x1, y1, x2, y2]</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#dedad0] bg-white">
                        {apiResult.detections.map((det, idx) => (
                          <tr
                            key={idx}
                            className={`transition-colors hover:bg-[#f5f4ef] ${
                              selectedDetectionIdx === idx ? 'bg-[#f5c518]/15 font-semibold' : ''
                            }`}
                            onMouseEnter={() => setSelectedDetectionIdx(idx)}
                            onMouseLeave={() => setSelectedDetectionIdx(null)}
                          >
                            <td className="py-3 px-3 font-bold text-neutral-500">{idx + 1}</td>
                            <td className="py-3 px-3">
                              <span className="font-heading text-sm font-bold uppercase text-[#1b1c1e]">
                                {det.damage_type}
                              </span>
                            </td>
                            <td className="py-3 px-3 tabular-nums font-bold text-[#1b1c1e]">
                              {(det.confidence * 100).toFixed(1)}%
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-block px-2.5 py-0.5 border font-mono text-xs font-bold uppercase ${getSeverityBadgeClass(
                                  det.severity
                                )}`}
                              >
                                {det.severity}
                              </span>
                            </td>
                            <td className="py-3 px-3 tabular-nums font-bold text-neutral-800">
                              {det.severity_score.toFixed(4)}
                            </td>
                            <td className="py-3 px-3 tabular-nums text-neutral-600">
                              [{det.x1}, {det.y1}, {det.x2}, {det.y2}]
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className="text-[11px] text-neutral-400">YOLOv8 Box</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-neutral-400" />
                      <span>
                        Bounding box coordinates normalized against {imgDimensions.width} &times;{' '}
                        {imgDimensions.height} px frame.
                      </span>
                    </div>
                    <button
                      onClick={onOpenPowerBiModal}
                      className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#1b1c1e] underline hover:text-[#f5c518]"
                    >
                      <span>Verify Supabase Table Schema &amp; Power BI Connection</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};
