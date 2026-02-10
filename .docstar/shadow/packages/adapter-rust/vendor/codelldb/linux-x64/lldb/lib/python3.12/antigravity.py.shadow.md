# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/antigravity.py
@source-hash: 8a5ee63e1b79ba27
@generated: 2026-02-09T18:09:19Z

**Purpose**: Python Easter egg module that implements the xkcd geohash algorithm and opens the original "import antigravity" xkcd comic.

**Core Functionality**:
- **Module initialization (L5)**: Automatically opens https://xkcd.com/353/ in default web browser when imported
- **geohash function (L7-17)**: Implements the Munroe geohashing algorithm from xkcd comic #426

**Key Components**:
- **geohash(latitude, longitude, datedow) (L7)**: Takes GPS coordinates and date/Dow Jones value to compute pseudo-random offset coordinates
  - Uses MD5 hash of datedow parameter for randomization (L15)
  - Converts hex digest to two floating point offsets (L16)
  - Prints modified coordinates with decimal offsets appended (L17)

**Dependencies**:
- `webbrowser`: For opening URLs in system browser
- `hashlib`: For MD5 hashing in geohash computation

**Algorithm Details**:
- Splits MD5 hash into two 16-character hex segments
- Converts each segment to float using `float.fromhex()` with '0.' prefix
- Appends fractional parts (excluding leading '0') to integer coordinate values

**Usage Pattern**: This is a reference implementation of the geohashing algorithm popularized by xkcd, typically used for generating meetup coordinates based on date and stock market data.