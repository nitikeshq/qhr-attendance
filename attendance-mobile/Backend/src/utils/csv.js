'use strict';

/**
 * Minimal RFC 4180 CSV support. Written in-house rather than pulling a
 * dependency: imports run on operator-supplied files, so the parser needs to be
 * small enough to audit and must never execute anything from the input.
 */

/**
 * Parses CSV text into rows of raw strings. Handles quoted fields, escaped
 * quotes (""), embedded commas and newlines, CRLF, and a UTF-8 BOM.
 */
function parseCsv(text) {
  const input = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let index = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < input.length) {
    const char = input[index];

    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"' && field === '') {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === ',') {
      endField();
      index += 1;
      continue;
    }
    if (char === '\r') {
      // Swallow CR so CRLF and a lone CR both terminate the row once.
      if (input[index + 1] === '\n') index += 1;
      endRow();
      index += 1;
      continue;
    }
    if (char === '\n') {
      endRow();
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }

  // A trailing newline must not produce a phantom row.
  if (field !== '' || row.length > 0) endRow();

  return rows.filter((item) => item.some((value) => String(value).trim() !== ''));
}

/** Normalises a header cell to a comparable key: "Employee ID" -> "employeeid". */
function headerKey(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * Parses CSV into objects keyed by the declared columns. Unknown columns are
 * reported rather than silently dropped, so a mis-typed header is visible during
 * the dry run instead of producing quietly empty fields.
 */
function parseCsvTable(text, columns) {
  const rows = parseCsv(text);
  if (!rows.length) return { error: 'The file is empty' };

  const lookup = new Map(columns.map((column) => [headerKey(column), column]));
  const header = rows[0].map((cell) => headerKey(cell));
  const mapped = header.map((key) => lookup.get(key) || null);
  const unknown = header.filter((key, position) => key !== '' && mapped[position] === null);

  const missingRequired = [];
  for (const column of columns) {
    if (!header.includes(headerKey(column))) missingRequired.push(column);
  }

  const records = rows.slice(1).map((cells, position) => {
    const record = {};
    for (const column of columns) record[column] = '';
    cells.forEach((cell, cellIndex) => {
      const column = mapped[cellIndex];
      if (column) record[column] = String(cell || '').trim();
    });
    // +2: one for the header row, one to make it 1-based like a spreadsheet.
    return { line: position + 2, values: record };
  });

  return { records, unknownColumns: unknown, absentColumns: missingRequired };
}

/** Serialises rows of objects to CSV, quoting every value. */
function toCsv(headers, rows) {
  const quote = (value) => `"${String(value === undefined || value === null ? '' : value).replace(/"/g, '""')}"`;
  const lines = [headers.map(quote).join(',')];
  for (const row of rows) lines.push(headers.map((header) => quote(row[header])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

module.exports = { parseCsv, parseCsvTable, headerKey, toCsv };
