export type SeverityLevel = 'Low' | 'Medium' | 'High';

export type DamageType =
  | 'pothole'
  | 'alligator crack'
  | 'longitudinal crack'
  | 'transverse crack'
  | string;

export interface DetectionBox {
  damage_type: DamageType;
  confidence: number;
  severity: SeverityLevel;
  severity_score: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DetectionApiResponse {
  detections: DetectionBox[];
  annotated_image_base64?: string;
  annotated_image_url?: string;
}

export interface DetectionRecord {
  id?: string | number;
  source_file: string;
  damage_type: string;
  confidence: number;
  severity: SeverityLevel;
  severity_score: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  img_width: number;
  img_height: number;
  location: string;
  created_at: string;
}

export interface DashboardStats {
  totalDetections: number;
  averageConfidence: number;
  highSeverityPercent: number;
  severityCounts: {
    Low: number;
    Medium: number;
    High: number;
  };
  damageTypeCounts: Record<string, number>;
  locationCounts: Record<string, number>;
  locationSeverityBreakdown: Record<string, { Low: number; Medium: number; High: number }>;
}
