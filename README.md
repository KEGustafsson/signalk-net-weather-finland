# Signal K Weather Station Plugin

This plugin fetches weather data from Finnish Meteorological Institute coastal weather stations for Signal K. It automatically selects nearby stations, providing weather updates for maritime navigation.

## Features

- Fetches data from the nearest Finnish Meteorological Institute coastal weather stations.
- Provides the following weather data:
  - Name of the weather station
  - Short name of the weather station
  - Geoid of the weather station
  - Latitude and Longitude of the weather station
  - Temperature
  - Wind speed
  - Wind gust
  - Wind direction
  - Pressure
  - Date of the observation

## Data Source

This plugin utilizes data from [tuuleeko.fi](https://tuuleeko.fi), provided by the Finnish Meteorological Institute.

## Usage

Once installed and configured, the plugin will automatically fetch data from the nearest weather stations to your boat's location. Stations weather datas are available under meteo context.

Freeboard-SK is able to show meteo data and this need to be enabled from settings.

## Configuration

Plugin settings:

- Data fetching interval, minimum interval 10 minutes 
- Number of nearest weather stations to monitor

## Support

For any issues or inquiries, please [open an issue](https://github.com/KEGustafsson/signalk-net-weather-finland/issues) on the GitHub repository. We welcome any feedback or contributions.

## License

This project is licensed under the MIT License. Feel free to modify and distribute it according to the terms of the license.
