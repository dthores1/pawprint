import { AnimalAiContent, AiContentType } from '../types';

export function rowToAiContent(r: any): AnimalAiContent {
  return {
    id: r.id,
    organization_id: r.organization_id,
    animal_id: r.animal_id,
    content_type: r.content_type,
    ai_generated_content: r.ai_generated_content,
    draft_content: r.draft_content,
    user_edited: r.user_edited ?? false,
    model: r.model ?? undefined,
    source_fingerprint: r.source_fingerprint ?? undefined,
    generated_at: r.generated_at,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

/**
 * Build the row for an upsert on (animal_id, content_type). Used by both first
 * generation and regeneration — both write fresh model output into BOTH content
 * fields and clear `user_edited`.
 */
export function aiContentToUpsert(
  args: {
    animalId: string;
    contentType: AiContentType;
    content: string;
    model: string;
    generatedAt: string;
    sourceFingerprint?: string;
  },
  organizationId: string)
{
  return {
    organization_id: organizationId,
    animal_id: args.animalId,
    content_type: args.contentType,
    ai_generated_content: args.content,
    draft_content: args.content,
    user_edited: false,
    model: args.model,
    source_fingerprint: args.sourceFingerprint ?? null,
    generated_at: args.generatedAt
  };
}
