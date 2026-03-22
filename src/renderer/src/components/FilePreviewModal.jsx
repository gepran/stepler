import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { X, Copy, Download, ExternalLink, FileText } from "lucide-react";

export default function FilePreviewModal({
  previewFile,
  setPreviewFile,
  handleCopyImage,
  handleCopyFile,
  handleOpenAttachment,
  handleDownloadAttachment,
}) {
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    let active = true;
    let currentUrl = null;

    if (previewFile && previewFile.name.toLowerCase().endsWith(".pdf")) {
      fetch(previewFile.url)
        .then((res) => res.blob())
        .then((blob) => {
          if (!active) return;
          currentUrl = URL.createObjectURL(blob);
          setBlobUrl(currentUrl);
        })
        .catch((err) => console.error("PDF Preview Error:", err));
    }

    return () => {
      active = false;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      setBlobUrl(null);
    };
  }, [previewFile]);

  if (!previewFile) return null;

  const { url, name, type } = previewFile;
  const isImage = type === "image";
  const isPDF = name.toLowerCase().endsWith(".pdf");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm transition-opacity"
      onClick={() => setPreviewFile(null)}
    >
      <div className="relative flex max-h-full max-w-full flex-col items-center">
        {/* Header Actions */}
        <div className="absolute right-0 top-0 z-10 flex gap-2 p-4">
          {isImage ? (
            <button
              onClick={(e) => handleCopyImage(e, url)}
              className="rounded-md bg-black/50 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/80 dark:bg-black/80 dark:hover:bg-black"
              title="Copy Image"
            >
              <Copy size={20} />
            </button>
          ) : (
            <button
              onClick={(e) => handleCopyFile(e, previewFile)}
              className="rounded-md bg-black/50 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/80 dark:bg-black/80 dark:hover:bg-black"
              title="Copy File"
            >
              <Copy size={20} />
            </button>
          )}
          <button
            onClick={(e) => handleDownloadAttachment(e, previewFile)}
            className="rounded-md bg-black/50 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/80 dark:bg-black/80 dark:hover:bg-black"
            title="Download"
          >
            <Download size={20} />
          </button>
          <button
            onClick={() => setPreviewFile(null)}
            className="rounded-md bg-black/50 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/80 dark:bg-black/80 dark:hover:bg-black"
            title="Close Preview"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div 
          className="flex max-h-[90vh] max-w-[90vw] items-center justify-center overflow-hidden rounded-xl bg-white/5 shadow-2xl backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {isImage ? (
            <img
              src={url}
              alt={name}
              className="max-h-full max-w-full object-contain"
            />
          ) : isPDF ? (
            <embed
              src={blobUrl || url}
              type="application/pdf"
              width="100%"
              height="100%"
              className="h-[85vh] w-[80vw] rounded-lg border-none bg-white"
            />
          ) : (
            <div className="flex flex-col items-center gap-6 p-12 text-center">
              <div className="relative">
                <div className="absolute -inset-4 rounded-full bg-blue-500/20 blur-xl" />
                <FileText size={80} className="relative text-blue-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">{name}</h3>
                <p className="text-sm text-neutral-400">
                  Preview not available for this file type
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={(e) => handleOpenAttachment(e, previewFile)}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95"
                >
                  <ExternalLink size={18} />
                  Open in System
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer Info (for non-images/PDFs) */}
        {!isImage && !isPDF && (
          <div className="mt-4 text-xs font-medium text-neutral-500">
            Press Esc to close
          </div>
        )}
      </div>
    </div>
  );
}

FilePreviewModal.propTypes = {
  previewFile: PropTypes.shape({
    url: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  }),
  setPreviewFile: PropTypes.func.isRequired,
  handleCopyImage: PropTypes.func.isRequired,
  handleCopyFile: PropTypes.func.isRequired,
  handleOpenAttachment: PropTypes.func.isRequired,
  handleDownloadAttachment: PropTypes.func.isRequired,
};
