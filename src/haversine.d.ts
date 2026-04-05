declare module 'haversine' {
  interface GeoPoint {
    latitude: number;
    longitude: number;
  }
  export default function haversine(start: GeoPoint, end: GeoPoint): number;
}
