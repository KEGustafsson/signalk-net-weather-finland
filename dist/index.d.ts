type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
interface JsonObject {
    [key: string]: JsonValue;
}
interface PluginOptions {
    updateWeather: number;
    numberOfStations: number;
}
interface SignalKValue {
    path: string;
    value: JsonValue;
}
interface SignalKUpdate {
    values: SignalKValue[];
    source: {
        label: string;
    };
    timestamp: string;
}
interface SignalKMessage {
    context: string;
    updates: SignalKUpdate[];
}
interface AppApi {
    debug: (message: unknown) => void;
    getSelfPath: (path: string) => number | null | undefined;
    handleMessage: (pluginId: string, message: SignalKMessage) => void;
}
interface LatestValue {
    value: number;
    time: string;
}
interface ObservationValues {
    temperature?: number;
    windSpeed?: number;
    windGust?: number;
    windDir?: number;
    pressure?: number;
    time: string | null;
}
type Station = [longName: string, shortName: string, fmisid: number, lat: number, lon: number];
interface MeasurementTVP {
    time: string;
    value: string | number;
}
interface Point {
    MeasurementTVP: MeasurementTVP;
}
interface Timeseries {
    '@_id'?: string;
    point?: Point | Point[];
}
declare function createPlugin(app: AppApi): {
    start: (options: PluginOptions) => void;
    stop: () => void;
    schema: {
        type: string;
        properties: {
            updateWeather: {
                type: string;
                default: number;
                minimum: number;
                title: string;
            };
            numberOfStations: {
                type: string;
                default: number;
                minimum: number;
                maximum: number;
                title: string;
            };
        };
    };
    _test: {
        degrees_to_radians: (degrees: number) => number;
        C_to_K: (data: number) => number;
        getLatestValue: (timeseries: Timeseries) => LatestValue | null;
        parseObservations: (xml: string) => ObservationValues | null;
        stations: Station[];
    };
    id: string;
    name: string;
    description: string;
};
export = createPlugin;
