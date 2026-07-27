import { Copy, Check, Code, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  formId: string;
  formName: string;
}

const EMBED_BASE_URL = 'https://deploysafe.in';

export default function EmbedPanel({ formId, formName }: Props) {
  const iframeCode = `<iframe src="${EMBED_BASE_URL}/form/${formId}" width="100%" height="600" frameborder="0"></iframe>`;
  const jsSnippet = `<script src="${EMBED_BASE_URL}/embed/${formId}.js"></script>`;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success(`${label} copied to clipboard`);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h3 className="text-lg font-bold text-[var(--foreground)]">Embed Form</h3>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Embed <strong className="text-[var(--foreground)]">{formName}</strong> on your website using one of the methods below.
        </p>
      </div>

      {/* Iframe Embed */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] flex items-center justify-center">
              <Code size={15} className="text-[var(--primary)]" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--foreground)]">Iframe Embed</h4>
              <p className="text-xs text-[var(--muted-foreground)]">Responsive iframe for any website</p>
            </div>
          </div>
          <a
            href={`${EMBED_BASE_URL}/form/${formId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
          >
            Preview <ExternalLink size={11} />
          </a>
        </div>

        <div className="relative">
          <pre className="p-3 rounded-lg bg-[var(--muted)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] overflow-x-auto">
            {iframeCode}
          </pre>
          <button
            type="button"
            onClick={() => copyToClipboard(iframeCode, 'Iframe snippet')}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
            title="Copy iframe code"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      {/* JavaScript Embed */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] flex items-center justify-center">
              <Code size={15} className="text-[var(--primary)]" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--foreground)]">JavaScript Snippet</h4>
              <p className="text-xs text-[var(--muted-foreground)]">Inline embed snippet</p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
            Preview
          </span>
        </div>

        <div className="relative">
          <pre className="p-3 rounded-lg bg-[var(--muted)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] overflow-x-auto">
            {jsSnippet}
          </pre>
          <button
            type="button"
            onClick={() => copyToClipboard(jsSnippet, 'JS snippet')}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
            title="Copy JS snippet"
          >
            <Copy size={14} />
          </button>
        </div>

        <p className="text-xs text-[var(--muted-foreground)] mt-3 flex items-start gap-1.5">
          <span className="text-amber-500 mt-0.5 shrink-0">ⓘ</span>
          Injects the form directly into your page. This feature is in preview.
        </p>
      </div>

      {/* Direct Link */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] flex items-center justify-center">
              <ExternalLink size={15} className="text-[var(--primary)]" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--foreground)]">Direct Link</h4>
              <p className="text-xs text-[var(--muted-foreground)]">Share the form URL directly</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <pre className="p-3 rounded-lg bg-[var(--muted)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] overflow-x-auto whitespace-pre-wrap break-all">
            {`${EMBED_BASE_URL}/form/${formId}`}
          </pre>
          <button
            type="button"
            onClick={() => copyToClipboard(`${EMBED_BASE_URL}/form/${formId}`, 'Form URL')}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
            title="Copy form URL"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
