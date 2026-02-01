import type { LineItem, Discrepancy } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

interface BillItemsTableProps {
  items: LineItem[];
  discrepancies: Discrepancy[];
}

export default function BillItemsTable({
  items,
  discrepancies,
}: BillItemsTableProps) {
  const flaggedIndices = new Set(
    discrepancies.flatMap((d) => d.items_involved)
  );

  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs tracking-wider uppercase">
                Service
              </th>
              <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs tracking-wider uppercase">
                Code
              </th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs tracking-wider uppercase">
                Qty
              </th>
              <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs tracking-wider uppercase">
                Charge
              </th>
              <th className="text-center px-4 py-3 text-slate-500 font-medium text-xs tracking-wider uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const isFlagged = flaggedIndices.has(i);
              const itemDiscrepancy = discrepancies.find((d) =>
                d.items_involved.includes(i)
              );
              return (
                <tr
                  key={i}
                  className={`
                    border-b border-slate-800/50 transition-colors
                    ${isFlagged ? "bg-red-500/5" : "hover:bg-slate-800/30"}
                  `}
                >
                  <td className="px-4 py-3">
                    <span className={isFlagged ? "text-red-300" : "text-slate-300"}>
                      {item.description}
                    </span>
                    {item.category && (
                      <span className="ml-2 text-[10px] text-slate-600 font-mono uppercase">
                        {item.category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {item.code || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-400">
                    {item.quantity}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-medium ${
                      isFlagged ? "text-red-400" : "text-white"
                    }`}
                  >
                    ${item.total_charge.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isFlagged && itemDiscrepancy ? (
                      <Badge
                        variant="destructive"
                        className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20"
                      >
                        {itemDiscrepancy.type === "duplicate_charge"
                          ? "DUPLICATE"
                          : itemDiscrepancy.type === "price_inflation"
                          ? "OVERPRICED"
                          : itemDiscrepancy.type === "quantity_anomaly"
                          ? "QTY CHECK"
                          : "FLAG"}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-slate-700">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
