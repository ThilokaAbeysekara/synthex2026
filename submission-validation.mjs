export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const DOCUMENT_TYPES = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};
export const BATCHES = ['24/25', '23/24', '22/23', '21/22', '20/21'];

export function validateSubmission(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid registration details.');
  const text = (value, label, max, required = true) => {
    if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > max) {
      throw new Error(`${label} is ${required ? 'required and must be' : 'limited to'} at most ${max} characters.`);
    }
    return value.trim();
  };
  if (!['individual', 'group'].includes(input.submissionType)) throw new Error('Choose an individual or group submission.');
  if (!BATCHES.includes(input.batch)) throw new Error('Select a valid batch.');
  const email = text(input.email, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  const phone = text(input.phone ?? '', 'Contact number', 30, false);
  if (phone && !/^\+?[\d\s().-]{7,30}$/.test(phone)) throw new Error('Enter a valid contact number.');
  const members = input.members;
  if (!Array.isArray(members) || (input.submissionType === 'individual' ? members.length !== 1 : members.length < 2 || members.length > 6)) {
    throw new Error('Individual entries need one participant; groups need 2 to 6 members.');
  }
  const normalized = members.map(member => ({
    regNo: text(member?.regNo, 'Registration number', 50).toUpperCase().replace(/\s+/g, ''),
    fullName: text(member?.fullName, 'Full name', 150),
  }));
  if (normalized.some(member => !/^[A-Z0-9][A-Z0-9/._-]{1,49}$/.test(member.regNo))) throw new Error('Enter valid registration numbers (letters, numbers, /, ., _ or -).');
  if (new Set(normalized.map(member => member.regNo)).size !== normalized.length) throw new Error('Each team member must have a different registration number.');
  return { submissionType: input.submissionType, batch: input.batch, email, phone,
    topic: text(input.topic, 'Project topic', 300), members: normalized };
}

export async function validateConceptPaper(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.name) throw new Error('Please upload your concept paper (PDF, DOC or DOCX).');
  const extension = file.name.split('.').pop().toLowerCase();
  const mimeType = DOCUMENT_TYPES[extension];
  if (!mimeType || (file.type && file.type !== 'application/octet-stream' && file.type !== mimeType)) throw new Error('Only PDF, DOC and DOCX documents are accepted.');
  if (file.name.length > 200) throw new Error('Use a document filename of at most 200 characters.');
  if (file.size > MAX_FILE_SIZE) throw new Error('Maximum document size is 10 MB.');
  if (file.size < 8) throw new Error('The document is empty or invalid.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let valid = false;
  if (extension === 'pdf') valid = /^%PDF-\d\.\d/.test(new TextDecoder().decode(bytes.slice(0, 8)));
  if (extension === 'doc') {
    valid = [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((b,i) => bytes[i] === b)
      && new TextDecoder('utf-16le').decode(bytes).includes('WordDocument');
  }
  if (extension === 'docx') valid = isWordZip(bytes);
  if (!valid) throw new Error(`The uploaded file is not a valid ${extension.toUpperCase()} document. Please export the document again.`);
  return { extension, mimeType };
}

function isWordZip(bytes) {
  // Check the ZIP directory without decompressing participant-controlled content.
  // A renamed ZIP, encrypted file, or oversized expanded archive is rejected.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const found = new Set();
  try {
    if (view.getUint32(0, true) !== 0x04034b50) return false;
    let end = bytes.length - 22;
    const min = Math.max(0, bytes.length - 65557);
    while (end >= min && view.getUint32(end, true) !== 0x06054b50) end--;
    if (end < min || end + 22 + view.getUint16(end + 20, true) !== bytes.length) return false;
    if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) return false;
    const count = view.getUint16(end + 10, true);
    let offset = view.getUint32(end + 16, true), total = 0;
    for (let i = 0; i < count; i++) {
      if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50 || (view.getUint16(offset + 8, true) & 1)) return false;
      const length = view.getUint16(offset + 28, true);
      const size = 46 + length + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
      if (offset + size > end) return false;
      total += view.getUint32(offset + 24, true);
      if (total > 50 * 1024 * 1024) return false;
      found.add(new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + length)));
      offset += size;
    }
    return found.has('[Content_Types].xml') && found.has('word/document.xml');
  } catch { return false; }
}
