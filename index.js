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

  const haversine = require("haversine")
  const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
  let numberOfStations
  let updateWeather
  let distToStation = []

  let interval;
  let initStatus = false;

  plugin.start = function (options, restartPlugin) {
    updateWeather = options.updateWeather
    numberOfStations = options.numberOfStations

    app.debug('Plugin started');
    interval = setInterval(readMeteo, (10000));
  };

  plugin.stop = function stop() {
    clearInterval(interval);
    initStatus = false
    distToStation = []
    app.debug('NetWeather Stopped');
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
    interval = setInterval(readMeteo, (updateWeather * 60000));
    initStatus = true;
  };

  function degrees_to_radians(degrees) {
    var pi = Math.PI;
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

  readMeteo = function readMeteo() {
    const ownLon = app.getSelfPath('navigation.position.value.longitude');
    const ownLat = app.getSelfPath('navigation.position.value.latitude');

    if (ownLon && ownLat) {
      if (initStatus === false) {
        setTimeout(clear, 1000);
      }
      distToStation = []
      const ownLocation = { latitude: ownLat, longitude: ownLon }
      stations.forEach(([longName, shortName, fmisid, lat, lon]) => {
        const distance = haversine(ownLocation, { latitude: lat, longitude: lon })
        distToStation.push([longName, shortName, fmisid, lat, lon, distance])
      })
      distToStation = distToStation.sort((a, b) => a[5] - b[5]).slice(0, numberOfStations)
      app.debug(distToStation)
      distToStation.forEach(([longName, shortName, fmisid, lat, lon, distance]) => {
        const url = `https://tuuleeko.fi/fmiproxy/nearest-observations?lat=${lat}&lon=${lon}&latest=true`
        fetch(url, { method: 'GET' })
          .then((res) => {
            return res.json()
          })
          .then((json) => {
            app.debug(JSON.stringify(json));
            var name = json.station .name;
            var latitude = json.station.latitude;
            var longitude = json.station.longitude;
            var geoid = json.station.geoid;
            var mmsi = String(Math.abs(geoid)).padStart(9, '0')
            var temperature = C_to_K(json.observations.temperature);
            var windSpeed = json.observations.windSpeedMs;
            var windGust = json.observations.windGustMs;
            var windDir = degrees_to_radians(json.observations.windDir);
            var pressure = json.observations.pressureMbar * 100;
            var date = json.observations.time;
            app.handleMessage('signalk-net-weather-finland', {
              context: 'meteo.urn:mrn:imo:mmsi:' + mmsi,
              updates: [
                {
                  values: [
                    {
                      path: 'environment.station.geoid',
                      value: geoid
                    },
                    {
                      path: 'navigation.position',
                      value: { longitude, latitude }
                    },
                    {
                      path: '',
                      value: {
                        name,
                        shortName
                      }
                    },
                    {
                      path: 'environment.outside.temperature',
                      value: temperature
                    },
                    {
                      path: 'environment.wind.averageSpeed',
                      value: windSpeed
                    },
                    {
                      path: 'environment.wind.gust',
                      value: windGust
                    },
                    {
                      path: 'environment.wind.directionTrue',
                      value: windDir
                    },
                    {
                      path: 'environment.outside.pressure',
                      value: pressure
                    },
                    {
                      path: 'environment.date',
                      value: date
                    },
                  ],
                  source: { label: plugin.id },
                  timestamp: (new Date().toISOString()),
                }
              ]
            })
          })
      })
    }
  };
  return plugin;
}
