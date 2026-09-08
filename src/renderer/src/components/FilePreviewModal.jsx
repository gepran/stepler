import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { X, Copy, Download, ExternalLink, FileText } from "lucide-react";
import {
  attachmentSrc,
  attachmentBlob,
  copyAttachmentImage,
  copyAttachmentFile,
  downloadAttachment,
  openAttachment,
} from "../lib/attachments";

export default function FilePreviewModal({
  previewFile,
  setPreviewFile,
  onToast,
}) {
  const [pdfUrl, setPdfUrl] = useState(null);

  const isPDF = !!previewFile?.name?.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    if (!previewFile || !isPDF) return undefined;
    let active = true;
    let objectUrl = null;
    // The PDF plugin needs a blob URL; the attachment scheme is not something
    // the page itself is allowed to fetch under the CSP.
    attachmentBlob(previewFile).then((blob) => {
      if (!active || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPdfUrl(null);
    };
  }, [previewFile, isPDF]);

  if (!previewFile) return null;

  const isImage = previewFile.type === "image";
  const src = attachmentSrc(previewFile);

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 p-10 backdrop-blur-sm"
      onClick={() => setPreviewFile(null)}
    >
      <div className="relative flex h-full max-h-full w-full max-w-5xl flex-col items-center">
        <div className="absolute right-0 top-0 z-10 flex gap-2 p-4">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              const res = isImage
                ? await copyAttachmentImage(previewFile)
                : await copyAttachmentFile(previewFile);
              onToast?.(
                res?.success ? "Copied" : "Copy failed",
                res?.success ? "info" : "error",
              );
            }}
            className="btn-tactile rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            title={isImage ? "Copy image" : "Copy file"}
          >
            <Copy size={20} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadAttachment(previewFile);
            }}
            className="btn-tactile rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            title="Save as…"
          >
            <Download size={20} />
          </button>
          <button
            onClick={() => setPreviewFile(null)}
            className="btn-tactile rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        <div
          className="flex h-full w-full items-center justify-center pt-16"
          onClick={(e) => e.stopPropagation()}
        >
          {isImage ? (
            <img
              src={src}
              alt={previewFile.name}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
          ) : isPDF ? (
            pdfUrl ? (
              <embed
                src={pdfUrl}
                type="application/pdf"
                className="h-full w-full rounded-lg"
              />
            ) : (
              <div className="text-sm text-neutral-400">Loading preview…</div>
            )
          ) : (
            <div className="flex flex-col items-center gap-6 p-12 text-center">
              <FileText size={72} className="text-blue-500" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">
                  {previewFile.name}
                </h3>
                <p className="text-sm text-neutral-400">
                  Preview is not available for this file type
                </p>
              </div>
              <button
                onClick={() => openAttachment(previewFile)}
                className="btn-tactile flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-200"
              >
                <ExternalLink size={18} />
                Open in system app
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

FilePreviewModal.propTypes = {
  previewFile: PropTypes.object,
  setPreviewFile: PropTypes.func.isRequired,
  onToast: PropTypes.func,
};
