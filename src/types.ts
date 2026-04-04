// SignalK application interfaces

export interface SignalKApp {
  debug: (...args: unknown[]) => void;
  getSelfPath: (path: string) => number | string | null | undefined;
  handleMessage: (pluginId: string, message: SignalKMessage) => void;
}

export interface PluginOptions {
  updateWeather: number;
  numberOfStations: number;
}

export interface SignalKPlugin {
  id: string;
  name: string;
  description: string;
  schema: PluginSchema;
  start: (options: PluginOptions) => void;
  stop: () => void;
  _test: TestHelpers;
}

export interface TestHelpers {
  degrees_to_radians: (degrees: number) => number;
  C_to_K: (celsius: number) => number;
  getLatestValue: (timeseries: WfsTimeseries) => TimeValue | null;
  parseObservations: (xml: string) => WeatherObservations | null;
  stations: readonly Station[];
}

export interface PluginSchema {
  type: string;
  properties: {
    updateWeather: SchemaProperty;
    numberOfStations: SchemaProperty;
  };
}

export interface SchemaProperty {
  type: string;
  default: number;
  minimum: number;
  maximum?: number;
  title: string;
}

export interface SignalKValue {
  path: string;
  value: number | string | Position | StationName;
}

export interface Position {
  latitude: number;
  longitude: number;
}

export interface StationName {
  name: string;
  shortName: string;
}

export interface SignalKUpdate {
  values: SignalKValue[];
  source: { label: string };
  timestamp: string;
}

export interface SignalKMessage {
  context: string;
  updates: SignalKUpdate[];
}

// Station tuple: [longName, shortName, fmisid, lat, lon]
export type Station = readonly [string, string, number, number, number];

// Station with distance: [longName, shortName, fmisid, lat, lon, distance]
export type StationWithDistance = [string, string, number, number, number, number];

// FMI WFS XML parsed types

export interface WfsMeasurementTVP {
  time: string;
  value: string | number;
}

export interface WfsPoint {
  MeasurementTVP: WfsMeasurementTVP;
}

export interface WfsTimeseries {
  point?: WfsPoint | WfsPoint[];
  '@_id'?: string;
}

export interface WfsMember {
  PointTimeSeriesObservation?: {
    result?: {
      MeasurementTimeseries?: WfsTimeseries;
    };
  };
}

export interface WfsFeatureCollection {
  FeatureCollection?: {
    member?: WfsMember | WfsMember[];
  };
}

export interface TimeValue {
  value: number;
  time: string;
}

export interface WeatherObservations {
  temperature?: number;
  windSpeed?: number;
  windGust?: number;
  windDir?: number;
  pressure?: number;
  time: string | null;
}
