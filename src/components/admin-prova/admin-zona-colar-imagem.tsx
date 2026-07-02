"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui";

interface Props {
  arquivo: File | null;
  onArquivo: (file: File | null) => void;
  accept?: string;
  inputKey?: number;
  ativo?: boolean;
  rotulo?: string;
  dica?: string;
}

function fileDeClipboardItem(item: DataTransferItem): File | null {
  if (!item.type.startsWith("image/")) return null;
  const blob = item.getAsFile();
  if (!blob) return null;
  const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  return new File([blob], `print-${Date.now()}.${ext}`, { type: blob.type || "image/png" });
}

export function AdminZonaColarImagem({
  arquivo,
  onArquivo,
  accept = ".pdf,application/pdf,image/jpeg,image/png,image/webp",
  inputKey = 0,
  ativo = true,
  rotulo = "Arquivo ou colar print",
  dica = "Ctrl+V com print na área abaixo, ou escolha arquivo",
}: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const registrarArquivo = useCallback(
    (file: File | null) => {
      onArquivo(file);
    },
    [onArquivo]
  );

  useEffect(() => {
    if (!arquivo?.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(arquivo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  useEffect(() => {
    if (!ativo) return;

    function colar(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        const file = fileDeClipboardItem(item);
        if (file) {
          e.preventDefault();
          registrarArquivo(file);
          break;
        }
      }
    }

    window.addEventListener("paste", colar);
    return () => window.removeEventListener("paste", colar);
  }, [ativo, registrarArquivo]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) registrarArquivo(file);
  }

  return (
    <div className="space-y-2">
      <div
        tabIndex={0}
        role="button"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`rounded-xl border-2 border-dashed px-3 py-4 text-center transition-colors ${
          arquivo
            ? "border-indigo-300 bg-indigo-50/50"
            : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30"
        }`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Preview do print"
            className="mx-auto max-h-36 rounded-lg border border-slate-200 object-contain"
          />
        ) : (
          <p className="text-xs text-slate-600">{dica}</p>
        )}
        {arquivo && (
          <p className="mt-2 text-xs font-medium text-slate-700">{arquivo.name}</p>
        )}
      </div>
      <Input
        key={inputKey}
        type="file"
        accept={accept}
        onChange={(e) => registrarArquivo(e.target.files?.[0] ?? null)}
      />
      {arquivo && (
        <button
          type="button"
          className="text-xs text-slate-500 underline hover:text-slate-800"
          onClick={() => registrarArquivo(null)}
        >
          Remover imagem
        </button>
      )}
      <p className="text-[11px] text-slate-500">{rotulo}</p>
    </div>
  );
}
