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
