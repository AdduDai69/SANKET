/**
 * SANKET CivicLens — Client-Side EXIF GPS Reader
 *
 * Lightweight, zero-dependency binary reader for JPEG/TIFF APP1 GPS tags.
 * Runs instantly in the browser when a citizen selects a photo, providing
 * immediate verification feedback without requiring a round-trip to the server.
 */

export interface ExifLocationResult {
  exifGpsAvailable: boolean;
  rawExifPresent: boolean;
  incidentLatitude: number | null;
  incidentLongitude: number | null;
  altitude: number | null;
  captureTimestamp: string | null;
  make: string | null;
  model: string | null;
  locationSource: 'EXIF_GPS' | 'NONE';
  error?: string;
}

/**
 * Read EXIF metadata and GPS coordinates directly from a File or ArrayBuffer.
 */
export async function readExifFromBlob(blob: Blob): Promise<ExifLocationResult> {
  const fallbackResult: ExifLocationResult = {
    exifGpsAvailable: false,
    rawExifPresent: false,
    incidentLatitude: null,
    incidentLongitude: null,
    altitude: null,
    captureTimestamp: null,
    make: null,
    model: null,
    locationSource: 'NONE',
  };

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const dataView = new DataView(arrayBuffer);

    // Verify JPEG SOI marker (0xFFD8)
    if (dataView.byteLength < 4 || dataView.getUint16(0, false) !== 0xffd8) {
      return fallbackResult;
    }

    let offset = 2;
    const length = dataView.byteLength;

    // Search for APP1 Marker (0xFFE1)
    while (offset < length - 4) {
      const marker = dataView.getUint16(offset, false);
      offset += 2;

      // Check if SOS marker reached (0xFFDA) or EOI (0xFFD9)
      if (marker === 0xffda || marker === 0xffd9) {
        break;
      }

      const segmentLength = dataView.getUint16(offset, false);
      if (segmentLength < 2) break;

      if (marker === 0xffe1) {
        // Found APP1! Verify "Exif\0\0" header
        const exifHeaderOffset = offset + 2;
        if (
          dataView.getUint32(exifHeaderOffset, false) === 0x45786966 && // "Exif"
          dataView.getUint16(exifHeaderOffset + 4, false) === 0x0000 // "\0\0"
        ) {
          fallbackResult.rawExifPresent = true;
          const tiffStart = exifHeaderOffset + 6;
          return parseTiffHeader(dataView, tiffStart, segmentLength - 8);
        }
      }

      offset += segmentLength;
    }

    return fallbackResult;
  } catch (err) {
    return {
      ...fallbackResult,
      error: err instanceof Error ? err.message : 'Failed to parse EXIF.',
    };
  }
}

function parseTiffHeader(
  dataView: DataView,
  tiffStart: number,
  maxLen: number
): ExifLocationResult {
  const result: ExifLocationResult = {
    exifGpsAvailable: false,
    rawExifPresent: true,
    incidentLatitude: null,
    incidentLongitude: null,
    altitude: null,
    captureTimestamp: null,
    make: null,
    model: null,
    locationSource: 'NONE',
  };

  if (tiffStart + 8 > dataView.byteLength) {
    return result;
  }

  // Check endianness: 0x4949 ("II" = Little Endian), 0x4D4D ("MM" = Big Endian)
  const byteOrder = dataView.getUint16(tiffStart, false);
  let littleEndian = false;
  if (byteOrder === 0x4949) {
    littleEndian = true;
  } else if (byteOrder === 0x4d4d) {
    littleEndian = false;
  } else {
    return result;
  }

  // Meaning of life marker (42)
  if (dataView.getUint16(tiffStart + 2, littleEndian) !== 0x002a) {
    return result;
  }

  const ifd0Offset = dataView.getUint32(tiffStart + 4, littleEndian);
  if (ifd0Offset < 8 || ifd0Offset > maxLen) {
    return result;
  }

  let gpsOffset: number | null = null;
  let exifSubIfdOffset: number | null = null;

  // Read IFD0 entries
  const ifd0Start = tiffStart + ifd0Offset;
  if (ifd0Start + 2 > dataView.byteLength) return result;
  const numEntries = dataView.getUint16(ifd0Start, littleEndian);

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifd0Start + 2 + i * 12;
    if (entryOffset + 12 > dataView.byteLength) break;

    const tag = dataView.getUint16(entryOffset, littleEndian);

    if (tag === 0x010f) {
      // Make
      result.make = readAsciiString(dataView, tiffStart, entryOffset, littleEndian);
    } else if (tag === 0x0110) {
      // Model
      result.model = readAsciiString(dataView, tiffStart, entryOffset, littleEndian);
    } else if (tag === 0x0132 || tag === 0x9003) {
      // DateTime or DateTimeOriginal
      result.captureTimestamp = formatExifDate(
        readAsciiString(dataView, tiffStart, entryOffset, littleEndian)
      );
    } else if (tag === 0x8769) {
      // Exif SubIFD Offset
      exifSubIfdOffset = dataView.getUint32(entryOffset + 8, littleEndian);
    } else if (tag === 0x8825) {
      // GPS IFD Offset
      gpsOffset = dataView.getUint32(entryOffset + 8, littleEndian);
    }
  }

  // If capture timestamp was not in IFD0, check SubIFD
  if (!result.captureTimestamp && exifSubIfdOffset) {
    const subIfdStart = tiffStart + exifSubIfdOffset;
    if (subIfdStart + 2 <= dataView.byteLength) {
      const subEntries = dataView.getUint16(subIfdStart, littleEndian);
      for (let i = 0; i < subEntries; i++) {
        const entryOffset = subIfdStart + 2 + i * 12;
        if (entryOffset + 12 > dataView.byteLength) break;
        const tag = dataView.getUint16(entryOffset, littleEndian);
        if (tag === 0x9003 || tag === 0x9004) {
          // DateTimeOriginal or DateTimeDigitized
          const dt = readAsciiString(dataView, tiffStart, entryOffset, littleEndian);
          if (dt) {
            result.captureTimestamp = formatExifDate(dt);
            break;
          }
        }
      }
    }
  }

  // Parse GPS IFD if present
  if (gpsOffset !== null && tiffStart + gpsOffset + 2 <= dataView.byteLength) {
    const gpsStart = tiffStart + gpsOffset;
    const gpsNumEntries = dataView.getUint16(gpsStart, littleEndian);

    let latRef: string | null = null;
    let rawLat: number[] | null = null;
    let lonRef: string | null = null;
    let rawLon: number[] | null = null;
    let altitude: number | null = null;

    for (let i = 0; i < gpsNumEntries; i++) {
      const entryOffset = gpsStart + 2 + i * 12;
      if (entryOffset + 12 > dataView.byteLength) break;

      const tag = dataView.getUint16(entryOffset, littleEndian);

      if (tag === 0x0001) {
        // GPSLatitudeRef (N or S)
        latRef = String.fromCharCode(dataView.getUint8(entryOffset + 8));
      } else if (tag === 0x0002) {
        // GPSLatitude (3 rationals: deg, min, sec)
        rawLat = readRationalArray(dataView, tiffStart, entryOffset, 3, littleEndian);
      } else if (tag === 0x0003) {
        // GPSLongitudeRef (E or W)
        lonRef = String.fromCharCode(dataView.getUint8(entryOffset + 8));
      } else if (tag === 0x0004) {
        // GPSLongitude (3 rationals)
        rawLon = readRationalArray(dataView, tiffStart, entryOffset, 3, littleEndian);
      } else if (tag === 0x0006) {
        // GPSAltitude
        const altRationals = readRationalArray(dataView, tiffStart, entryOffset, 1, littleEndian);
        if (altRationals && altRationals.length > 0) {
          altitude = altRationals[0];
        }
      }
    }

    if (rawLat && rawLon) {
      let lat = rawLat[0] + rawLat[1] / 60.0 + rawLat[2] / 3600.0;
      let lon = rawLon[0] + rawLon[1] / 60.0 + rawLon[2] / 3600.0;

      if (latRef === 'S') lat = -Math.abs(lat);
      if (lonRef === 'W') lon = -Math.abs(lon);

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180 &&
        !(lat === 0 && lon === 0)
      ) {
        result.exifGpsAvailable = true;
        result.incidentLatitude = Number(lat.toFixed(6));
        result.incidentLongitude = Number(lon.toFixed(6));
        result.altitude = altitude !== null ? Number(altitude.toFixed(1)) : null;
        result.locationSource = 'EXIF_GPS';
      }
    }
  }

  return result;
}

function readAsciiString(
  dataView: DataView,
  tiffStart: number,
  entryOffset: number,
  littleEndian: boolean
): string | null {
  try {
    const numChars = dataView.getUint32(entryOffset + 4, littleEndian);
    if (numChars <= 0) return null;

    let stringOffset = entryOffset + 8;
    if (numChars > 4) {
      stringOffset = tiffStart + dataView.getUint32(entryOffset + 8, littleEndian);
    }

    if (stringOffset + numChars > dataView.byteLength) return null;

    let str = '';
    for (let i = 0; i < numChars; i++) {
      const code = dataView.getUint8(stringOffset + i);
      if (code === 0) break; // null terminator
      str += String.fromCharCode(code);
    }
    return str.trim() || null;
  } catch {
    return null;
  }
}

function readRationalArray(
  dataView: DataView,
  tiffStart: number,
  entryOffset: number,
  expectedCount: number,
  littleEndian: boolean
): number[] | null {
  try {
    const count = dataView.getUint32(entryOffset + 4, littleEndian);
    const valueOffset = tiffStart + dataView.getUint32(entryOffset + 8, littleEndian);
    const result: number[] = [];

    for (let i = 0; i < Math.min(count, expectedCount); i++) {
      const numOffset = valueOffset + i * 8;
      if (numOffset + 8 > dataView.byteLength) break;
      const numerator = dataView.getUint32(numOffset, littleEndian);
      const denominator = dataView.getUint32(numOffset + 4, littleEndian);
      if (denominator === 0) {
        result.push(0);
      } else {
        result.push(numerator / denominator);
      }
    }
    return result.length > 0 ? result : null;
  } catch {
    return null;
  }
}

function formatExifDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    // Standard format: "YYYY:MM:DD HH:MM:SS"
    const parts = dateStr.trim().split(' ');
    if (parts.length >= 2) {
      const ymd = parts[0].replace(/:/g, '-');
      const time = parts[1];
      return `${ymd}T${time}Z`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}
