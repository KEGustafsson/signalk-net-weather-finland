declare module 'haversine' {
  export interface GeoPoint {
    latitude: number;
    longitude: number;
  }

  export default function haversine(start: GeoPoint, end: GeoPoint): number;
}

declare module 'fast-xml-parser' {
  export interface XMLParserOptions {
    ignoreAttributes?: boolean;
    attributeNamePrefix?: string;
    removeNSPrefix?: boolean;
  }

  export class XMLParser {
    constructor(options?: XMLParserOptions);
    parse(xml: string): unknown;
  }
}
