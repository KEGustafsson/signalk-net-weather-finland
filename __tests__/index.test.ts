import createPlugin from '../src/index';
import type {
  SignalKApp,
  SignalKPlugin,
  SignalKMessage,
  SignalKValue,
  TestHelpers,
  WfsTimeseries,
} from '../src/types';

// Mock app object for SignalK
function createMockApp(): SignalKApp & {
  debug: jest.Mock;
  getSelfPath: jest.Mock;
  handleMessage: jest.Mock;
} {
  return {
    debug: jest.fn(),
    getSelfPath: jest.fn(),
    handleMessage: jest.fn(),
  };
}

type MockApp = ReturnType<typeof createMockApp>;

interface FmiXmlOptions {
  t2m?: string;
  ws?: string;
  wg?: string;
  wd?: string;
  pSea?: string;
  time?: string;
}

// Minimal WFS XML with all 5 parameters
function buildFmiXml({
  t2m = '4.4',
  ws = '6.3',
  wg = '7.4',
  wd = '170',
  pSea = '999.5',
  time = '2026-04-04T08:40:00Z',
}: FmiXmlOptions = {}): string {
  function memberBlock(paramName: string, value: string, timestamp: string): string {
    return `
    <wfs:member>
      <omso:PointTimeSeriesObservation gml:id="obs-1-${paramName}">
        <om:result>
          <wml2:MeasurementTimeseries gml:id="obs-obs-1-1-${paramName}">
            <wml2:point>
              <wml2:MeasurementTVP>
                <wml2:time>${timestamp}</wml2:time>
                <wml2:value>${value}</wml2:value>
              </wml2:MeasurementTVP>
            </wml2:point>
          </wml2:MeasurementTimeseries>
        </om:result>
      </omso:PointTimeSeriesObservation>
    </wfs:member>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection
    xmlns:wfs="http://www.opengis.net/wfs/2.0"
    xmlns:om="http://www.opengis.net/om/2.0"
    xmlns:omso="http://inspire.ec.europa.eu/schemas/omso/3.0"
    xmlns:gml="http://www.opengis.net/gml/3.2"
    xmlns:wml2="http://www.opengis.net/waterml/2.0">
    ${memberBlock('t2m', t2m, time)}
    ${memberBlock('ws_10min', ws, time)}
    ${memberBlock('wg_10min', wg, time)}
    ${memberBlock('wd_10min', wd, time)}
    ${memberBlock('p_sea', pSea, time)}
</wfs:FeatureCollection>`;
}

// Build XML with multiple time points per parameter
function buildMultiPointXml(paramName: string, timeValuePairs: [string, string][]): string {
  const points = timeValuePairs
    .map(
      ([time, value]) => `
            <wml2:point>
              <wml2:MeasurementTVP>
                <wml2:time>${time}</wml2:time>
                <wml2:value>${value}</wml2:value>
              </wml2:MeasurementTVP>
            </wml2:point>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection
    xmlns:wfs="http://www.opengis.net/wfs/2.0"
    xmlns:om="http://www.opengis.net/om/2.0"
    xmlns:omso="http://inspire.ec.europa.eu/schemas/omso/3.0"
    xmlns:gml="http://www.opengis.net/gml/3.2"
    xmlns:wml2="http://www.opengis.net/waterml/2.0">
    <wfs:member>
      <omso:PointTimeSeriesObservation gml:id="obs-1-${paramName}">
        <om:result>
          <wml2:MeasurementTimeseries gml:id="obs-obs-1-1-${paramName}">
            ${points}
          </wml2:MeasurementTimeseries>
        </om:result>
      </omso:PointTimeSeriesObservation>
    </wfs:member>
</wfs:FeatureCollection>`;
}

describe('signalk-net-weather-finland', () => {
  let app: MockApp;
  let plugin: SignalKPlugin;
  let helpers: TestHelpers;

  beforeEach(() => {
    app = createMockApp();
    plugin = createPlugin(app);
    helpers = plugin._test;
  });

  // ─── Plugin metadata ───

  describe('plugin metadata', () => {
    test('has correct id', () => {
      expect(plugin.id).toBe('signalk-net-weather-finland');
    });

    test('has correct name', () => {
      expect(plugin.name).toBe('Signal K Net Weather Finland');
    });

    test('has description', () => {
      expect(plugin.description).toBeTruthy();
    });

    test('exports start and stop functions', () => {
      expect(typeof plugin.start).toBe('function');
      expect(typeof plugin.stop).toBe('function');
    });
  });

  // ─── Schema ───

  describe('schema', () => {
    test('defines updateWeather with correct defaults', () => {
      const prop = plugin.schema.properties.updateWeather;
      expect(prop.type).toBe('integer');
      expect(prop.default).toBe(10);
      expect(prop.minimum).toBe(10);
    });

    test('defines numberOfStations with correct defaults', () => {
      const prop = plugin.schema.properties.numberOfStations;
      expect(prop.type).toBe('integer');
      expect(prop.default).toBe(3);
      expect(prop.minimum).toBe(1);
      expect(prop.maximum).toBe(51);
    });
  });

  // ─── Unit conversion functions ───

  describe('degrees_to_radians', () => {
    test('converts 0 degrees to 0 radians', () => {
      expect(helpers.degrees_to_radians(0)).toBe(0);
    });

    test('converts 180 degrees to PI radians', () => {
      expect(helpers.degrees_to_radians(180)).toBeCloseTo(Math.PI);
    });

    test('converts 360 degrees to 2*PI radians', () => {
      expect(helpers.degrees_to_radians(360)).toBeCloseTo(2 * Math.PI);
    });

    test('converts 90 degrees to PI/2 radians', () => {
      expect(helpers.degrees_to_radians(90)).toBeCloseTo(Math.PI / 2);
    });

    test('handles negative degrees', () => {
      expect(helpers.degrees_to_radians(-90)).toBeCloseTo(-Math.PI / 2);
    });
  });

  describe('C_to_K', () => {
    test('converts 0°C to 273.15K', () => {
      expect(helpers.C_to_K(0)).toBe(273.15);
    });

    test('converts 100°C to 373.15K', () => {
      expect(helpers.C_to_K(100)).toBe(373.15);
    });

    test('converts -40°C to 233.15K', () => {
      expect(helpers.C_to_K(-40)).toBeCloseTo(233.15);
    });

    test('converts negative temperatures', () => {
      expect(helpers.C_to_K(-273.15)).toBeCloseTo(0);
    });
  });

  // ─── Stations ───

  describe('stations', () => {
    test('has 51 stations', () => {
      expect(helpers.stations).toHaveLength(51);
    });

    test('each station has [longName, shortName, fmisid, lat, lon]', () => {
      helpers.stations.forEach((station) => {
        expect(station).toHaveLength(5);
        expect(typeof station[0]).toBe('string');  // longName
        expect(typeof station[1]).toBe('string');  // shortName
        expect(typeof station[2]).toBe('number');  // fmisid
        expect(typeof station[3]).toBe('number');  // lat
        expect(typeof station[4]).toBe('number');  // lon
        // Sanity: Finnish latitudes between 59 and 70
        expect(station[3]).toBeGreaterThanOrEqual(59);
        expect(station[3]).toBeLessThanOrEqual(70);
        // Longitudes between 19 and 30
        expect(station[4]).toBeGreaterThanOrEqual(19);
        expect(station[4]).toBeLessThanOrEqual(30);
      });
    });

    test('all fmisid values are unique', () => {
      const ids = helpers.stations.map((s) => s[2]);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ─── getLatestValue ───

  describe('getLatestValue', () => {
    test('returns last valid value from array of points', () => {
      const timeseries: WfsTimeseries = {
        point: [
          { MeasurementTVP: { time: '2026-04-04T08:20:00Z', value: '3.5' } },
          { MeasurementTVP: { time: '2026-04-04T08:30:00Z', value: '4.0' } },
          { MeasurementTVP: { time: '2026-04-04T08:40:00Z', value: '4.4' } },
        ],
      };
      const result = helpers.getLatestValue(timeseries);
      expect(result).toEqual({ value: 4.4, time: '2026-04-04T08:40:00Z' });
    });

    test('skips NaN values and returns last valid', () => {
      const timeseries: WfsTimeseries = {
        point: [
          { MeasurementTVP: { time: '2026-04-04T08:20:00Z', value: '3.5' } },
          { MeasurementTVP: { time: '2026-04-04T08:30:00Z', value: '4.0' } },
          { MeasurementTVP: { time: '2026-04-04T08:40:00Z', value: 'NaN' } },
        ],
      };
      const result = helpers.getLatestValue(timeseries);
      expect(result).toEqual({ value: 4.0, time: '2026-04-04T08:30:00Z' });
    });

    test('returns null when all values are NaN', () => {
      const timeseries: WfsTimeseries = {
        point: [
          { MeasurementTVP: { time: '2026-04-04T08:20:00Z', value: 'NaN' } },
          { MeasurementTVP: { time: '2026-04-04T08:30:00Z', value: 'NaN' } },
        ],
      };
      expect(helpers.getLatestValue(timeseries)).toBeNull();
    });

    test('returns null when no points', () => {
      expect(helpers.getLatestValue({} as WfsTimeseries)).toBeNull();
    });

    test('handles single point (not array)', () => {
      const timeseries: WfsTimeseries = {
        point: { MeasurementTVP: { time: '2026-04-04T08:40:00Z', value: '5.5' } },
      };
      const result = helpers.getLatestValue(timeseries);
      expect(result).toEqual({ value: 5.5, time: '2026-04-04T08:40:00Z' });
    });

    test('handles numeric values (not strings)', () => {
      const timeseries: WfsTimeseries = {
        point: [{ MeasurementTVP: { time: '2026-04-04T08:40:00Z', value: 7.2 } }],
      };
      const result = helpers.getLatestValue(timeseries);
      expect(result).toEqual({ value: 7.2, time: '2026-04-04T08:40:00Z' });
    });
  });

  // ─── parseObservations ───

  describe('parseObservations', () => {
    test('parses complete FMI XML with all parameters', () => {
      const xml = buildFmiXml();
      const obs = helpers.parseObservations(xml);

      expect(obs?.temperature).toBe(4.4);
      expect(obs?.windSpeed).toBe(6.3);
      expect(obs?.windGust).toBe(7.4);
      expect(obs?.windDir).toBe(170);
      expect(obs?.pressure).toBe(999.5);
      expect(obs?.time).toBe('2026-04-04T08:40:00Z');
    });

    test('parses XML with custom values', () => {
      const xml = buildFmiXml({
        t2m: '-5.2',
        ws: '12.0',
        wg: '18.5',
        wd: '270',
        pSea: '1013.25',
      });
      const obs = helpers.parseObservations(xml);

      expect(obs?.temperature).toBe(-5.2);
      expect(obs?.windSpeed).toBe(12.0);
      expect(obs?.windGust).toBe(18.5);
      expect(obs?.windDir).toBe(270);
      expect(obs?.pressure).toBe(1013.25);
    });

    test('handles NaN values by excluding them', () => {
      const xml = buildFmiXml({ t2m: 'NaN', pSea: 'NaN' });
      const obs = helpers.parseObservations(xml);

      expect(obs?.temperature).toBeUndefined();
      expect(obs?.pressure).toBeUndefined();
      expect(obs?.windSpeed).toBe(6.3);
      expect(obs?.windGust).toBe(7.4);
      expect(obs?.windDir).toBe(170);
    });

    test('handles all NaN values', () => {
      const xml = buildFmiXml({
        t2m: 'NaN',
        ws: 'NaN',
        wg: 'NaN',
        wd: 'NaN',
        pSea: 'NaN',
      });
      const obs = helpers.parseObservations(xml);

      expect(obs?.temperature).toBeUndefined();
      expect(obs?.windSpeed).toBeUndefined();
      expect(obs?.windGust).toBeUndefined();
      expect(obs?.windDir).toBeUndefined();
      expect(obs?.pressure).toBeUndefined();
      expect(obs?.time).toBeNull();
    });

    test('returns null for empty/invalid XML', () => {
      expect(helpers.parseObservations('<empty/>')).toBeNull();
    });

    test('returns null for XML without members', () => {
      const xml = `<?xml version="1.0"?>
        <wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0">
        </wfs:FeatureCollection>`;
      expect(helpers.parseObservations(xml)).toBeNull();
    });

    test('extracts latest value from multi-point timeseries', () => {
      const xml = buildMultiPointXml('t2m', [
        ['2026-04-04T08:00:00Z', '3.0'],
        ['2026-04-04T08:10:00Z', '3.5'],
        ['2026-04-04T08:20:00Z', '4.0'],
        ['2026-04-04T08:30:00Z', '4.2'],
        ['2026-04-04T08:40:00Z', '4.4'],
      ]);
      const obs = helpers.parseObservations(xml);
      expect(obs?.temperature).toBe(4.4);
      expect(obs?.time).toBe('2026-04-04T08:40:00Z');
    });

    test('skips trailing NaN in multi-point series', () => {
      const xml = buildMultiPointXml('t2m', [
        ['2026-04-04T08:00:00Z', '3.0'],
        ['2026-04-04T08:10:00Z', '3.5'],
        ['2026-04-04T08:20:00Z', 'NaN'],
        ['2026-04-04T08:30:00Z', 'NaN'],
      ]);
      const obs = helpers.parseObservations(xml);
      expect(obs?.temperature).toBe(3.5);
      expect(obs?.time).toBe('2026-04-04T08:10:00Z');
    });

    test('handles zero values correctly (not treated as NaN)', () => {
      const xml = buildFmiXml({ t2m: '0', ws: '0', wd: '0' });
      const obs = helpers.parseObservations(xml);
      expect(obs?.temperature).toBe(0);
      expect(obs?.windSpeed).toBe(0);
      expect(obs?.windDir).toBe(0);
    });

    test('handles negative temperature values', () => {
      const xml = buildFmiXml({ t2m: '-15.3' });
      const obs = helpers.parseObservations(xml);
      expect(obs?.temperature).toBe(-15.3);
    });
  });

  // ─── Plugin lifecycle ───

  describe('plugin lifecycle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      plugin.stop();
      jest.useRealTimers();
    });

    test('start sets up interval and calls readMeteo', () => {
      app.getSelfPath.mockReturnValue(null);
      plugin.start({ updateWeather: 10, numberOfStations: 3 });
      expect(app.debug).toHaveBeenCalledWith(
        "No own position, cannot fetch nearest stations' data"
      );
    });

    test('stop clears interval', () => {
      app.getSelfPath.mockReturnValue(null);
      plugin.start({ updateWeather: 10, numberOfStations: 3 });
      plugin.stop();
      expect(app.debug).toHaveBeenCalledWith(
        'Signal K Net Weather Finland stopped'
      );
    });

    test('readMeteo logs when no position available', () => {
      app.getSelfPath.mockReturnValue(null);
      plugin.start({ updateWeather: 10, numberOfStations: 3 });
      expect(app.debug).toHaveBeenCalledWith(
        "No own position, cannot fetch nearest stations' data"
      );
    });
  });

  // ─── Integration: readMeteo with mocked fetch ───

  describe('readMeteo integration', () => {
    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    function setupPosition(): void {
      app.getSelfPath.mockImplementation((path: string) => {
        if (path === 'navigation.position.value.longitude') return 24.98;
        if (path === 'navigation.position.value.latitude') return 60.11;
        return null;
      });
    }

    function flushPromises(): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, 50));
    }

    function mockFetchSuccess(xml: string): void {
      fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(xml),
      });
      global.fetch = fetchMock;
    }

    function getFetchUrl(callIndex: number): string {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return String(fetchMock.mock.calls[callIndex]?.[0]);
    }

    function getHandledMessage(): SignalKMessage {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return app.handleMessage.mock.calls[0]?.[1] as SignalKMessage;
    }

    afterEach(() => {
      plugin.stop();
      global.fetch = originalFetch;
    });

    test('fetches data for nearest stations and sends SignalK message', async () => {
      setupPosition();

      const xml = buildFmiXml({
        t2m: '5.0',
        ws: '8.0',
        wg: '12.0',
        wd: '200',
        pSea: '1010.0',
        time: '2026-04-04T10:00:00Z',
      });

      mockFetchSuccess(xml);

      plugin.start({ updateWeather: 10, numberOfStations: 1 });
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const fetchUrl = getFetchUrl(0);
      expect(fetchUrl).toContain('opendata.fmi.fi/wfs');
      expect(fetchUrl).toContain('storedquery_id=fmi::observations::weather::timevaluepair');
      expect(fetchUrl).toContain('fmisid=');
      expect(fetchUrl).toContain('parameters=t2m,ws_10min,wg_10min,wd_10min,p_sea');

      expect(app.handleMessage).toHaveBeenCalledTimes(1);
      const msg = getHandledMessage();
      expect(msg.context).toMatch(/^meteo\.urn:mrn:imo:mmsi:\d{9}$/);

      const values = msg.updates[0]!.values;
      const findValue = (path: string): SignalKValue | undefined =>
        values.find((v) => v.path === path);

      expect(findValue('environment.outside.temperature')?.value).toBeCloseTo(278.15);
      expect(findValue('environment.wind.averageSpeed')?.value).toBe(8.0);
      expect(findValue('environment.wind.gust')?.value).toBe(12.0);
      expect(findValue('environment.wind.directionTrue')?.value).toBeCloseTo(
        200 * (Math.PI / 180)
      );
      expect(findValue('environment.outside.pressure')?.value).toBe(101000);
      expect(findValue('environment.date')?.value).toBe('2026-04-04T10:00:00Z');
      expect(findValue('navigation.position')?.value).toHaveProperty('latitude');
      expect(findValue('navigation.position')?.value).toHaveProperty('longitude');
      expect(findValue('environment.station.fmisid')?.value).toEqual(expect.any(Number));
    });

    test('sends correct SignalK message structure', async () => {
      setupPosition();
      mockFetchSuccess(buildFmiXml());

      plugin.start({ updateWeather: 10, numberOfStations: 1 });
      await flushPromises();

      const msg = getHandledMessage();
      expect(msg.updates).toHaveLength(1);
      expect(msg.updates[0]!.source).toEqual({ label: 'signalk-net-weather-finland' });
      expect(msg.updates[0]!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      const nameValue = msg.updates[0]!.values.find((v) => v.path === '');
      expect(nameValue?.value).toHaveProperty('name');
      expect(nameValue?.value).toHaveProperty('shortName');
    });

    test('handles HTTP errors gracefully', async () => {
      setupPosition();

      fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });
      global.fetch = fetchMock;

      plugin.start({ updateWeather: 10, numberOfStations: 1 });
      await flushPromises();

      expect(app.handleMessage).not.toHaveBeenCalled();
      expect(app.debug).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch weather data')
      );
    });

    test('handles network errors gracefully', async () => {
      setupPosition();

      fetchMock = jest.fn().mockRejectedValue(new Error('Network timeout'));
      global.fetch = fetchMock;

      plugin.start({ updateWeather: 10, numberOfStations: 1 });
      await flushPromises();

      expect(app.handleMessage).not.toHaveBeenCalled();
      expect(app.debug).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch weather data')
      );
    });

    test('handles invalid XML response gracefully', async () => {
      setupPosition();
      mockFetchSuccess('<invalid>not a wfs response</invalid>');

      plugin.start({ updateWeather: 10, numberOfStations: 1 });
      await flushPromises();

      expect(app.handleMessage).not.toHaveBeenCalled();
    });

    test('fetches correct number of stations', async () => {
      setupPosition();
      mockFetchSuccess(buildFmiXml());

      plugin.start({ updateWeather: 10, numberOfStations: 5 });
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    test('skips parameters with NaN in SignalK message', async () => {
      setupPosition();
      mockFetchSuccess(buildFmiXml({ t2m: 'NaN', pSea: 'NaN' }));

      plugin.start({ updateWeather: 10, numberOfStations: 1 });
      await flushPromises();

      expect(app.handleMessage).toHaveBeenCalledTimes(1);
      const msg = getHandledMessage();
      const paths = msg.updates[0]!.values.map((v) => v.path);

      expect(paths).not.toContain('environment.outside.temperature');
      expect(paths).not.toContain('environment.outside.pressure');
      expect(paths).toContain('environment.wind.averageSpeed');
      expect(paths).toContain('environment.wind.gust');
      expect(paths).toContain('environment.wind.directionTrue');
    });

    test('selects nearest station based on vessel position', async () => {
      // Position very close to Hanko Russarö (59.77, 22.95)
      app.getSelfPath.mockImplementation((path: string) => {
        if (path === 'navigation.position.value.longitude') return 22.95;
        if (path === 'navigation.position.value.latitude') return 59.77;
        return null;
      });

      mockFetchSuccess(buildFmiXml());

      plugin.start({ updateWeather: 10, numberOfStations: 1 });
      await flushPromises();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const fetchUrl = getFetchUrl(0);
      // Hanko Russarö fmisid is 100932
      expect(fetchUrl).toContain('fmisid=100932');
    });

    test('MMSI is 9 digits padded from fmisid', async () => {
      setupPosition();
      mockFetchSuccess(buildFmiXml());

      plugin.start({ updateWeather: 10, numberOfStations: 1 });
      await flushPromises();

      const msg = getHandledMessage();
      const mmsiMatch = msg.context.match(/mmsi:(\d+)$/);
      expect(mmsiMatch).not.toBeNull();
      expect(mmsiMatch![1]).toHaveLength(9);
    });
  });
});
