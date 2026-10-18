import * as React from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "right";
  /** Hide below this breakpoint. */
  hideBelow?: "sm" | "md" | "lg";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
  dense?: boolean;
}

const hideMap = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

/** A printed table: a heavy rule on top, hairlines between rows, no frame. */
export function DataTable<T>({ columns, rows, rowKey, caption, emptyMessage = "Nothing here yet.", onRowClick, className, dense }: DataTableProps<T>) {
  return (
    <div className={cn("relative w-full overflow-x-auto border-t-2 border-ink", className)}>
      <table className="w-full border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-ink bg-paper-tint">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn("px-3 py-2 text-left text-xs font-semibold text-ink", c.align === "right" && "text-right", c.hideBelow && hideMap[c.hideBelow], c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-ink-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("border-b border-rule", onRowClick && "cursor-pointer transition-colors hover:bg-paper-tint")}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn("px-3 align-middle text-ink", dense ? "py-2" : "py-3", c.align === "right" && "text-right tnum", c.hideBelow && hideMap[c.hideBelow], c.className)}
                  >
                    {c.cell(row)}
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
