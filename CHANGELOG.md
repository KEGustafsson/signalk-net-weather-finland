# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Signal K plugin CI: `.github/workflows/signalk-ci.yml` calls the canonical
  `SignalK/signalk-server` reusable `plugin-ci.yml`, building and testing the
  plugin on Linux x64, Linux arm64, macOS and Windows against Node 22 and 24.
  armv7/Cerbo GX emulation and the Signal K integration test are available as
  manual `workflow_dispatch` options.
- Repository CI: `.github/workflows/ci.yml` runs ESLint, `tsc --noEmit` and
  `npm audit`, the last also on a weekly schedule.
- This changelog, and `signalk.screenshots` in `package.json` for the Signal K
  App Store listing.

## [1.0.0] - 2026-04-05

### Changed

- Consolidated the TypeScript rewrite and the parallel test branch into a
  single 1.0 release (#10).
- Extracted shared TypeScript interfaces into `src/types.ts`.

### Added

- 30 second fetch timeout via `AbortController`, plus a concurrency guard that
  skips a scheduled fetch while the previous one is still in flight.
- Expanded the test suite around observation parsing and station selection.

## [0.5.1] - 2026-04-04

### Fixed

- Build-time issues in the newly added TypeScript pipeline.

## [0.5.0] - 2026-04-04

### Changed

- Migrated the plugin to TypeScript with a `tsc` build pipeline, and switched
  the tests to the Node built-in test runner (#8).
- Replaced the `tuuleeko.fi` FMI proxy with direct queries against the Finnish
  Meteorological Institute open data WFS API (`opendata.fmi.fi`), removing the
  third-party dependency from the data path.

## [0.4.1] - 2024-12-16

### Fixed

- Error handling around failed fetches, including a case that failed silently.

## [0.3.0] - 2024-08-22

### Fixed

- Unhandled fetch error when no network was available (#5, #6).

## [0.2.1] - 2024-06-09

### Fixed

- Typo in the published metadata.

## [0.2.0] - 2024-06-09

### Added

- Weather is read once at plugin start rather than only on the first interval
  tick, and a debug message is logged when own position is unavailable (#4).

## [0.1.0] - 2024-03-17

### Added

- Initial release: fetches observations from the nearest Finnish
  Meteorological Institute coastal weather stations, selected by haversine
  distance from the vessel position, and publishes them under the `meteo`
  context.

[Unreleased]: https://github.com/KEGustafsson/signalk-net-weather-finland/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/KEGustafsson/signalk-net-weather-finland/releases/tag/v1.0.0
[0.5.1]: https://github.com/KEGustafsson/signalk-net-weather-finland/releases/tag/v0.5.1
[0.5.0]: https://github.com/KEGustafsson/signalk-net-weather-finland/releases/tag/v0.5.0
[0.4.1]: https://github.com/KEGustafsson/signalk-net-weather-finland/releases/tag/v0.4.1
[0.3.0]: https://github.com/KEGustafsson/signalk-net-weather-finland/releases/tag/v0.3.0
[0.2.1]: https://github.com/KEGustafsson/signalk-net-weather-finland/releases/tag/v0.2.1
[0.2.0]: https://github.com/KEGustafsson/signalk-net-weather-finland/releases/tag/v0.2.0
[0.1.0]: https://github.com/KEGustafsson/signalk-net-weather-finland/releases/tag/v0.1.0
