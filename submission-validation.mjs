export const MAX_PDF_SIZE = 5 * 1024 * 1024;
export const BATCHES = ['24/25', '23/24', '22/23', '21/22', '20/21'];

export function validateSubmission(input) {
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

export async function validatePdf(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.name) throw new Error('Please upload your concept paper as a PDF.');
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) throw new Error('Only PDF files are accepted.');
  if (file.name.length > 200) throw new Error('Use a PDF filename of at most 200 characters.');
  if (file.size > MAX_PDF_SIZE) throw new Error('Maximum PDF size is 5 MB.');
  if (file.size < 8) throw new Error('The PDF is empty or invalid.');
  const header = new TextDecoder().decode(await file.slice(0, 8).arrayBuffer());
  if (!/^%PDF-\d\.\d/.test(header)) throw new Error('The uploaded file is not a valid PDF. Export your paper as PDF and try again.');
}
