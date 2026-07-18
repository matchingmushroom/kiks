declare module "@remotemerge/nepali-date-converter" {
  interface ConversionResult {
    year: number;
    month: number;
    date: number;
    day: string;
  }

  class DateConverter {
    constructor(date: string);
    toAd(): ConversionResult;
    toBs(): ConversionResult;
  }

  export default DateConverter;
}
