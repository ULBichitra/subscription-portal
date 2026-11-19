import React from 'react';

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  emptyMessage?: string;
}

function DataTable<T>({ columns, data, keyExtractor, emptyMessage = "No data found." }: DataTableProps<T>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-white/10 bg-black/20">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            {columns.map((col, idx) => (
              <th 
                key={idx}
                className={`p-4 text-xs font-semibold text-gray-400 uppercase tracking-wider ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-8 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr key={keyExtractor(item)} className="hover:bg-white/5 transition-colors">
                {columns.map((col, idx) => (
                  <td key={idx} className={`p-4 text-sm text-gray-300 ${col.className || ''}`}>
                    {typeof col.accessor === 'function' 
                      ? col.accessor(item) 
                      : (item[col.accessor] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
