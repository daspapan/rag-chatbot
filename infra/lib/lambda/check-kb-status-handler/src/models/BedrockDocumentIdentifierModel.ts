// Structure for the document identifier used in Bedrock Agent delete API
export interface BedrockDocumentIdentifier {
    custom: {
        id: string; // This corresponds to the file_id/item's primary key
    };
    dataSourceType: 'CUSTOM';
}