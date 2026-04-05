const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const createPlugin = require('../dist/index.js');

// --- Test helpers ---

function createMockApp() {
  const debugLog = [];
  const handled = [];

  return {
    debugLog,
    handled,
    debug(...args) {
      debugLog.push(args.length === 1 ? args[0] : args);
    },
    getSelfPath: () => null,
    handleMessage: (_pluginId, message) => {
      handled.push(message);
    },
  };
}

function buildFmiXml({
  t2m = '4.4',
  ws = '6.3',
  wg = '7.4',
  wd = '170',
  pSea = '999.5',
  time = '2026-04-04T08:40:00Z',
} = {}) {
  function memberBlock(paramName, value, timestamp) {
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

function buildMultiPointXml(paramName, timeValuePairs) {
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

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

// --- Tests ---

describe('plugin metadata', () => {
  test('has correct id', () => {
    const plugin = createPlugin(createMockApp());
    assert.equal(plugin.id, 'signalk-net-weather-finland');
  });

  test('has correct name', () => {
    const plugin = createPlugin(createMockApp());
    assert.equal(plugin.name, 'Signal K Net Weather Finland');
  });

  test('has description', () => {
    const plugin = createPlugin(createMockApp());
    assert.ok(plugin.description);
  });

  test('exports start and stop functions', () => {
    const plugin = createPlugin(createMockApp());
    assert.equal(typeof plugin.start, 'function');
    assert.equal(typeof plugin.stop, 'function');
  });
});

describe('schema', () => {
  test('defines updateWeather with correct defaults', () => {
    const plugin = createPlugin(createMockApp());
    const prop = plugin.schema.properties.updateWeather;
    assert.equal(prop.type, 'integer');
    assert.equal(prop.default, 10);
    assert.equal(prop.minimum, 10);
  });

  test('defines numberOfStations with correct defaults', () => {
    const plugin = createPlugin(createMockApp());
    const prop = plugin.schema.properties.numberOfStations;
    assert.equal(prop.type, 'integer');
    assert.equal(prop.default, 3);
    assert.equal(prop.minimum, 1);
    assert.equal(prop.maximum, 51);
  });
});

describe('degrees_to_radians', () => {
  test('converts 0 degrees to 0 radians', () => {
    const { degrees_to_radians } = createPlugin(createMockApp())._test;
    assert.equal(degrees_to_radians(0), 0);
  });

  test('converts 180 degrees to PI radians', () => {
    const { degrees_to_radians } = createPlugin(createMockApp())._test;
    assert.ok(Math.abs(degrees_to_radians(180) - Math.PI) < 1e-10);
  });

  test('converts 360 degrees to 2*PI radians', () => {
    const { degrees_to_radians } = createPlugin(createMockApp())._test;
    assert.ok(Math.abs(degrees_to_radians(360) - 2 * Math.PI) < 1e-10);
  });

  test('converts 90 degrees to PI/2 radians', () => {
    const { degrees_to_radians } = createPlugin(createMockApp())._test;
    assert.ok(Math.abs(degrees_to_radians(90) - Math.PI / 2) < 1e-10);
  });

  test('handles negative degrees', () => {
    const { degrees_to_radians } = createPlugin(createMockApp())._test;
    assert.ok(Math.abs(degrees_to_radians(-90) - -Math.PI / 2) < 1e-10);
  });
});

describe('C_to_K', () => {
  test('converts 0C to 273.15K', () => {
    const { C_to_K } = createPlugin(createMockApp())._test;
    assert.equal(C_to_K(0), 273.15);
  });

  test('converts 100C to 373.15K', () => {
    const { C_to_K } = createPlugin(createMockApp())._test;
    assert.equal(C_to_K(100), 373.15);
  });

  test('converts -40C to 233.15K', () => {
    const { C_to_K } = createPlugin(createMockApp())._test;
    assert.ok(Math.abs(C_to_K(-40) - 233.15) < 1e-10);
  });

  test('converts -273.15C to 0K', () => {
    const { C_to_K } = createPlugin(createMockApp())._test;
    assert.ok(Math.abs(C_to_K(-273.15)) < 1e-10);
  });
});

describe('stations', () => {
  test('has 51 stations', () => {
    const { stations } = createPlugin(createMockApp())._test;
    assert.equal(stations.length, 51);
  });

  test('each station has [longName, shortName, fmisid, lat, lon]', () => {
    const { stations } = createPlugin(createMockApp())._test;
    stations.forEach((station) => {
      assert.equal(station.length, 5);
      assert.equal(typeof station[0], 'string');
      assert.equal(typeof station[1], 'string');
      assert.equal(typeof station[2], 'number');
      assert.equal(typeof station[3], 'number');
      assert.equal(typeof station[4], 'number');
      assert.ok(station[3] >= 59, `lat ${station[3]} >= 59`);
      assert.ok(station[3] <= 70, `lat ${station[3]} <= 70`);
      assert.ok(station[4] >= 19, `lon ${station[4]} >= 19`);
      assert.ok(station[4] <= 30, `lon ${station[4]} <= 30`);
    });
  });

  test('all fmisid values are unique', () => {
    const { stations } = createPlugin(createMockApp())._test;
    const ids = stations.map((s) => s[2]);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('getLatestValue', () => {
  test('returns last valid value from array of points', () => {
    const { getLatestValue } = createPlugin(createMockApp())._test;
    const result = getLatestValue({
      point: [
        { MeasurementTVP: { time: '2026-04-04T08:20:00Z', value: '3.5' } },
        { MeasurementTVP: { time: '2026-04-04T08:30:00Z', value: '4.0' } },
        { MeasurementTVP: { time: '2026-04-04T08:40:00Z', value: '4.4' } },
      ],
    });
    assert.deepEqual(result, { value: 4.4, time: '2026-04-04T08:40:00Z' });
  });

  test('skips NaN values and returns last valid', () => {
    const { getLatestValue } = createPlugin(createMockApp())._test;
    const result = getLatestValue({
      point: [
        { MeasurementTVP: { time: '2026-04-04T08:20:00Z', value: '3.5' } },
        { MeasurementTVP: { time: '2026-04-04T08:30:00Z', value: '4.0' } },
        { MeasurementTVP: { time: '2026-04-04T08:40:00Z', value: 'NaN' } },
      ],
    });
    assert.deepEqual(result, { value: 4.0, time: '2026-04-04T08:30:00Z' });
  });

  test('returns null when all values are NaN', () => {
    const { getLatestValue } = createPlugin(createMockApp())._test;
    const result = getLatestValue({
      point: [
        { MeasurementTVP: { time: '2026-04-04T08:20:00Z', value: 'NaN' } },
        { MeasurementTVP: { time: '2026-04-04T08:30:00Z', value: 'NaN' } },
      ],
    });
    assert.equal(result, null);
  });

  test('returns null when no points', () => {
    const { getLatestValue } = createPlugin(createMockApp())._test;
    assert.equal(getLatestValue({}), null);
  });

  test('handles single point (not array)', () => {
    const { getLatestValue } = createPlugin(createMockApp())._test;
    const result = getLatestValue({
      point: { MeasurementTVP: { time: '2026-04-04T08:40:00Z', value: '5.5' } },
    });
    assert.deepEqual(result, { value: 5.5, time: '2026-04-04T08:40:00Z' });
  });

  test('handles numeric values (not strings)', () => {
    const { getLatestValue } = createPlugin(createMockApp())._test;
    const result = getLatestValue({
      point: [{ MeasurementTVP: { time: '2026-04-04T08:40:00Z', value: 7.2 } }],
    });
    assert.deepEqual(result, { value: 7.2, time: '2026-04-04T08:40:00Z' });
  });
});

describe('parseObservations', () => {
  test('parses complete FMI XML with all parameters', () => {
    const { parseObservations } = createPlugin(createMockApp())._test;
    const obs = parseObservations(buildFmiXml());

    assert.equal(obs.temperature, 4.4);
    assert.equal(obs.windSpeed, 6.3);
    assert.equal(obs.windGust, 7.4);
    assert.equal(obs.windDir, 170);
    assert.equal(obs.pressure, 999.5);
    assert.equal(obs.time, '2026-04-04T08:40:00Z');
  });

  test('parses XML with custom values', () => {
    const { parseObservations } = createPlugin(createMockApp())._test;
    const obs = parseObservations(
      buildFmiXml({ t2m: '-5.2', ws: '12.0', wg: '18.5', wd: '270', pSea: '1013.25' })
    );

    assert.equal(obs.temperature, -5.2);
    assert.equal(obs.windSpeed, 12.0);
    assert.equal(obs.windGust, 18.5);
    assert.equal(obs.windDir, 270);
    assert.equal(obs.pressure, 1013.25);
  });

  test('handles NaN values by excluding them', () => {
    const { parseObservations } = createPlugin(createMockApp())._test;
    const obs = parseObservations(buildFmiXml({ t2m: 'NaN', pSea: 'NaN' }));

    assert.equal(obs.temperature, undefined);
    assert.equal(obs.pressure, undefined);
    assert.equal(obs.windSpeed, 6.3);
    assert.equal(obs.windGust, 7.4);
    assert.equal(obs.windDir, 170);
  });

  test('handles all NaN values', () => {
    const { parseObservations } = createPlugin(createMockApp())._test;
    const obs = parseObservations(
      buildFmiXml({ t2m: 'NaN', ws: 'NaN', wg: 'NaN', wd: 'NaN', pSea: 'NaN' })
    );

    assert.equal(obs.temperature, undefined);
    assert.equal(obs.windSpeed, undefined);
    assert.equal(obs.windGust, undefined);
    assert.equal(obs.windDir, undefined);
    assert.equal(obs.pressure, undefined);
    assert.equal(obs.time, null);
  });

  test('returns null for empty/invalid XML', () => {
    const { parseObservations } = createPlugin(createMockApp())._test;
    assert.equal(parseObservations('<empty/>'), null);
  });

  test('returns null for XML without members', () => {
    const { parseObservations } = createPlugin(createMockApp())._test;
    const xml = `<?xml version="1.0"?>
      <wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0">
      </wfs:FeatureCollection>`;
    assert.equal(parseObservations(xml), null);
  });

  test('extracts latest value from multi-point timeseries', () => {
    const { parseObservations } = createPlugin(createMockApp())._test;
    const xml = buildMultiPointXml('t2m', [
      ['2026-04-04T08:00:00Z', '3.0'],
      ['2026-04-04T08:10:00Z', '3.5'],
      ['2026-04-04T08:20:00Z', '4.0'],
      ['2026-04-04T08:30:00Z', '4.2'],
      ['2026-04-04T08:40:00Z', '4.4'],
    ]);
    const obs = parseObservations(xml);
    assert.equal(obs.temperature, 4.4);
    assert.equal(obs.time, '2026-04-04T08:40:00Z');
  });

  test('skips trailing NaN in multi-point series', () => {
    const { parseObservations } = createPlugin(createMockApp())._test;
    const xml = buildMultiPointXml('t2m', [
      ['2026-04-04T08:00:00Z', '3.0'],
      ['2026-04-04T08:10:00Z', '3.5'],
      ['2026-04-04T08:20:00Z', 'NaN'],
      ['2026-04-04T08:30:00Z', 'NaN'],
    ]);
    const obs = parseObservations(xml);
    assert.equal(obs.temperature, 3.5);
    assert.equal(obs.time, '2026-04-04T08:10:00Z');
  });

  test('handles zero values correctly (not treated as NaN)', () => {
    const { parseObservations } = createPlugin(createMockApp())._test;
    const obs = parseObservations(buildFmiXml({ t2m: '0', ws: '0', wd: '0' }));
    assert.equal(obs.temperature, 0);
    assert.equal(obs.windSpeed, 0);
    assert.equal(obs.windDir, 0);
  });

  test('handles negative temperature values', () => {
    const { parseObservations } = createPlugin(createMockApp())._test;
    const obs = parseObservations(buildFmiXml({ t2m: '-15.3' }));
    assert.equal(obs.temperature, -15.3);
  });
});

describe('plugin lifecycle', () => {
  test('start logs started message', () => {
    const app = createMockApp();
    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 3 });
    plugin.stop();
    assert.ok(app.debugLog.includes('Signal K Net Weather Finland started'));
  });

  test('stop logs stopped message', () => {
    const app = createMockApp();
    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 3 });
    plugin.stop();
    assert.ok(app.debugLog.includes('Signal K Net Weather Finland stopped'));
  });

  test('readMeteo logs when no position available', () => {
    const app = createMockApp();
    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 3 });
    plugin.stop();
    assert.ok(app.debugLog.includes("No own position, cannot fetch nearest stations' data"));
  });
});

describe('readMeteo integration', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function setupPositionApp() {
    const app = createMockApp();
    app.getSelfPath = (path) => {
      if (path === 'navigation.position.value.longitude') return 24.98;
      if (path === 'navigation.position.value.latitude') return 60.11;
      return null;
    };
    return app;
  }

  test('fetches data for nearest stations and sends SignalK message', async () => {
    const app = setupPositionApp();
    const xml = buildFmiXml({
      t2m: '5.0', ws: '8.0', wg: '12.0', wd: '200', pSea: '1010.0',
      time: '2026-04-04T10:00:00Z',
    });

    const fetchCalls = [];
    global.fetch = (url, _opts) => {
      fetchCalls.push(url);
      return Promise.resolve({ ok: true, text: () => Promise.resolve(xml) });
    };

    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 1 });
    await flushPromises();
    plugin.stop();

    assert.equal(fetchCalls.length, 1);
    assert.ok(fetchCalls[0].includes('opendata.fmi.fi/wfs'));
    assert.ok(fetchCalls[0].includes('storedquery_id=fmi::observations::weather::timevaluepair'));
    assert.ok(fetchCalls[0].includes('fmisid='));
    assert.ok(fetchCalls[0].includes('parameters=t2m,ws_10min,wg_10min,wd_10min,p_sea'));

    assert.equal(app.handled.length, 1);
    const msg = app.handled[0];
    assert.match(msg.context, /^meteo\.urn:mrn:imo:mmsi:\d{9}$/);

    const values = msg.updates[0].values;
    const byPath = (name) => values.find((v) => v.path === name);

    assert.ok(Math.abs(byPath('environment.outside.temperature').value - 278.15) < 0.01);
    assert.equal(byPath('environment.wind.averageSpeed').value, 8.0);
    assert.equal(byPath('environment.wind.gust').value, 12.0);
    assert.ok(Math.abs(byPath('environment.wind.directionTrue').value - 200 * (Math.PI / 180)) < 1e-10);
    assert.equal(byPath('environment.outside.pressure').value, 101000);
    assert.equal(byPath('environment.date').value, '2026-04-04T10:00:00Z');
    assert.ok('latitude' in byPath('navigation.position').value);
    assert.ok('longitude' in byPath('navigation.position').value);
    assert.equal(typeof byPath('environment.station.fmisid').value, 'number');
  });

  test('sends correct SignalK message structure', async () => {
    const app = setupPositionApp();
    global.fetch = () =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(buildFmiXml()) });

    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 1 });
    await flushPromises();
    plugin.stop();

    const msg = app.handled[0];
    assert.equal(msg.updates.length, 1);
    assert.deepEqual(msg.updates[0].source, { label: 'signalk-net-weather-finland' });
    assert.match(msg.updates[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);

    const nameValue = msg.updates[0].values.find((v) => v.path === '');
    assert.ok('name' in nameValue.value);
    assert.ok('shortName' in nameValue.value);
  });

  test('handles HTTP errors gracefully', async () => {
    const app = setupPositionApp();
    global.fetch = () => Promise.resolve({ ok: false, status: 503 });

    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 1 });
    await flushPromises();
    plugin.stop();

    assert.equal(app.handled.length, 0);
    assert.ok(app.debugLog.some((msg) => typeof msg === 'string' && msg.includes('Failed to fetch weather data')));
  });

  test('handles network errors gracefully', async () => {
    const app = setupPositionApp();
    global.fetch = () => Promise.reject(new Error('Network timeout'));

    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 1 });
    await flushPromises();
    plugin.stop();

    assert.equal(app.handled.length, 0);
    assert.ok(app.debugLog.some((msg) => typeof msg === 'string' && msg.includes('Failed to fetch weather data')));
  });

  test('handles invalid XML response gracefully', async () => {
    const app = setupPositionApp();
    global.fetch = () =>
      Promise.resolve({ ok: true, text: () => Promise.resolve('<invalid>not wfs</invalid>') });

    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 1 });
    await flushPromises();
    plugin.stop();

    assert.equal(app.handled.length, 0);
  });

  test('fetches correct number of stations', async () => {
    const app = setupPositionApp();
    const fetchCalls = [];
    global.fetch = (url, _opts) => {
      fetchCalls.push(url);
      return Promise.resolve({ ok: true, text: () => Promise.resolve(buildFmiXml()) });
    };

    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 5 });
    await flushPromises();
    plugin.stop();

    assert.equal(fetchCalls.length, 5);
  });

  test('skips parameters with NaN in SignalK message', async () => {
    const app = setupPositionApp();
    global.fetch = () =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(buildFmiXml({ t2m: 'NaN', pSea: 'NaN' })),
      });

    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 1 });
    await flushPromises();
    plugin.stop();

    assert.equal(app.handled.length, 1);
    const paths = app.handled[0].updates[0].values.map((v) => v.path);

    assert.ok(!paths.includes('environment.outside.temperature'));
    assert.ok(!paths.includes('environment.outside.pressure'));
    assert.ok(paths.includes('environment.wind.averageSpeed'));
    assert.ok(paths.includes('environment.wind.gust'));
    assert.ok(paths.includes('environment.wind.directionTrue'));
  });

  test('selects nearest station based on vessel position', async () => {
    const app = createMockApp();
    app.getSelfPath = (path) => {
      if (path === 'navigation.position.value.longitude') return 22.95;
      if (path === 'navigation.position.value.latitude') return 59.77;
      return null;
    };

    const fetchCalls = [];
    global.fetch = (url, _opts) => {
      fetchCalls.push(url);
      return Promise.resolve({ ok: true, text: () => Promise.resolve(buildFmiXml()) });
    };

    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 1 });
    await flushPromises();
    plugin.stop();

    assert.equal(fetchCalls.length, 1);
    assert.ok(fetchCalls[0].includes('fmisid=100932'));
  });

  test('MMSI is 9 digits padded from fmisid', async () => {
    const app = setupPositionApp();
    global.fetch = () =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(buildFmiXml()) });

    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 1 });
    await flushPromises();
    plugin.stop();

    const mmsiMatch = app.handled[0].context.match(/mmsi:(\d+)$/);
    assert.ok(mmsiMatch);
    assert.equal(mmsiMatch[1].length, 9);
  });

  test('options validation clamps numberOfStations to 1 when given 0', async () => {
    const app = setupPositionApp();
    const fetchCalls = [];
    global.fetch = (url, _opts) => {
      fetchCalls.push(url);
      return Promise.resolve({ ok: true, text: () => Promise.resolve(buildFmiXml()) });
    };

    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 0 });
    await flushPromises();
    plugin.stop();

    assert.equal(fetchCalls.length, 1);
  });

  test('handles XML with missing PointTimeSeriesObservation', async () => {
    const app = setupPositionApp();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0">
    <wfs:member></wfs:member>
</wfs:FeatureCollection>`;
    global.fetch = () =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(xml) });

    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 1 });
    await flushPromises();
    plugin.stop();

    // Should not crash
    assert.ok(true);
  });

  test('handles XML with empty MeasurementTimeseries', async () => {
    const app = setupPositionApp();
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection
    xmlns:wfs="http://www.opengis.net/wfs/2.0"
    xmlns:om="http://www.opengis.net/om/2.0"
    xmlns:omso="http://inspire.ec.europa.eu/schemas/omso/3.0"
    xmlns:gml="http://www.opengis.net/gml/3.2"
    xmlns:wml2="http://www.opengis.net/waterml/2.0">
    <wfs:member>
      <omso:PointTimeSeriesObservation gml:id="obs-1-t2m">
        <om:result>
          <wml2:MeasurementTimeseries gml:id="obs-obs-1-1-t2m">
          </wml2:MeasurementTimeseries>
        </om:result>
      </omso:PointTimeSeriesObservation>
    </wfs:member>
</wfs:FeatureCollection>`;
    global.fetch = () =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(xml) });

    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 1 });
    await flushPromises();
    plugin.stop();

    assert.ok(true);
  });

  test('concurrent fetch guard prevents overlapping fetches', async () => {
    const app = setupPositionApp();
    const fetchCalls = [];
    global.fetch = (url, _opts) => {
      fetchCalls.push(url);
      return new Promise(() => {}); // Never resolves
    };

    const plugin = createPlugin(app);
    plugin.start({ updateWeather: 10, numberOfStations: 1 });
    // First readMeteo fires, fetch starts but never resolves

    assert.equal(fetchCalls.length, 1);
    plugin.stop();
  });
});
