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

module.exports = function createPlugin(app) {
  const plugin = {};
  plugin.id = 'signalk-net-weather-finland';
  plugin.name = 'Signal K Net Weather Finland';
  plugin.description = 'Finnish Meteorological Institute coastal weather station data for Signal K';

  const haversine = require('haversine');
  const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
  let numberOfStations;
  let updateWeather;
  let interval;
  let intervalTime = 10000;

  plugin.start = function (options) {
    app.debug('Signal K Net Weather Finland started');
    updateWeather = options.updateWeather;
    numberOfStations = options.numberOfStations;
    interval = setInterval(readMeteo, intervalTime);
    readMeteo();
  };

  plugin.stop = function stop() {
    clearInterval(interval);
    app.debug('Signal K Net Weather Finland stopped');
  };

  plugin.schema = {
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
  };

  function clear() {
    clearInterval(interval);
    intervalTime = updateWeather * 60000;
    interval = setInterval(readMeteo, intervalTime);
  }

  function degrees_to_radians(degrees) {
    const pi = Math.PI;
    return degrees * (pi / 180);
  }

  function kmh_to_knots(speed) {
    return speed / 1.852;
  }

  function draught_value(data) {
    return data / 10;
  }

  function C_to_K(data) {
    return data + 273.15;
  }

  const stations = [
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
    ["Inari Seitalaassa", "Seitalaassa", 129963, 69.05, 27.76]
  ]

  const readMeteo = function readMeteo() {
    try {
      const ownLon = app.getSelfPath('navigation.position.value.longitude');
      const ownLat = app.getSelfPath('navigation.position.value.latitude');

      if (ownLon && ownLat) {
        if (intervalTime !== updateWeather * 60000) {
          clear();
        }

        let distToStation = [];
        const ownLocation = { latitude: ownLat, longitude: ownLon };

        stations.forEach(([longName, shortName, fmisid, lat, lon]) => {
          const distance = haversine(ownLocation, { latitude: lat, longitude: lon });
          distToStation.push([longName, shortName, fmisid, lat, lon, distance]);
        });

        distToStation = distToStation.sort((a, b) => a[5] - b[5]).slice(0, numberOfStations);

        app.debug(distToStation);

        distToStation.forEach(([longName, shortName, fmisid, lat, lon, distance]) => {
          const url = `https://tuuleeko.fi/fmiproxy/nearest-observations?lat=${lat}&lon=${lon}&latest=true`;

          fetch(url, { method: 'GET' })
            .then((res) => {
              if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status}`);
              }
              return res.json();
            })
            .then((json) => {
              try {
                app.debug(JSON.stringify(json));
                const name = json.station.name;
                const latitude = json.station.latitude;
                const longitude = json.station.longitude;
                const geoid = json.station.geoid;
                const mmsi = String(Math.abs(geoid)).padStart(9, '0');
                const temperature = C_to_K(json.observations.temperature);
                const windSpeed = json.observations.windSpeedMs;
                const windGust = json.observations.windGustMs;
                const windDir = degrees_to_radians(json.observations.windDir);
                const pressure = json.observations.pressureMbar * 100;
                const date = json.observations.time;

                app.handleMessage('signalk-net-weather-finland', {
                  context: `meteo.urn:mrn:imo:mmsi:${mmsi}`,
                  updates: [
                    {
                      values: [
                        { path: 'environment.station.geoid', value: geoid },
                        { path: 'navigation.position', value: { longitude, latitude } },
                        { path: '', value: { name, shortName } },
                        { path: 'environment.outside.temperature', value: temperature },
                        { path: 'environment.wind.averageSpeed', value: windSpeed },
                        { path: 'environment.wind.gust', value: windGust },
                        { path: 'environment.wind.directionTrue', value: windDir },
                        { path: 'environment.outside.pressure', value: pressure },
                        { path: 'environment.date', value: date }
                      ],
                      source: { label: plugin.id },
                      timestamp: new Date().toISOString()
                    }
                  ]
                });
              } catch (parseErr) {
                console.error('Failed to parse JSON response', parseErr);
              }
            })
            .catch(() => {
            });
        });
      } else {
        app.debug("No own position, cannot fetch nearest stations' data");
      }
    } catch (error) {
      console.error('Error reading meteorological data:', error);
    }
  };

  return plugin;
};
