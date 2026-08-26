import { api, apiUpload } from './api';

export interface DraftVariable {
  key: string;
  label: string;
  source: 'pre' | 'capture';
  required?: boolean;
  extract_hint?: string;
}

export interface DraftSection {
  key: string;
  heading: string;
  node_type: string;
  prompt: string;
  edges: Array<{ to_key: string; condition: string }>;
}

export interface DraftAgent {
  name: string;
  gender: 'male' | 'female';
  role: string;
  welcome_message: string;
  agent_information: string;
  call_end_rules: string;
  sections: DraftSection[];
  variables: DraftVariable[];
}

export async function transcribeNote(file: File, language?: string): Promise<{ transcript: string }> {
  const fd = new FormData();
  fd.append('audio', file);
  if (language) fd.append('language', language);
  return apiUpload('/ai/transcribe-chunk', fd);
}

export async function structurePrompt(transcript: string): Promise<{ structured: string }> {
  return api('/ai/structure-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });
}

export async function draftAgent(input: {
  channel?: string;
  description: string;
  business_name?: string;
  language?: string;
  create?: boolean;
}): Promise<DraftAgent | { draft: DraftAgent; employee: any }> {
  return api('/ai/draft-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
