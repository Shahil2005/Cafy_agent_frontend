/** Check declared ZIP expansion budgets before handing a DOCX to the parser. */
export function validateCareerDocxArchive(buffer: ArrayBuffer): void {
  const view = new DataView(buffer);
  const reject = () => { throw new Error("This DOCX is too complex or could not be read safely. Re-export a short CV or choose a PDF."); };
  let end = -1;
  for (let index = buffer.byteLength - 22; index >= Math.max(0, buffer.byteLength - 65557); index--) {
    if (view.getUint32(index, true) === 0x06054b50 && index + 22 + view.getUint16(index + 20, true) === buffer.byteLength) { end = index; break; }
  }
  if (end < 0) return reject();
  const entries = view.getUint16(end + 10, true);
  const centralBytes = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0 ||
      view.getUint16(end + 8, true) !== entries || entries < 1 || entries > 200 ||
      centralOffset + centralBytes > end || centralOffset + centralBytes < centralOffset) return reject();
  let offset = centralOffset, expanded = 0;
  let hasDocument = false, hasTypes = false;
  const decoder = new TextDecoder();
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > centralOffset + centralBytes || view.getUint32(offset, true) !== 0x02014b50) return reject();
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const bytes = view.getUint32(offset + 24, true);
    const nameBytes = view.getUint16(offset + 28, true);
    const next = offset + 46 + nameBytes + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    if (flags & 1 || ![0, 8].includes(method) || bytes > 8 * 1024 * 1024 || nameBytes < 1 || nameBytes > 512 || next > centralOffset + centralBytes) return reject();
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameBytes));
    if (name.startsWith("/") || name.includes("\\") || name.split("/").includes("..")) return reject();
    if (name === "word/document.xml") { hasDocument = true; if (bytes > 4 * 1024 * 1024) return reject(); }
    if (name === "[Content_Types].xml") hasTypes = true;
    expanded += bytes;
    if (expanded > 16 * 1024 * 1024) return reject();
    offset = next;
  }
  if (offset !== centralOffset + centralBytes || !hasDocument || !hasTypes) reject();
}
