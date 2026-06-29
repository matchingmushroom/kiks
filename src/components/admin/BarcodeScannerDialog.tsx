"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera, CameraOff } from "lucide-react";

interface BarcodeScannerDialogProps {
  onScan: (value: string) => void;
  onClose: () => void;
}

export default function BarcodeScannerDialog({ onScan, onClose }: BarcodeScannerDialogProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<any>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const element = scannerRef.current;
        if (!element) return;

        const scanner = new Html5Qrcode("barcode-scanner-container");
        html5QrCodeRef.current = scanner;
        setScanning(true);

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            formatsToSupport: [
              Html5Qrcode.getSupportedFormats().CODE_128,
              Html5Qrcode.getSupportedFormats().EAN_13,
              Html5Qrcode.getSupportedFormats().UPC_A,
              Html5Qrcode.getSupportedFormats().CODE_39,
              Html5Qrcode.getSupportedFormats().EAN_8,
              Html5Qrcode.getSupportedFormats().UPC_E,
              Html5Qrcode.getSupportedFormats().ITF,
            ],
          },
          (decodedText) => {
            if (cancelled || done) return;
            setDone(true);
            scanner.stop().catch(() => {});
            onScan(decodedText.trim());
            onClose();
          },
          () => {}
        );
      } catch (e: any) {
        if (!cancelled) {
          const msg = e?.message || String(e);
          if (msg.includes("NotAllowed") || msg.includes("Permission")) {
            setError("Camera permission denied. Please allow camera access and try again.");
          } else if (msg.includes("NotFound")) {
            setError("No camera found on this device.");
          } else if (msg.includes("NotReadable")) {
            setError("Camera is being used by another app. Close it and try again.");
          } else {
            setError("Unable to start camera: " + msg.slice(0, 80));
          }
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h2 className="text-sm font-bold text-secondary flex items-center gap-2">
            <Camera className="h-4 w-4" /> Scan Barcode
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="h-4 w-4" /></button>
        </div>

        <div className="relative bg-black">
          <div id="barcode-scanner-container" ref={scannerRef} className="w-full aspect-[4/3]" />

          {!scanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-sm bg-black/50">
              Starting camera...
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-6 text-center">
              <CameraOff className="h-8 w-8 mb-2 text-red-400" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {scanning && !error && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
              Point camera at the barcode
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
