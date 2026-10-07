import React, { useState } from 'react';
import {
  Cpu,
  Layers,
  Sliders,
  Zap,
  Activity,
  CheckCircle2,
  X,
  Shield,
  HelpCircle,
  Eye,
} from 'lucide-react';

interface YoloInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  confidenceThreshold: number;
  setConfidenceThreshold: (val: number) => void;
  iouThreshold: number;
  setIouThreshold: (val: number) => void;
  lastInferenceMs?: number;
}

export const YoloInspectorModal: React.FC<YoloInspectorModalProps> = ({
  isOpen,
  onClose,
  confidenceThreshold,
  setConfidenceThreshold,
  iouThreshold,
  setIouThreshold,
  lastInferenceMs = 28,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col border-2 border-[#1b1c1e] bg-[#f5f4ef] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#1b1c1e] bg-[#1b1c1e] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center bg-[#f5c518] text-[#1b1c1e] font-black">
              <span className="font-heading text-lg">Y8</span>
            </div>
            <div>
              <h3 className="font-heading text-xl font-bold uppercase tracking-wider text-white">
                YOLOv8 Neural Architecture &amp; Hyperparameters
              </h3>
              <p className="font-mono text-xs text-neutral-400">
                Ultralytics YOLOv8n-RDD · Single-Stage Anchor-Free Object Detector
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center border border-neutral-700 text-neutral-400 hover:border-white hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="road-marking-divider"></div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Model Specification Card */}
          <div className="border border-[#dedad0] bg-white p-5">
            <h4 className="font-heading text-base font-bold uppercase text-[#1b1c1e] mb-3">
              YOLOv8 Network Specifications
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="bg-[#f5f4ef] p-3 border border-[#dedad0]">
                <span className="text-neutral-500 block text-[10px] uppercase">Model Base</span>
                <strong className="text-[#1b1c1e] block mt-0.5">YOLOv8n-RDD</strong>
              </div>
              <div className="bg-[#f5f4ef] p-3 border border-[#dedad0]">
                <span className="text-neutral-500 block text-[10px] uppercase">Input Tensor</span>
                <strong className="text-[#1b1c1e] block mt-0.5">640 &times; 640 &times; 3</strong>
              </div>
              <div className="bg-[#f5f4ef] p-3 border border-[#dedad0]">
                <span className="text-neutral-500 block text-[10px] uppercase">Backbone</span>
                <strong className="text-[#1b1c1e] block mt-0.5">CSPDarknet C2f</strong>
              </div>
              <div className="bg-[#f5f4ef] p-3 border border-[#dedad0]">
                <span className="text-neutral-500 block text-[10px] uppercase">Pyramid Anchors</span>
                <strong className="text-[#1b1c1e] block mt-0.5">8,400 Grid Cells</strong>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#dedad0] flex items-center justify-between text-xs font-mono text-neutral-600">
              <div className="flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-[#3fa564]" />
                <span>Last Forward Pass: <strong>{lastInferenceMs} ms</strong> (~{(1000 / Math.max(1, lastInferenceMs)).toFixed(0)} FPS)</span>
              </div>
              <div className="text-[11px] text-neutral-500">
                P3 (stride 8), P4 (stride 16), P5 (stride 32)
              </div>
            </div>
          </div>

          {/* Hyperparameter Tuners */}
          <div className="border border-[#dedad0] bg-white p-5 space-y-5">
            <h4 className="font-heading text-base font-bold uppercase text-[#1b1c1e]">
              Inference Hyperparameter Controls
            </h4>

            {/* Confidence Threshold Slider */}
            <div>
              <div className="flex items-center justify-between font-mono text-xs mb-1.5">
                <span className="font-bold text-[#1b1c1e]">
                  Confidence Score Threshold (&tau;<sub>conf</sub>):
                </span>
                <span className="font-bold text-[#1b1c1e] bg-[#f5c518] px-2 py-0.5">
                  {(confidenceThreshold * 100).toFixed(0)}% ({confidenceThreshold.toFixed(2)})
                </span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.95"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                className="w-full accent-[#1b1c1e] cursor-pointer"
              />
              <p className="font-mono text-[11px] text-neutral-500 mt-1">
                Candidate boxes below this class probability threshold are eliminated prior to NMS.
              </p>
            </div>

            {/* NMS IoU Threshold Slider */}
            <div>
              <div className="flex items-center justify-between font-mono text-xs mb-1.5">
                <span className="font-bold text-[#1b1c1e]">
                  Non-Maximum Suppression IoU Threshold (&tau;<sub>IoU</sub>):
                </span>
                <span className="font-bold text-[#1b1c1e] bg-[#f5c518] px-2 py-0.5">
                  {iouThreshold.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.20"
                max="0.80"
                step="0.05"
                value={iouThreshold}
                onChange={(e) => setIouThreshold(parseFloat(e.target.value))}
                className="w-full accent-[#1b1c1e] cursor-pointer"
              />
              <p className="font-mono text-[11px] text-neutral-500 mt-1">
                Filters redundant overlapping detections. Lower values merge more boxes, higher values retain closely positioned distinct distresses.
              </p>
            </div>
          </div>

          {/* RDD2022 Class Taxonomy */}
          <div className="border border-[#dedad0] bg-white p-5">
            <h4 className="font-heading text-base font-bold uppercase text-[#1b1c1e] mb-3">
              YOLOv8 Road Damage Taxonomy
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
              <div className="border border-[#dedad0] p-2 flex items-center justify-between bg-[#f5f4ef]">
                <div>
                  <strong className="text-[#1b1c1e]">1. Pothole (D00)</strong>
                  <div className="text-[10px] text-neutral-500">Cavities and localized surface depressions</div>
                </div>
                <span className="px-2 py-0.5 bg-[#d94f45] text-white text-[10px] font-bold">High Sev</span>
              </div>

              <div className="border border-[#dedad0] p-2 flex items-center justify-between bg-[#f5f4ef]">
                <div>
                  <strong className="text-[#1b1c1e]">2. Alligator Crack (D20)</strong>
                  <div className="text-[10px] text-neutral-500">Interconnected fatigue stress web cracking</div>
                </div>
                <span className="px-2 py-0.5 bg-[#d94f45] text-white text-[10px] font-bold">High Sev</span>
              </div>

              <div className="border border-[#dedad0] p-2 flex items-center justify-between bg-[#f5f4ef]">
                <div>
                  <strong className="text-[#1b1c1e]">3. Longitudinal Crack (D01)</strong>
                  <div className="text-[10px] text-neutral-500">Linear cracks aligned with traffic direction</div>
                </div>
                <span className="px-2 py-0.5 bg-[#e0a13a] text-white text-[10px] font-bold">Med Sev</span>
              </div>

              <div className="border border-[#dedad0] p-2 flex items-center justify-between bg-[#f5f4ef]">
                <div>
                  <strong className="text-[#1b1c1e]">4. Transverse Crack (D10)</strong>
                  <div className="text-[10px] text-neutral-500">Cracks perpendicular to lane markings</div>
                </div>
                <span className="px-2 py-0.5 bg-[#3fa564] text-white text-[10px] font-bold">Low/Med</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t-2 border-[#1b1c1e] bg-[#eceae3] px-6 py-3">
          <span className="font-mono text-xs text-neutral-600">
            Compliant with YOLOv8 Anchor-Free Head &amp; ASTM D6433 Pavement Condition Index
          </span>
          <button
            onClick={onClose}
            className="border border-[#1b1c1e] bg-[#1b1c1e] px-5 py-1.5 font-heading text-sm font-bold uppercase tracking-wider text-white hover:bg-black"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};
