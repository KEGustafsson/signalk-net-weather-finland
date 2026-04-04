/*
MIT License

Copyright (c) 2024 Karl-Erik Gustafsson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import haversine from 'haversine';
import { XMLParser } from 'fast-xml-parser';
import type {
  SignalKApp,
  SignalKPlugin,
  PluginOptions,
  SignalKValue,
  Station,
  StationWithDistance,
  WfsTimeseries,
  WfsPoint,
  WfsMember,
  TimeValue,
  WeatherObservations,
} from './types';

const FETCH_TIMEOUT_MS = 30000;
const DEFAULT_UPDATE_MINUTES = 10;
const DEFAULT_NUM_STATIONS = 3;
const INITIAL_INTERVAL_MS = 10000;

function createPlugin(app: SignalKApp): SignalKPlugin {
  let numberOfStations = DEFAULT_NUM_STATIONS;
  let updateWeather = DEFAULT_UPDATE_MINUTES;
  let interval: ReturnType<typeof setInterval> | null = null;
  let intervalTime = INITIAL_INTERVAL_MS;
  let isFetching = false;

  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });

  function clear(): void {
    if (interval !== null) {
      clearInterval(interval);
    }
    intervalTime = updateWeather * 60000;
    interval = setInterval(readMeteo, intervalTime);
  }

  function degrees_to_radians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  function C_to_K(celsius: number): number {
    return celsius + 273.15;
  }

  function getLatestValue(timeseries: WfsTimeseries): TimeValue | null {
    const points = timeseries.point;
    if (!points) return null;
    const arr: WfsPoint[] = Array.isArray(points) ? points : [points];
    for (let i = arr.length - 1; i >= 0; i--) {
      const tvp = arr[i]?.MeasurementTVP;
      if (!tvp) continue;
      const val = parseFloat(String(tvp.value));
      if (!isNaN(val)) {
        return { value: val, time: tvp.time };
      }
    }
    return null;
  }

  function isWfsFeatureCollection(parsed: unknown): parsed is { FeatureCollection: { member: WfsMember | WfsMember[] } } {
    if (typeof parsed !== 'object' || parsed === null) return false;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj['FeatureCollection'] !== 'object' || obj['FeatureCollection'] === null) return false;
    const fc = obj['FeatureCollection'] as Record<string, unknown>;
    return fc['member'] !== undefined && fc['member'] !== null;
  }

  function parseObservations(xml: string): WeatherObservations | null {
    const parsed: unknown = xmlParser.parse(xml);
    if (!isWfsFeatureCollection(parsed)) return null;

    const members: WfsMember[] = Array.isArray(parsed.FeatureCollection.member)
      ? parsed.FeatureCollection.member
      : [parsed.FeatureCollection.member];

    const observations: WeatherObservations = { time: null };

    members.forEach((member) => {
      const obs = member.PointTimeSeriesObservation;
      if (!obs) return;

      const timeseries = obs.result?.MeasurementTimeseries;
      if (!timeseries) return;

      const gmlId: string = timeseries['@_id'] ?? '';
      const latest = getLatestValue(timeseries);
      if (!latest) return;

      if (!observations.time) {
        observations.time = latest.time;
      }

      if (gmlId.includes('t2m')) {
        observations.temperature = latest.value;
      } else if (gmlId.includes('ws_10min')) {
        observations.windSpeed = latest.value;
      } else if (gmlId.includes('wg_10min')) {
        observations.windGust = latest.value;
      } else if (gmlId.includes('wd_10min')) {
        observations.windDir = latest.value;
      } else if (gmlId.includes('p_sea')) {
        observations.pressure = latest.value;
      }
    });

    return observations;
  }

  const stations: readonly Station[] = [
    ["Kotka Haapasaari", "Haapasaari", 101042, 60.29, 27.18],
    ["Kotka Rankki", "Rankki", 101030, 60.38, 26.96],
    ["Loviisa Orrengrund", "Orrengrund", 101039, 60.27, 26.45],
    ["Porvoo Kilpilahti satama", "Kilpilahti", 100683, 60.3, 25.55],
    ["Porvoo Emäsalo", "Emäsalo", 101023, 60.2, 25.63],
    ["Porvoo Kalbådagrund", "Kalbådagrund", 101022, 59.99, 25.6],
    ["Helsinki Vuosaari satama", "Vuosaari", 151028, 60.21, 25.2],
    ["Sipoo Itätoukki", "Itätoukki", 105392, 60.1, 25.19],
    ["Helsinki Harmaja", "Harmaja", 100996, 60.11, 24.98],
    ["Helsinki Helsingin majakka", "Helsingin majakka", 101003, 59.95, 24.93],
    ["Kirkkonummi Mäkiluoto", "Mäkiluoto", 100997, 59.92, 24.35],
    ["Inkoo Bågaskär", "Bågaskär", 100969, 59.93, 24.01],
    ["Raasepori Jussarö", "Jussarö", 100965, 59.82, 23.57],
    ["Hanko Tulliniemi", "Tulliniemi", 100946, 59.81, 22.91],
    ["Hanko Russarö", "Russarö", 100932, 59.77, 22.95],
    ["Kemiönsaari Vänö", "Vänö", 100945, 59.87, 22.19],
    ["Parainen Utö", "Utö", 100908, 59.78, 21.37],
    ["Kökar Bogskär", "Bogskär", 100921, 59.5, 20.35],
    ["Turku Rajakari", "Rajakari", 100947, 60.38, 22.1],
    ["Parainen Fagerholm", "Fagerholm", 100924, 60.11, 21.7],
    ["Kumlinge kirkonkylä", "Kumlinge", 100928, 60.26, 20.75],
    ["Lumparland Långnäs satama", "Långnäs", 151048, 60.12, 20.3],
    ["Maarianhamina Länsisatama", "Maarianhamina", 151029, 60.09, 19.93],
    ["Maarianhamina Lotsberget", "Lotsberget", 107383, 60.09, 19.94],
    ["Lemland Nyhamn", "Nyhamn", 100909, 59.96, 19.95],
    ["Hammarland Märket", "Märket", 100919, 60.3, 19.13],
    ["Kustavi Isokari", "Isokari", 101059, 60.72, 21.03],
    ["Rauma Kylmäpihlaja", "Kylmäpihlaja", 101061, 61.14, 21.3],
    ["Pori Tahkoluoto satama", "Tahkoluoto", 101267, 61.63, 21.38],
    ["Kristiinankaupunki Majakka", "Kristiinankaupunki", 101268, 62.2, 21.17],
    ["Kaskinen Sälgrund", "Sälgrund", 101256, 62.33, 21.19],
    ["Korsnäs Bredskäret", "Bredskäret", 101479, 62.93, 21.18],
    ["Maalahti Strömmingsbådan", "Strömmingsbådan", 101481, 62.98, 20.74],
    ["Mustasaari Valassaaret", "Valassaaret", 101464, 63.44, 21.07],
    ["Pietarsaari Kallan", "Kallan", 101660, 63.75, 22.52],
    ["Kokkola Tankar", "Tankar", 101661, 63.95, 22.85],
    ["Kalajoki Ulkokalla", "Ulkokalla", 101673, 64.33, 23.45],
    ["Raahe Nahkiainen", "Nahkiainen", 101775, 64.61, 23.9],
    ["Raahe Lapaluoto satama", "Lapaluoto", 101785, 64.67, 24.41],
    ["Oulu Vihreäsaari satama", "Vihreäsaari", 101794, 65.01, 25.39],
    ["Hailuoto Marjaniemi", "Marjaniemi", 101784, 65.04, 24.56],
    ["Kemi I majakka", "Kemi I", 101783, 65.39, 24.1],
    ["Kemi Ajos", "Ajos", 101846, 65.67, 24.52],
    ["Asikkala Pulkkilanharju", "Pulkkilanharju", 101185, 61.27, 25.52],
    ["Luhanka Judinsalo", "Judinsalo", 101362, 61.7, 25.51],
    ["Tampere Siilinkari", "Siilinkari", 101311, 61.52, 23.75],
    ["Lappeenranta Hiekkapakka", "Hiekkapakka", 101252, 61.2, 28.47],
    ["Rantasalmi Rukkasluoto", "Rukkasluoto", 101436, 62.06, 28.57],
    ["Liperi Tuiskavanluoto", "Tuiskavanluoto", 101628, 62.55, 29.67],
    ["Kuopio Ritoniemi", "Ritoniemi", 101580, 62.8, 27.9],
    ["Inari Seitalaassa", "Seitalaassa", 129963, 69.05, 27.76],
  ] as const;

  const readMeteo = function readMeteo(): void {
    if (isFetching) {
      app.debug('Previous fetch still in progress, skipping');
      return;
    }

    try {
      const ownLon = app.getSelfPath('navigation.position.value.longitude');
      const ownLat = app.getSelfPath('navigation.position.value.latitude');

      if (ownLon && ownLat) {
        if (intervalTime !== updateWeather * 60000) {
          clear();
        }

        const distToStation: StationWithDistance[] = [];
        const ownLocation = { latitude: Number(ownLat), longitude: Number(ownLon) };

        stations.forEach(([longName, shortName, fmisid, lat, lon]) => {
          const distance: number = haversine(ownLocation, { latitude: lat, longitude: lon });
          distToStation.push([longName, shortName, fmisid, lat, lon, distance]);
        });

        const nearest = distToStation
          .sort((a, b) => a[5] - b[5])
          .slice(0, numberOfStations);

        app.debug(nearest);

        isFetching = true;
        let pending = nearest.length;

        nearest.forEach(([longName, shortName, fmisid, lat, lon]) => {
          const url = `https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::timevaluepair&fmisid=${fmisid}&parameters=t2m,ws_10min,wg_10min,wd_10min,p_sea&timestep=10`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

          fetch(url, { signal: controller.signal })
            .then((res) => {
              if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status}`);
              }
              return res.text();
            })
            .then((xml) => {
              try {
                app.debug(`FMI response for ${longName} (fmisid: ${fmisid})`);
                const observations = parseObservations(xml);
                if (!observations) {
                  app.debug(`No observations parsed for ${longName}`);
                  return;
                }

                const mmsi = String(fmisid).padStart(9, '0');
                const values: SignalKValue[] = [
                  { path: 'environment.station.fmisid', value: fmisid },
                  { path: 'navigation.position', value: { longitude: lon, latitude: lat } },
                  { path: '', value: { name: longName, shortName } },
                ];

                if (observations.temperature !== undefined) {
                  values.push({ path: 'environment.outside.temperature', value: C_to_K(observations.temperature) });
                }
                if (observations.windSpeed !== undefined) {
                  values.push({ path: 'environment.wind.averageSpeed', value: observations.windSpeed });
                }
                if (observations.windGust !== undefined) {
                  values.push({ path: 'environment.wind.gust', value: observations.windGust });
                }
                if (observations.windDir !== undefined) {
                  values.push({ path: 'environment.wind.directionTrue', value: degrees_to_radians(observations.windDir) });
                }
                if (observations.pressure !== undefined) {
                  values.push({ path: 'environment.outside.pressure', value: observations.pressure * 100 });
                }
                if (observations.time) {
                  values.push({ path: 'environment.date', value: observations.time });
                }

                app.handleMessage('signalk-net-weather-finland', {
                  context: `meteo.urn:mrn:imo:mmsi:${mmsi}`,
                  updates: [
                    {
                      values,
                      source: { label: plugin.id },
                      timestamp: new Date().toISOString(),
                    },
                  ],
                });
              } catch (parseErr) {
                console.error(`Failed to parse FMI response for ${longName}:`, parseErr);
              }
            })
            .catch((err: Error) => {
              app.debug(`Failed to fetch weather data for ${longName}: ${err.message}`);
            })
            .finally(() => {
              clearTimeout(timeoutId);
              pending--;
              if (pending <= 0) {
                isFetching = false;
              }
            });
        });
      } else {
        app.debug("No own position, cannot fetch nearest stations' data");
      }
    } catch (error) {
      isFetching = false;
      console.error('Error reading meteorological data:', error);
    }
  };

  const plugin: SignalKPlugin = {
    id: 'signalk-net-weather-finland',
    name: 'Signal K Net Weather Finland',
    description: 'Finnish Meteorological Institute coastal weather station data for Signal K',
    schema: {
      type: 'object',
      properties: {
        updateWeather: {
          type: 'integer',
          default: 10,
          minimum: 10,
          title: 'How often weather station data is fetched (in minutes)',
        },
        numberOfStations: {
          type: 'integer',
          default: 3,
          minimum: 1,
          maximum: 51,
          title: 'Number of nearest weather stations to monitor',
        },
      },
    },
    start(options: PluginOptions): void {
      app.debug('Signal K Net Weather Finland started');
      updateWeather = Math.max(options.updateWeather, 10);
      numberOfStations = Math.min(Math.max(options.numberOfStations, 1), 51);
      interval = setInterval(readMeteo, intervalTime);
      readMeteo();
    },
    stop(): void {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
      isFetching = false;
      app.debug('Signal K Net Weather Finland stopped');
    },
    _test: {
      degrees_to_radians,
      C_to_K,
      getLatestValue,
      parseObservations,
      stations,
    },
  };

  return plugin;
}

export = createPlugin;
