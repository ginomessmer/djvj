import { SHORTCUT_GROUPS, type ShortcutWindow } from '@/domain/show/shortcuts';
import { Dialog } from '../components/Dialog';

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const WHERE: Record<ShortcutWindow, string> = {
  both: '',
  control: 'control window',
  output: 'output window only',
};

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} title="Keyboard shortcuts" onClose={onClose}>
      <p class="hint">
        Single keys work in both windows, so the DJ never has to focus a specific one. They are
        ignored while typing in a text field.
      </p>
      {SHORTCUT_GROUPS.map((group) => (
        <section key={group.title} class="shortcuts">
          <h3 class="subtitle">{group.title}</h3>
          <dl>
            {group.shortcuts.map((shortcut) => (
              <div key={shortcut.action} class="shortcuts__row">
                <dt>
                  {shortcut.keys.map((key, index) =>
                    key === '…' ? (
                      <span key={key + index.toString()} aria-hidden="true">
                        …
                      </span>
                    ) : (
                      <kbd key={key}>{key}</kbd>
                    ),
                  )}
                </dt>
                <dd>
                  {shortcut.action}
                  {WHERE[shortcut.where] && <small> · {WHERE[shortcut.where]}</small>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Dialog>
  );
}
