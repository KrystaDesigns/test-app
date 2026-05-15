export function createMeetingPdf(meeting) {
  const lines = [
    meeting.title,
    `Created: ${new Date(meeting.createdAt).toLocaleString()}`,
    `Source file: ${meeting.fileName}`,
    '',
    'Summary',
    meeting.summary,
    '',
    'Key Points',
    ...meeting.keyPoints.map((point) => `- ${point}`),
    '',
    'Decisions',
    ...(meeting.decisions.length ? meeting.decisions : ['No explicit decisions detected.']).map((decision) => `- ${decision}`),
    '',
    'Action Items',
    ...(meeting.actionItems.length ? meeting.actionItems.map((item) => `- ${item.owner}: ${item.task} (Due: ${item.dueDate}; Status: ${item.status})`) : ['No action items detected.']),
    '',
    'Transcript',
    meeting.transcript,
  ];
  return buildSimplePdf(lines);
}

function buildSimplePdf(lines) {
  const objects = [];
  const escapedLines = lines.flatMap((line) => wrapLine(String(line), 92)).map(escapePdfText);
  let y = 790;
  const commands = ['BT', '/F1 11 Tf', '50 790 Td', '14 TL'];
  escapedLines.forEach((line, index) => {
    if (index > 0) commands.push('T*');
    if (y < 60) {
      commands.push('T*');
      y = 790;
    }
    commands.push(`(${line}) Tj`);
    y -= 14;
  });
  commands.push('ET');
  const stream = commands.join('\n');

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

function wrapLine(line, maxLength) {
  if (!line) return [''];
  const result = [];
  let remaining = line;
  while (remaining.length > maxLength) {
    const breakAt = remaining.lastIndexOf(' ', maxLength) || maxLength;
    result.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }
  result.push(remaining);
  return result;
}

function escapePdfText(value) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
