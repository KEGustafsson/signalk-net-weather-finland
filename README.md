# Signal K Weather Station Plugin

This plugin fetches weather data from Finnish Meteorological Institute coastal weather stations for Signal K. It automatically selects nearby stations, providing weather updates for maritime navigation.

## Features

- Fetches data from the nearest Finnish Meteorological Institute coastal weather stations.
- Provides the following weather data:
  - Name of the weather station
  - Short name of the weather station
  - FMISID of the weather station
  - Latitude and Longitude of the weather station
  - Temperature
  - Wind speed
  - Wind gust
  - Wind direction
  - Pressure
  - Date of the observation

## Data Source

This plugin fetches weather observation data directly from the [Finnish Meteorological Institute Open Data](https://en.ilmatieteenlaitos.fi/open-data) WFS API (`opendata.fmi.fi`). The data is freely available under the [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) license. No API key is required.

## Usage

Once installed and configured, the plugin will automatically fetch data from the nearest weather stations to your boat's location. Station weather data is available under the meteo context.

Freeboard-SK is able to show meteo data and this needs to be enabled from settings.

## Configuration

Plugin settings:

- Data fetching interval, minimum interval 10 minutes
- Number of nearest weather stations to monitor

## Development

### Prerequisites

- Node.js 18 or later (uses native `fetch`)

### Scripts

```bash
npm run clean      # Clean dist/build output folders
npm run build      # Build TypeScript into dist/
npm test           # Run tests (Node built-in test runner)
npm run lint       # Run linter (ESLint + TypeScript typecheck)
npm run audit-check # Check for vulnerabilities
```

## Support

For any issues or inquiries, please [open an issue](https://github.com/KEGustafsson/signalk-net-weather-finland/issues) on the GitHub repository. We welcome any feedback or contributions.

## License

This project is licensed under the MIT License. Feel free to modify and distribute it according to the terms of the license.
