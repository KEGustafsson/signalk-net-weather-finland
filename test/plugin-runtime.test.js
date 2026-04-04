const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function parseXmlToFeatureCollection(xml) {
  const members = [];
  const re = /<wml2:MeasurementTimeseries[^>]*gml:id="([^"]+)"[\s\S]*?<wml2:time>([^<]+)<\/wml2:time>[\s\S]*?<wml2:value>([^<]+)<\/wml2:value>/g;
  let match = re.exec(xml);

  while (match) {
    const id = match[1];
    const time = match[2];
    const value = match[3];
    members.push({
      PointTimeSeriesObservation: {
        result: {
          MeasurementTimeseries: {
            '@_id': id,
            point: {
              MeasurementTVP: {
                time,
                value,
              },
            },
          },
        },
      },
    });
    match = re.exec(xml);
  }

  return { FeatureCollection: { member: members } };
}

function loadPluginWithMocks() {
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'haversine') {
      return () => 1;
    }

    if (request === 'fast-xml-parser') {
      return {
        XMLParser: class XMLParser {
          parse(xml) {
            return parseXmlToFeatureCollection(xml);
          }
        },
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[require.resolve('../dist/index.js')];
  const createPlugin = require('../dist/index.js');

  Module._load = originalLoad;
  return createPlugin;
}

function createMockApp() {
  const debugLog = [];
  const handled = [];

  return {
    debugLog,
    handled,
    debug: (message) => {
      debugLog.push(message);
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

test('metadata and helpers', () => {
  const createPlugin = loadPluginWithMocks();
  const app = createMockApp();
  const plugin = createPlugin(app);

  assert.equal(plugin.id, 'signalk-net-weather-finland');
  assert.equal(plugin.name, 'Signal K Net Weather Finland');
  assert.equal(plugin._test.C_to_K(0), 273.15);
  assert.equal(plugin._test.degrees_to_radians(180), Math.PI);
});

test('parseObservations parses FMI values', () => {
  const createPlugin = loadPluginWithMocks();
  const app = createMockApp();
  const plugin = createPlugin(app);

  const obs = plugin._test.parseObservations(buildFmiXml());

  assert.equal(obs.temperature, 4.4);
  assert.equal(obs.windSpeed, 6.3);
  assert.equal(obs.windGust, 7.4);
  assert.equal(obs.windDir, 170);
  assert.equal(obs.pressure, 999.5);
  assert.equal(obs.time, '2026-04-04T08:40:00Z');
});

test('start logs no-position message when no vessel position', () => {
  const createPlugin = loadPluginWithMocks();
  const app = createMockApp();
  const plugin = createPlugin(app);

  plugin.start({ updateWeather: 10, numberOfStations: 1 });
  plugin.stop();

  assert.equal(app.debugLog.includes("No own position, cannot fetch nearest stations' data"), true);
});

test('integration: fetch -> handleMessage', async () => {
  const createPlugin = loadPluginWithMocks();
  const app = createMockApp();
  app.getSelfPath = (path) => {
    if (path === 'navigation.position.value.longitude') return 24.98;
    if (path === 'navigation.position.value.latitude') return 60.11;
    return null;
  };

  const plugin = createPlugin(app);
  const originalFetch = global.fetch;
  const xml = buildFmiXml({ t2m: '5.0', ws: '8.0', wg: '12.0', wd: '200', pSea: '1010.0' });

  global.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve(xml) });

  plugin.start({ updateWeather: 10, numberOfStations: 1 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  plugin.stop();

  global.fetch = originalFetch;

  assert.equal(app.handled.length, 1);
  const message = app.handled[0];
  const values = message.updates[0].values;
  const byPath = (name) => values.find((item) => item.path === name);

  assert.equal(String(message.context).startsWith('meteo.urn:mrn:imo:mmsi:'), true);
  assert.equal(byPath('environment.outside.temperature').value, 278.15);
  assert.equal(byPath('environment.wind.averageSpeed').value, 8);
  assert.equal(byPath('environment.wind.gust').value, 12);
  assert.equal(byPath('environment.outside.pressure').value, 101000);
});
