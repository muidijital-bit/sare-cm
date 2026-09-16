"use client";

import { tr, formatCurrencyTRY } from "@/lib/i18n/tr";
import { previewLineTotal, previewDocumentTotals } from "./calculations-preview";

export interface LineItemRow {
  id?: string;
  productId: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  unitCost: string;
  discountType: "PERCENT" | "AMOUNT";
  discountValue: string;
  vatRate: string;
}

export interface ProductOption {
  id: string;
  name: string;
  unit: string;
  listPrice: number;
  vatRate: number;
  defaultCost: number | null;
}

export function emptyLineItem(): LineItemRow {
  return {
    productId: "",
    description: "",
    quantity: "1",
    unit: "adet",
    unitPrice: "0",
    unitCost: "",
    discountType: "PERCENT",
    discountValue: "0",
    vatRate: "20",
  };
}

interface Props {
  items: LineItemRow[];
  onChange: (items: LineItemRow[]) => void;
  products: ProductOption[];
  documentDiscountType: "PERCENT" | "AMOUNT";
  documentDiscountValue: string;
  onDocumentDiscountChange: (type: "PERCENT" | "AMOUNT", value: string) => void;
}

const n = (v: string) => Number(v) || 0;

export function LineItemEditor({ items, onChange, products, documentDiscountType, documentDiscountValue, onDocumentDiscountChange }: Props) {
  function updateItem(index: number, patch: Partial<LineItemRow>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    onChange([...items, emptyLineItem()]);
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function handleProductSelect(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      updateItem(index, { productId: "" });
      return;
    }
    updateItem(index, {
      productId,
      description: product.name,
      unit: product.unit,
      unitPrice: String(product.listPrice),
      vatRate: String(product.vatRate),
      unitCost: product.defaultCost != null ? String(product.defaultCost) : "",
    });
  }

  const totals = previewDocumentTotals(
    items.map((it) => ({ quantity: n(it.quantity), unitPrice: n(it.unitPrice), discountType: it.discountType, discountValue: n(it.discountValue), vatRate: n(it.vatRate) })),
    { type: documentDiscountType, value: n(documentDiscountValue) },
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{tr.document.items}</h2>
        <button type="button" onClick={addItem} className="text-xs font-medium text-gray-600 hover:text-gray-900">
          + {tr.document.addItem}
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-md border border-gray-200 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
              {products.length > 0 && (
                <select
                  value={item.productId}
                  onChange={(e) => handleProductSelect(i, e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 sm:col-span-2"
                >
                  <option value="">{tr.document.freeText}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <input
                placeholder={tr.document.description}
                value={item.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                className={`rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 ${products.length > 0 ? "sm:col-span-2" : "sm:col-span-3"}`}
              />
              <input
                type="number"
                step="any"
                placeholder={tr.document.quantity}
                value={item.quantity}
                onChange={(e) => updateItem(i, { quantity: e.target.value })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
              />
              <input
                placeholder={tr.document.unit}
                value={item.unit}
                onChange={(e) => updateItem(i, { unit: e.target.value })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
              />
              <input
                type="number"
                step="any"
                placeholder={tr.document.unitPrice}
                value={item.unitPrice}
                onChange={(e) => updateItem(i, { unitPrice: e.target.value })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
              />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-6">
              <select
                value={item.discountType}
                onChange={(e) => updateItem(i, { discountType: e.target.value as "PERCENT" | "AMOUNT" })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
              >
                <option value="PERCENT">{tr.document.percent}</option>
                <option value="AMOUNT">{tr.document.amount}</option>
              </select>
              <input
                type="number"
                step="any"
                placeholder={tr.document.discount}
                value={item.discountValue}
                onChange={(e) => updateItem(i, { discountValue: e.target.value })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
              />
              <input
                type="number"
                step="any"
                placeholder={tr.document.vatRate}
                value={item.vatRate}
                onChange={(e) => updateItem(i, { vatRate: e.target.value })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
              />
              <input
                type="number"
                step="any"
                placeholder={tr.document.unitCost}
                value={item.unitCost}
                onChange={(e) => updateItem(i, { unitCost: e.target.value })}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
              />
              <div className="flex items-center justify-end text-sm font-medium text-gray-900 sm:col-span-1">
                {formatCurrencyTRY(
                  previewLineTotal({ quantity: n(item.quantity), unitPrice: n(item.unitPrice), discountType: item.discountType, discountValue: n(item.discountValue), vatRate: n(item.vatRate) }),
                )}
              </div>
              <button type="button" onClick={() => removeItem(i)} className="text-xs text-red-600 hover:underline sm:col-span-1">
                {tr.document.removeItem}
              </button>
            </div>
          </div>
        ))}

        {items.length === 0 && <p className="text-sm text-gray-400">En az bir satır ekleyin.</p>}
      </div>

      <div className="mt-4 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-700">{tr.document.documentDiscount}</span>
          <select
            value={documentDiscountType}
            onChange={(e) => onDocumentDiscountChange(e.target.value as "PERCENT" | "AMOUNT", documentDiscountValue)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
          >
            <option value="PERCENT">{tr.document.percent}</option>
            <option value="AMOUNT">{tr.document.amount}</option>
          </select>
          <input
            type="number"
            step="any"
            value={documentDiscountValue}
            onChange={(e) => onDocumentDiscountChange(documentDiscountType, e.target.value)}
            className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
          />
        </div>

        <dl className="w-full max-w-xs space-y-1 text-sm sm:w-64">
          <div className="flex justify-between">
            <dt className="text-gray-500">{tr.document.subtotal}</dt>
            <dd className="text-gray-900">{formatCurrencyTRY(totals.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{tr.document.discountTotal}</dt>
            <dd className="text-gray-900">-{formatCurrencyTRY(totals.discountTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{tr.document.vatTotal}</dt>
            <dd className="text-gray-900">{formatCurrencyTRY(totals.vatTotal)}</dd>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold">
            <dt className="text-gray-900">{tr.document.grandTotal}</dt>
            <dd className="text-gray-900">{formatCurrencyTRY(totals.grandTotal)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
