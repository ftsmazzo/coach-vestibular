"use client";

import type { ModoUsoRegistro } from "@/generated/prisma/client";
import {
  OPCOES_MODO_USO,
  descricaoModoUso,
  labelModoUso,
} from "@/lib/modo-uso";

export function ModoUsoSelector({
  value,
  onChange,
}: {
  value: ModoUsoRegistro;
  onChange: (v: ModoUsoRegistro) => void;
}) {
  return (
    <div className="space-y-2">
      {OPCOES_MODO_USO.map((modo) => (
        <label
          key={modo}
          className={`flex min-h-[52px] cursor-pointer gap-3 rounded-xl border p-3 transition ${
            value === modo
              ? "border-teal-500 bg-teal-50/80 ring-1 ring-teal-200"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <input
            type="radio"
            name="modoUso"
            className="mt-1 h-5 w-5 shrink-0"
            checked={value === modo}
            onChange={() => onChange(modo)}
          />
          <span>
            <span className="block text-sm font-medium text-slate-900">
              {labelModoUso(modo)}
            </span>
            <span className="mt-0.5 block text-xs text-slate-600">
              {descricaoModoUso(modo)}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
