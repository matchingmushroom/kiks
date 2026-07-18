declare module "@remotemerge/nepali-date-converter" {
  interface DateResult {
    year: number;
    month: number;
    date: number;
    day: string;
  }
  export default class DateConverter {
    constructor(dateStr: string);
    toBs(): DateResult;
    toAd(): DateResult;
  }
}

declare module "jsbarcode" {
  function JsBarcode(
    element: Element | string,
    value: string,
    options?: Record<string, unknown>
  ): void;
  export default JsBarcode;
}

declare module "html5-qrcode" {
  interface Html5QrcodeConfig {
    verbose: boolean;
    formatsToSupport: number[];
  }
  export class Html5Qrcode {
    constructor(elementId: string, config?: Html5QrcodeConfig);
    start(
      cameraIdOrConfig: { facingMode: string } | string,
      qrConfig: { fps: number; qrbox: { width: number; height: number } },
      onSuccess: (decodedText: string, decodedResult: any) => void,
      onError?: (errorMessage: string) => void
    ): Promise<void>;
    stop(): Promise<void>;
    clear(): void;
  }
  export enum Html5QrcodeSupportedFormats {
    QR_CODE = 0,
    CODE_128 = 1,
    EAN_13 = 2,
    UPC_A = 3,
    CODE_39 = 4,
    EAN_8 = 5,
    UPC_E = 6,
    ITF = 7,
  }
}
