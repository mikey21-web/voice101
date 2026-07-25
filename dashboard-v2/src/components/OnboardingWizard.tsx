import { useState } from 'react';
import { createPortal } from 'react-dom';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  cta?: string;
  href?: string;
  optional?: boolean;
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to LeadAuto',
    description: 'Let\'s get your account set up in 5 minutes.',
  },
  {
    id: 'connect-whatsapp',
    title: 'Connect WhatsApp Business',
    description: 'Link your WhatsApp Business API to start receiving messages.',
    cta: 'Connect WhatsApp',
    href: '/integrations',
  },
  {
    id: 'import-contacts',
    title: 'Import your contacts',
    description: 'Upload a CSV or connect your CRM to bring in existing leads.',
    cta: 'Import contacts',
    href: '/contacts',
    optional: true,
  },
  {
    id: 'create-campaign',
    title: 'Create your first campaign',
    description: 'Set up a source for new leads to come in from.',
    cta: 'Create campaign',
    href: '/campaigns',
  },
  {
    id: 'invite-team',
    title: 'Invite your team',
    description: 'Add team members so everyone can collaborate.',
    cta: 'Invite team',
    href: '/team',
    optional: true,
  },
  {
    id: 'done',
    title: 'You\'re all set!',
    description: 'Your account is ready. Start receiving leads now.',
  },
];

export function OnboardingWizard({ open, onClose, steps = DEFAULT_STEPS }: { open: boolean; onClose: () => void; steps?: OnboardingStep[] }) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!open) return null;
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="onboarding-title" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--background)] rounded-lg p-8 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 id="onboarding-title" className="text-xl font-bold">{step.title}</h2>
          <button onClick={onClose} aria-label="Close onboarding" className="text-[var(--muted-foreground)]">✕</button>
        </div>

        <div className="h-1 bg-[var(--muted)] rounded-full mb-4 overflow-hidden">
          <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${progress}%` }} />
        </div>

        <p className="text-[var(--muted-foreground)] mb-6">{step.description}</p>

        <div className="flex justify-between items-center">
          <span className="text-xs text-[var(--muted-foreground)]">
            Step {currentStep + 1} of {steps.length}
          </span>
          <div className="flex gap-2">
            {step.optional && (
              <button onClick={() => setCurrentStep(currentStep + 1)} className="text-sm text-[var(--muted-foreground)] hover:underline">
                Skip
              </button>
            )}
            <button
              onClick={() => isLast ? onClose() : setCurrentStep(currentStep + 1)}
              className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {isLast ? 'Get started' : (step.cta || 'Next')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
