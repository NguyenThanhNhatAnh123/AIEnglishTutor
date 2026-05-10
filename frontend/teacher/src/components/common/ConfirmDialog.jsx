import Modal from './Modal';
import Button from './Button';

/**
 * ConfirmDialog — replaces browser window.confirm() with a styled Modal.
 *
 * Props:
 *   isOpen    {boolean}
 *   title     {string}   – e.g. "Confirm action"
 *   message   {string}   – description text
 *   confirmLabel  {string} – default "Confirm"
 *   cancelLabel   {string} – default "Cancel"
 *   variant       {string} – "danger" | "primary" (default)
 *   loading       {boolean}
 *   onConfirm {Function}
 *   onCancel  {Function}
 */
export default function ConfirmDialog({
  isOpen,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} maxWidth="max-w-md">
      <div className="space-y-5">
        <p className="text-sm text-slate-600">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
