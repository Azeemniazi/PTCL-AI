const indexable = /\.(pdf|docx|xlsx|pptx|odt|ods|odp|txt|md|csv|json|log|xml|yaml|yml|tsv|html?|css|js|ts|py|sh|sql|ini|conf|env|jpe?g|png|webp|gif|tiff?|bmp)$/i;

export const knowledgeImportMaxBytes = 2 * 1024 ** 3;
export const knowledgeProcessingMaxBytes = 250 * 1024 ** 2;

export function supportsKnowledgeIndex(filename: string, sizeBytes: number): boolean {
  return sizeBytes <= knowledgeProcessingMaxBytes && indexable.test(filename);
}
