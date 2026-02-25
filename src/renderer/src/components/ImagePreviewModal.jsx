import PropTypes from "prop-types";
import { X, Copy } from "lucide-react";

export default function ImagePreviewModal({
  previewImage,
  setPreviewImage,
  handleCopyImage,
}) {
  if (!previewImage) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm transition-opacity"
      onClick={() => setPreviewImage(null)}
    >
      <div className="relative max-h-full max-w-full">
        <div className="absolute right-4 top-4 flex gap-2">
          <button
            onClick={(e) => handleCopyImage(e, previewImage)}
            className="rounded-md bg-black/50 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/80 dark:bg-black/80 dark:hover:bg-black"
            title="Copy Image"
          >
            <Copy size={20} />
          </button>
          <button
            onClick={() => setPreviewImage(null)}
            className="rounded-md bg-black/50 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/80 dark:bg-black/80 dark:hover:bg-black"
            title="Close Preview"
          >
            <X size={20} />
          </button>
        </div>
        <img
          src={previewImage}
          alt="Preview"
          className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

ImagePreviewModal.propTypes = {
  previewImage: PropTypes.string,
  setPreviewImage: PropTypes.func.isRequired,
  handleCopyImage: PropTypes.func.isRequired,
};
