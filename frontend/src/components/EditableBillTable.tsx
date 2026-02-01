import { useState } from "react";
import type { LineItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EditableBillTableProps {
  items: LineItem[];
  onUpdate: (items: LineItem[]) => void;
}

export default function EditableBillTable({ items, onUpdate }: EditableBillTableProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<LineItem | null>(null);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...items[index] });
  };

  const handleSave = () => {
    if (editingIndex === null || !editForm) return;
    const newItems = [...items];
    newItems[editingIndex] = editForm;
    onUpdate(newItems);
    setEditingIndex(null);
    setEditForm(null);
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const handleDelete = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onUpdate(newItems);
  };

  const handleAdd = () => {
    const newItem: LineItem = {
      code: "",
      description: "New Item",
      quantity: 1,
      unit_charge: 0,
      total_charge: 0,
      date_of_service: null,
      category: "Other",
    };
    onUpdate([...items, newItem]);
    setEditingIndex(items.length);
    setEditForm(newItem);
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg">Line Items</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Item
          </Button>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          Review and edit the extracted items. Click on a row to edit.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-3 px-2 text-slate-500 font-medium text-xs uppercase tracking-wider">Description</th>
                <th className="text-right py-3 px-2 text-slate-500 font-medium text-xs uppercase tracking-wider w-20">Qty</th>
                <th className="text-right py-3 px-2 text-slate-500 font-medium text-xs uppercase tracking-wider w-28">Unit Price</th>
                <th className="text-right py-3 px-2 text-slate-500 font-medium text-xs uppercase tracking-wider w-28">Total</th>
                <th className="text-right py-3 px-2 text-slate-500 font-medium text-xs uppercase tracking-wider w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr
                  key={index}
                  className={`border-b border-slate-800/50 transition-colors ${
                    editingIndex === index ? "bg-slate-800/50" : "hover:bg-slate-800/30"
                  }`}
                >
                  {editingIndex === index && editForm ? (
                    <>
                      <td className="py-2 px-2">
                        <Input
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="bg-slate-950 border-slate-700 text-white text-sm h-8"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          value={editForm.quantity}
                          onChange={(e) => {
                            const qty = Number(e.target.value);
                            setEditForm({
                              ...editForm,
                              quantity: qty,
                              total_charge: qty * editForm.unit_charge,
                            });
                          }}
                          className="bg-slate-950 border-slate-700 text-white text-sm h-8 text-right"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={editForm.unit_charge}
                          onChange={(e) => {
                            const unit = Number(e.target.value);
                            setEditForm({
                              ...editForm,
                              unit_charge: unit,
                              total_charge: editForm.quantity * unit,
                            });
                          }}
                          className="bg-slate-950 border-slate-700 text-white text-sm h-8 text-right"
                        />
                      </td>
                      <td className="py-2 px-2 text-right text-white font-mono">
                        ${editForm.total_charge.toFixed(2)}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleSave}
                            className="h-7 w-7 p-0 text-teal-400 hover:text-teal-300 hover:bg-teal-500/10"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancel}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-300 hover:bg-slate-700"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-2 text-slate-300">{item.description}</td>
                      <td className="py-3 px-2 text-right text-slate-300 font-mono">{item.quantity}</td>
                      <td className="py-3 px-2 text-right text-slate-300 font-mono">${(item.unit_charge || 0).toFixed(2)}</td>
                      <td className="py-3 px-2 text-right text-white font-mono font-medium">${(item.total_charge || 0).toFixed(2)}</td>
                      <td className="py-3 px-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(index)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-300 hover:bg-slate-700"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(index)}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {items.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            No line items found. Click "Add Item" to add one.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
