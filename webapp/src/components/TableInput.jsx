import React from "react";

export const emptyTable = () => ({ headers: ["항목", "답"], rows: [["", ""]] });

export default function TableInput({ value, onChange }) {
  const table = value || emptyTable();
  const { headers, rows } = table;

  function updateHeader(i, text) {
    const next = headers.slice();
    next[i] = text;
    onChange({ ...table, headers: next });
  }
  function updateCell(r, c, text) {
    const next = rows.map((row) => row.slice());
    next[r][c] = text;
    onChange({ ...table, rows: next });
  }
  function addColumn() {
    onChange({
      headers: [...headers, `항목 ${headers.length + 1}`],
      rows: rows.map((row) => [...row, ""]),
    });
  }
  function removeColumn() {
    if (headers.length <= 1) return;
    onChange({
      headers: headers.slice(0, -1),
      rows: rows.map((row) => row.slice(0, -1)),
    });
  }
  function addRow() {
    onChange({ ...table, rows: [...rows, headers.map(() => "")] });
  }
  function removeRow() {
    if (rows.length <= 1) return;
    onChange({ ...table, rows: rows.slice(0, -1) });
  }

  return (
    <div className="table-input-wrap">
      <table className="table-input">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>
                <input value={h} onChange={(e) => updateHeader(i, e.target.value)} placeholder={`항목 ${i + 1}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c}>
                  <input value={cell} onChange={(e) => updateCell(r, c, e.target.value)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-input-controls">
        <button type="button" onClick={addRow}>+ 행</button>
        <button type="button" onClick={removeRow} disabled={rows.length <= 1}>− 행</button>
        <button type="button" onClick={addColumn}>+ 열</button>
        <button type="button" onClick={removeColumn} disabled={headers.length <= 1}>− 열</button>
      </div>
    </div>
  );
}
