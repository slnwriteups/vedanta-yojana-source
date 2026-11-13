/**
 * A minimal, read-only POSIX ustar parser -- pure, framework-free, and
 * dependency-free, matching pasuramResourceId.ts's own convention so it
 * stays unit-testable under plain `node --test`.
 *
 * Only exists to unpack mobile/assets/pasurams-archive.generated.zst
 * (see scripts/generate-pasuram-archive.ts and pasuramArchive.ts): a
 * single solid-compressed tar of every bundled Pasuram PDF, built
 * specifically as `tar --format=ustar` (verified empirically against a
 * real macOS bsdtar/libarchive build -- no PAX extended headers, since
 * every entry name here is a short `<32-hex-chars>.pdf` well under the
 * format's 100-byte name field). A general-purpose tar reader would need
 * to handle PAX headers, GNU long-name extensions, sparse files, etc.;
 * none of that applies to an archive this script itself produces, so
 * this parser only implements the plain ustar header layout.
 */

const HEADER_SIZE = 512;
const NAME_OFFSET = 0;
const NAME_SIZE = 100;
const SIZE_OFFSET = 124;
const SIZE_SIZE = 12;
const TYPEFLAG_OFFSET = 156;
/** Regular file. Directory entries ("5") and anything else are skipped. */
const TYPEFLAG_REGULAR = ["\0", "0"];

export interface TarEntry {
  name: string;
  bytes: Uint8Array;
}

/**
 * Every field this reads (filenames, octal size digits) is pure ASCII,
 * so decoding as UTF-8 (a strict superset for byte values 0-127) is
 * byte-identical to ASCII decoding -- deliberately not `new
 * TextDecoder("ascii")`: Hermes (React Native's JS engine) only
 * implements a handful of encoding labels and throws `RangeError:
 * Unknown encoding: ascii` for that one, even though plain Node (which
 * is what tests/pasuram-tar.test.ts runs under) accepts it -- verified
 * empirically on a real device, not assumed.
 */
function readNullTerminatedAscii(bytes: Uint8Array, offset: number, length: number): string {
  let end = offset;
  while (end < offset + length && bytes[end] !== 0) end++;
  return new TextDecoder("utf-8").decode(bytes.subarray(offset, end));
}

function readOctalSize(bytes: Uint8Array, offset: number, length: number): number {
  const text = readNullTerminatedAscii(bytes, offset, length).trim();
  return text === "" ? 0 : Number.parseInt(text, 8);
}

/**
 * Parses every regular-file entry out of a raw (already decompressed)
 * ustar byte stream. An all-zero 512-byte block marks end-of-archive (a
 * real tar has two, but a single one is a sufficient stop condition here
 * since nothing after it is read).
 */
export function parseUstar(bytes: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;

  while (offset + HEADER_SIZE <= bytes.length) {
    const header = bytes.subarray(offset, offset + HEADER_SIZE);
    if (header.every((byte) => byte === 0)) break;

    const name = readNullTerminatedAscii(header, NAME_OFFSET, NAME_SIZE);
    const size = readOctalSize(header, SIZE_OFFSET, SIZE_SIZE);
    const typeflag = String.fromCharCode(header[TYPEFLAG_OFFSET]);

    const dataStart = offset + HEADER_SIZE;
    if (TYPEFLAG_REGULAR.includes(typeflag) && name !== "") {
      entries.push({ name, bytes: bytes.subarray(dataStart, dataStart + size) });
    }

    const paddedSize = Math.ceil(size / HEADER_SIZE) * HEADER_SIZE;
    offset = dataStart + paddedSize;
  }

  return entries;
}

/**
 * The same ustar layout as parseUstar(), read incrementally: push() each
 * chunk of decompressed bytes as it arrives and get back the entries it
 * completed. Lets the app unpack the Pasuram archive a slice at a time,
 * handing the JS thread back between slices, without ever holding the
 * whole 40 MB decompressed tar in memory. Chunks may split a header or a
 * file body at any byte; every returned entry owns its bytes, so callers
 * (and the decompressor) may reuse the chunks they pushed.
 */
export class UstarStream {
  private header = new Uint8Array(HEADER_SIZE);
  private headerFilled = 0;
  private body: Uint8Array | null = null;
  private bodyFilled = 0;
  private name = "";
  private keep = false;
  private padding = 0;
  private ended = false;

  push(chunk: Uint8Array): TarEntry[] {
    const done: TarEntry[] = [];
    let offset = 0;
    while (offset < chunk.length && !this.ended) {
      if (this.padding > 0) {
        const skip = Math.min(this.padding, chunk.length - offset);
        this.padding -= skip;
        offset += skip;
      } else if (this.body) {
        const take = Math.min(this.body.length - this.bodyFilled, chunk.length - offset);
        this.body.set(chunk.subarray(offset, offset + take), this.bodyFilled);
        this.bodyFilled += take;
        offset += take;
        if (this.bodyFilled === this.body.length) this.finishEntry(done);
      } else {
        const take = Math.min(HEADER_SIZE - this.headerFilled, chunk.length - offset);
        this.header.set(chunk.subarray(offset, offset + take), this.headerFilled);
        this.headerFilled += take;
        offset += take;
        if (this.headerFilled === HEADER_SIZE) this.startEntry(done);
      }
    }
    return done;
  }

  private startEntry(done: TarEntry[]): void {
    this.headerFilled = 0;
    if (this.header.every((byte) => byte === 0)) {
      this.ended = true;
      return;
    }
    this.name = readNullTerminatedAscii(this.header, NAME_OFFSET, NAME_SIZE);
    const size = readOctalSize(this.header, SIZE_OFFSET, SIZE_SIZE);
    const typeflag = String.fromCharCode(this.header[TYPEFLAG_OFFSET]);
    this.keep = TYPEFLAG_REGULAR.includes(typeflag) && this.name !== "";
    this.padding = 0;
    this.body = new Uint8Array(size);
    this.bodyFilled = 0;
    if (size === 0) this.finishEntry(done);
  }

  private finishEntry(done: TarEntry[]): void {
    const body = this.body as Uint8Array;
    if (this.keep) done.push({ name: this.name, bytes: body });
    this.padding = Math.ceil(body.length / HEADER_SIZE) * HEADER_SIZE - body.length;
    this.body = null;
  }
}
