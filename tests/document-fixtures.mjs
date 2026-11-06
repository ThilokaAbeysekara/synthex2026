export function wordDoc() {
  return new File([new Uint8Array([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]),
    new Uint8Array(504), Buffer.from('WordDocument', 'utf16le')], 'paper.doc', { type: 'application/msword' });
}

// Small structurally valid ZIP with uncompressed document parts; no dependency.
export function wordDocx(names = ['[Content_Types].xml', 'word/document.xml']) {
  const locals = [], directory = [];
  let offset = 0;
  for (const name of names) {
    const filename = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, filename); directory.push(central, filename);
    offset += local.length + filename.length;
  }
  const body = Buffer.concat(locals), index = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(index.length, 12); end.writeUInt32LE(body.length, 16);
  return new File([body, index, end], 'paper.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
