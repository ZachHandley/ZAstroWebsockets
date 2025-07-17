# Changelog

## [0.0.0-5ec5088] - 2025-07-17

### Updated
- Updated to Astro 0.0.0
- Synced with upstream Astro repository


All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-01-14

### Added
- Initial release of `zastro-websockets`
- WebSocket support for Astro SSR applications
- Modern TypeScript implementation
- Support for Astro v4 and v5
- Full browser-compatible WebSocket API on the server
- Development server WebSocket support
- Production WebSocket handler
- Authorization and request validation
- Comprehensive TypeScript definitions

### Changed
- Modernized codebase from `astro-node-websocket`
- Updated all dependencies to current versions
- Removed dependency on deprecated `withastro/adapters` repository
- Extended official `@astrojs/node` adapter instead of forking
- Improved error handling and edge cases
- Enhanced TypeScript support

### Technical
- Built with `tsup` for modern bundling
- ESM-only package for modern Node.js environments
- Peer dependency on Astro v4+ 
- Node.js 18+ requirement
- Full source maps and declaration files