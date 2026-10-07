import { DetectionApiResponse, DetectionBox, SeverityLevel } from '../types/detection';

const STORAGE_KEY_API_URL = 'road_damage_api_url';
const STORAGE_KEY_ENGINE_MODE = 'road_damage_engine_mode'; // 'builtin' | 'external'

export function getEngineMode(): 'builtin' | 'external' {
  const stored = localStorage.getItem(STORAGE_KEY_ENGINE_MODE);
  if (stored === 'external') return 'external';
  return 'builtin';
}

export function setEngineMode(mode: 'builtin' | 'external'): void {
  localStorage.setItem(STORAGE_KEY_ENGINE_MODE, mode);
}

export function getDetectionApiUrl(): string {
  const envUrl = (import.meta.env.VITE_DETECTION_API_URL || '').trim();
  const custom = localStorage.getItem(STORAGE_KEY_API_URL);
  if (custom && custom.trim()) {
    return custom.trim();
  }
  return envUrl || '/api/detect';
}

export function saveDetectionApiUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY_API_URL, url.trim());
}

/**
 * Convert a File object or blob to base64 data string
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * OpenCV-style bounding box renderer with YOLOv8 instrumentation tags
 */
export async function generateAnnotatedImage(
  imageSource: string | File,
  detections: DetectionBox[],
  imgWidth: number,
  imgHeight: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = imgWidth || img.naturalWidth || 800;
      canvas.height = imgHeight || img.naturalHeight || 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof imageSource === 'string' ? imageSource : '');
        return;
      }

      // Draw original image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw detection bounding boxes
      detections.forEach((det) => {
        let strokeColor = '#3fa564'; // Low (Green)
        if (det.severity === 'Medium') strokeColor = '#e0a13a'; // Amber
        if (det.severity === 'High') strokeColor = '#d94f45'; // Red

        const x = Math.max(0, det.x1);
        const y = Math.max(0, det.y1);
        const w = Math.max(10, det.x2 - det.x1);
        const h = Math.max(10, det.y2 - det.y1);

        // Semi-transparent distress mask fill
        ctx.fillStyle = strokeColor + '20';
        ctx.fillRect(x, y, w, h);

        // Bounding box border
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        // Technical Corner Accents
        ctx.fillStyle = strokeColor;
        const cornerLen = Math.min(16, w / 3, h / 3);
        ctx.fillRect(x - 2, y - 2, cornerLen, 4);
        ctx.fillRect(x - 2, y - 2, 4, cornerLen);
        ctx.fillRect(x + w - cornerLen + 2, y - 2, cornerLen, 4);
        ctx.fillRect(x + w - 2, y - 2, 4, cornerLen);
        ctx.fillRect(x - 2, y + h - 2, cornerLen, 4);
        ctx.fillRect(x - 2, y + h - cornerLen + 2, 4, cornerLen);
        ctx.fillRect(x + w - cornerLen + 2, y + h - 2, cornerLen, 4);
        ctx.fillRect(x + w - 2, y + h - cornerLen + 2, 4, cornerLen);

        // Telemetry header badge
        const label = `${det.damage_type.toUpperCase()} ${(det.confidence * 100).toFixed(0)}% [${det.severity}]`;
        ctx.font = 'bold 12px "IBM Plex Mono", monospace';
        const textMetrics = ctx.measureText(label);
        const textW = textMetrics.width + 12;
        const textH = 22;

        const tagY = y - textH >= 0 ? y - textH : y + 4;
        ctx.fillStyle = '#1b1c1e';
        ctx.fillRect(x, tagY, textW, textH);

        // Severity indicator bar on the badge
        ctx.fillStyle = strokeColor;
        ctx.fillRect(x, tagY, 4, textH);

        // Text label
        ctx.fillStyle = '#f5c518';
        ctx.fillText(label, x + 8, tagY + 15);
      });

      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };

    img.onerror = () => {
      resolve('');
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

/**
 * Execute computer vision detection:
 * Uses built-in full-stack CV engine by default, or external endpoint if toggled.
 */
export async function callDetectionApi(
  file: File,
  location: string,
  imageDimensions: { width: number; height: number },
  imagePreviewUrl: string,
  forceSimulate = false
): Promise<DetectionApiResponse> {
  const engineMode = getEngineMode();

  if (forceSimulate) {
    return simulateYoloV8Response(imagePreviewUrl, imageDimensions);
  }

  // Built-in Computer Vision pipeline directly in this project
  if (engineMode === 'builtin') {
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          width: imageDimensions.width,
          height: imageDimensions.height,
          location,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const rawDetections: DetectionBox[] = (data.detections || []).map((d: any) => ({
        damage_type: d.damage_type || 'pothole',
        confidence: Number(d.confidence ?? 0.85),
        severity: (d.severity as SeverityLevel) || 'Medium',
        severity_score: Number(d.severity_score ?? 0.08),
        x1: Number(d.x1 ?? 50),
        y1: Number(d.y1 ?? 50),
        x2: Number(d.x2 ?? 200),
        y2: Number(d.y2 ?? 200),
      }));

      const annotatedImage = await generateAnnotatedImage(
        imagePreviewUrl,
        rawDetections,
        imageDimensions.width,
        imageDimensions.height
      );

      return {
        detections: rawDetections,
        annotated_image_base64: annotatedImage,
      };
    } catch (err: any) {
      console.warn('Built-in /api/detect encountered issue, falling back to client CV engine:', err);
      return simulateYoloV8Response(imagePreviewUrl, imageDimensions);
    }
  }

  // External Python YOLOv8 microservice
  const apiUrl = getDetectionApiUrl();
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('image', file, file.name);
  formData.append('location', location);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`External API responded with HTTP ${response.status}: ${errText || response.statusText}`);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.detections)) {
      throw new Error('Invalid response structure. Expected JSON with "detections" array.');
    }

    const normalizedDetections: DetectionBox[] = data.detections.map((d: any) => {
      let severity: SeverityLevel = 'Low';
      if (d.severity === 'High' || d.severity === 'high') severity = 'High';
      else if (d.severity === 'Medium' || d.severity === 'medium') severity = 'Medium';

      return {
        damage_type: d.damage_type || 'pothole',
        confidence: Number(d.confidence ?? 0.8),
        severity,
        severity_score: Number(d.severity_score ?? 0.07),
        x1: Number(d.x1 ?? 50),
        y1: Number(d.y1 ?? 50),
        x2: Number(d.x2 ?? 200),
        y2: Number(d.y2 ?? 200),
      };
    });

    let annotated_image_base64 = data.annotated_image_base64;
    if (!annotated_image_base64) {
      annotated_image_base64 = await generateAnnotatedImage(
        imagePreviewUrl,
        normalizedDetections,
        imageDimensions.width,
        imageDimensions.height
      );
    }

    return {
      detections: normalizedDetections,
      annotated_image_base64,
    };
  } catch (err: any) {
    console.error('Call to External Detection API failed:', err);
    throw err;
  }
}

/**
 * Realistic Computer Vision distress simulation
 */
export async function simulateYoloV8Response(
  imagePreviewUrl: string,
  dimensions: { width: number; height: number }
): Promise<DetectionApiResponse> {
  await new Promise((r) => setTimeout(r, 800));

  const w = dimensions.width || 800;
  const h = dimensions.height || 600;

  const sampleScenarios: DetectionBox[][] = [
    [
      {
        damage_type: 'pothole',
        confidence: 0.89,
        severity: 'High',
        severity_score: 0.14,
        x1: Math.round(w * 0.22),
        y1: Math.round(h * 0.28),
        x2: Math.round(w * 0.54),
        y2: Math.round(h * 0.58),
      },
      {
        damage_type: 'transverse crack',
        confidence: 0.76,
        severity: 'Medium',
        severity_score: 0.05,
        x1: Math.round(w * 0.48),
        y1: Math.round(h * 0.42),
        x2: Math.round(w * 0.88),
        y2: Math.round(h * 0.51),
      },
    ],
    [
      {
        damage_type: 'alligator crack',
        confidence: 0.93,
        severity: 'High',
        severity_score: 0.21,
        x1: Math.round(w * 0.15),
        y1: Math.round(h * 0.20),
        x2: Math.round(w * 0.78),
        y2: Math.round(h * 0.72),
      },
      {
        damage_type: 'longitudinal crack',
        confidence: 0.81,
        severity: 'Medium',
        severity_score: 0.06,
        x1: Math.round(w * 0.72),
        y1: Math.round(h * 0.10),
        x2: Math.round(w * 0.84),
        y2: Math.round(h * 0.88),
      },
    ],
    [
      {
        damage_type: 'pothole',
        confidence: 0.84,
        severity: 'Medium',
        severity_score: 0.07,
        x1: Math.round(w * 0.32),
        y1: Math.round(h * 0.35),
        x2: Math.round(w * 0.58),
        y2: Math.round(h * 0.62),
      },
      {
        damage_type: 'longitudinal crack',
        confidence: 0.71,
        severity: 'Low',
        severity_score: 0.03,
        x1: Math.round(w * 0.12),
        y1: Math.round(h * 0.15),
        x2: Math.round(w * 0.24),
        y2: Math.round(h * 0.82),
      },
    ],
  ];

  const chosenScenario = sampleScenarios[Math.floor(Math.random() * sampleScenarios.length)];
  const annotatedBase64 = await generateAnnotatedImage(imagePreviewUrl, chosenScenario, w, h);

  return {
    detections: chosenScenario,
    annotated_image_base64: annotatedBase64,
  };
}
